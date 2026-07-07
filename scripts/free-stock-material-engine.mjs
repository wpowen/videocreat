#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const DEFAULT_PROVIDER_ORDER = ["local-authorized", "direct-url", "nasa", "pexels", "pixabay", "fixture"];
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv"]);

function usage() {
  console.log(`Usage:
  free-stock-material-engine.mjs --brief <brief.json> --out <dir> [--scenes <count>]
    [--provider-order local-authorized,direct-url,nasa,pexels,pixabay,fixture]
    [--allow-fixture] [--max-download-mb <number>]
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function write(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

function writeJson(path, value) {
  write(path, JSON.stringify(value, null, 2));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function safeId(value, fallback = "scene") {
  return String(value || fallback)
    .normalize("NFKC")
    .replace(/[^a-z0-9\u4e00-\u9fff_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || fallback;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function looksLikeVideoPath(value) {
  try {
    const path = isRemoteUrl(value) ? new URL(value).pathname : String(value || "");
    return VIDEO_EXTENSIONS.has(extname(path).toLowerCase());
  } catch {
    return false;
  }
}

function extFromUrlOrType(url, contentType = "") {
  try {
    const ext = extname(new URL(url).pathname).toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) return ext;
  } catch {
    // ignore
  }
  if (/webm/i.test(contentType)) return ".webm";
  if (/quicktime|mov/i.test(contentType)) return ".mov";
  return ".mp4";
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function textTokens(text) {
  const raw = compactText(text).toLowerCase();
  const latin = raw.match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
  const cjk = raw.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const stop = new Set([
    "this", "that", "with", "from", "into", "about", "video", "scene",
    "the", "and", "for", "you", "your", "我们", "一个", "这个", "不是", "就是", "素材",
  ]);
  return [...latin, ...cjk].filter((token) => !stop.has(token)).slice(0, 12);
}

function sceneQueriesFromBrief(brief, limit) {
  const sourceScenes = Array.isArray(brief.scenes) && brief.scenes.length
    ? brief.scenes
    : [{
        id: "opening",
        label: brief.title || "opening",
        subtitle: brief.objective || brief.narration || brief.title || "city work scene",
      }];
  return sourceScenes.slice(0, limit).map((scene, index) => {
    const text = [
      scene.materialQuery,
      scene.stockQuery,
      scene.visualQuery,
      scene.label,
      scene.headline,
      scene.subtitle,
      scene.body,
      scene.narration,
      brief.title,
      brief.objective,
    ].filter(Boolean).join(" ");
    const keywords = Array.from(new Set([
      ...(Array.isArray(scene.materialKeywords) ? scene.materialKeywords : []),
      ...textTokens(text),
    ])).slice(0, 8);
    return {
      sceneId: safeId(scene.id || scene.label || `scene-${index + 1}`),
      order: index + 1,
      query: compactText(scene.materialQuery || scene.stockQuery || keywords.slice(0, 4).join(" ") || brief.title || "nature city video"),
      keywords,
      intent: compactText(scene.visualIntent || scene.subtitle || scene.body || scene.narration || brief.objective || ""),
      targetRole: scene.materialRole || scene.visualRole || "b-roll-support",
      requestedSource: scene.materialSource || scene.stockSource || null,
    };
  });
}

function collectDeclaredMaterials(brief) {
  const entries = [];
  const add = (item, sceneId = null) => {
    if (!item) return;
    if (typeof item === "string") {
      entries.push({ sceneId, path: item, url: isRemoteUrl(item) ? item : null });
      return;
    }
    if (typeof item === "object") {
      entries.push({ sceneId, ...item });
    }
  };
  if (Array.isArray(brief.freeStockMaterials)) brief.freeStockMaterials.forEach((item) => add(item));
  if (Array.isArray(brief.sourceMaterials)) {
    brief.sourceMaterials.forEach((item) => {
      const kind = String(item?.kind || item?.type || "").toLowerCase();
      if (/video|b-roll|stock|footage|素材/.test(kind) || item?.mediaRole === "b-roll") add(item);
    });
  }
  if (Array.isArray(brief.scenes)) {
    for (const scene of brief.scenes) {
      add(scene.material, scene.id || scene.label || null);
      add(scene.stockMaterial, scene.id || scene.label || null);
      add(scene.sourceVideo, scene.id || scene.label || null);
      if (Array.isArray(scene.materials)) scene.materials.forEach((item) => add(item, scene.id || scene.label || null));
    }
  }
  return entries;
}

function providerRegistry() {
  return {
    "local-authorized": {
      commercialUse: true,
      attributionRequired: false,
      notes: "Uses local files declared by the brief with rights/license metadata.",
    },
    "direct-url": {
      commercialUse: "declared-by-entry",
      attributionRequired: "declared-by-entry",
      notes: "Downloads direct media URLs only when the brief declares license metadata.",
    },
    nasa: {
      commercialUse: true,
      attributionRequired: false,
      api: "https://images-api.nasa.gov/search",
      notes: "NASA media is generally not copyrighted, but NASA marks, people, and endorsement claims still need review.",
    },
    pexels: {
      commercialUse: true,
      attributionRequired: false,
      requiresEnv: "PEXELS_API_KEY",
      api: "https://api.pexels.com/videos/search",
      notes: "Pexels API requires an API key; avoid implied endorsement, brands, and sensitive person use.",
    },
    pixabay: {
      commercialUse: true,
      attributionRequired: false,
      requiresEnv: "PIXABAY_API_KEY",
      api: "https://pixabay.com/api/videos/",
      notes: "Pixabay API requires an API key; do not redistribute raw stock as a competing library.",
    },
    fixture: {
      commercialUse: true,
      attributionRequired: false,
      notes: "Locally generated fixture for engine validation when no external provider is available.",
    },
  };
}

function materialRightsOk(entry = {}) {
  const rightsText = compactText([
    entry.license,
    entry.licenseType,
    entry.rights,
    entry.rightsStatus,
    entry.usage,
  ].filter(Boolean).join(" ")).toLowerCase();
  if (entry.commercialUse === true || entry.allowedCommercial === true) return true;
  return /commercial|商用|public domain|cc0|pexels|pixabay|mixkit|coverr|nasa|free commercial/.test(rightsText);
}

function declaredMaterialForScene(declared, scene) {
  return declared.find((entry) => {
    const sceneId = safeId(entry.sceneId || "");
    return sceneId && sceneId === scene.sceneId && (entry.path || entry.url);
  }) || declared.find((entry) => (entry.path || entry.url) && !entry._used);
}

async function downloadFile(url, target, { maxBytes }) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength && contentLength > maxBytes) {
    throw new Error(`download too large: ${contentLength} bytes exceeds ${maxBytes}`);
  }
  const contentType = response.headers.get("content-type") || "";
  const temp = `${target}.part`;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`download too large: ${bytes.length} bytes exceeds ${maxBytes}`);
  write(temp, bytes);
  renameSync(temp, target);
  return { bytes: bytes.length, contentType };
}

function ffmpegAvailable() {
  try {
    return Boolean(globalThis.process?.versions?.node) && statSync("/usr/bin/false");
  } catch {
    return true;
  }
}

function runCommand(command, args, cwd) {
  const { spawnSync } = awaitableChildProcess();
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout || "").slice(-1000)}`);
  }
  return result;
}

function awaitableChildProcess() {
  // Kept behind a function so this script has one import surface for older Node runners.
  return globalThis.__childProcess || (globalThis.__childProcess = requireChildProcess());
}

function requireChildProcess() {
  return globalThis.process.getBuiltinModule
    ? globalThis.process.getBuiltinModule("child_process")
    : null;
}

async function makeFixtureClip({ target, scene, index, duration = 3.2 }) {
  const { spawnSync } = await import("node:child_process");
  const colors = ["0x19324a", "0x1f5c48", "0x563b1f", "0x3d315f", "0x5b233b"];
  const color = colors[index % colors.length];
  const filter = [
    `color=c=${color}:s=1920x1080:d=${duration}`,
    `format=yuv420p`,
    `drawbox=x=120:y=110:w=1680:h=860:color=white@0.08:t=6`,
    `drawbox=x=170+260*t:y=220:w=260:h=180:color=white@0.16:t=fill`,
    `drawbox=x=1360-180*t:y=610:w=320:h=220:color=white@0.10:t=fill`,
    `drawbox=x=150:y=850:w=740:h=18:color=white@0.70:t=fill`,
    `drawbox=x=150:y=890:w=520:h=18:color=white@0.46:t=fill`,
    `drawbox=x=150:y=930:w=620:h=18:color=white@0.30:t=fill`,
  ].join(",");
  const result = spawnSync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", filter,
    "-r", "30",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    target,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffmpeg fixture generation failed: ${(result.stderr || "").slice(-1200)}`);
  return { bytes: statSync(target).size };
}

async function normalizeClip({ input, output, duration = 3.2 }) {
  const { spawnSync } = await import("node:child_process");
  const probe = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    input,
  ], { encoding: "utf8" });
  const sourceDuration = probe.status === 0 ? Number.parseFloat(probe.stdout || "0") : 0;
  const seekSeconds = Number.isFinite(sourceDuration) && sourceDuration > duration + 4
    ? Math.min(Math.max(2, sourceDuration * 0.2), Math.max(0, sourceDuration - duration - 0.5))
    : 0;
  const inputArgs = seekSeconds > 0
    ? ["-ss", seekSeconds.toFixed(3), "-stream_loop", "-1", "-i", input]
    : ["-stream_loop", "-1", "-i", input];
  const result = spawnSync("ffmpeg", [
    "-y",
    ...inputArgs,
    "-t", String(duration),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p",
    "-an",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "21",
    output,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffmpeg normalize failed: ${(result.stderr || "").slice(-1200)}`);
  return { bytes: statSync(output).size };
}

async function searchPexels(scene) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", scene.query);
  url.searchParams.set("per_page", "3");
  url.searchParams.set("orientation", "landscape");
  const response = await fetch(url, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`Pexels search failed: HTTP ${response.status}`);
  const json = await response.json();
  const video = (json.videos || [])[0];
  const file = (video?.video_files || [])
    .filter((item) => /mp4/i.test(item.file_type || "") && item.link)
    .sort((a, b) => Math.abs((a.width || 0) - 1920) - Math.abs((b.width || 0) - 1920))[0];
  if (!file) return null;
  return {
    provider: "pexels",
    sourceUrl: video.url,
    downloadUrl: file.link,
    title: `Pexels video ${video.id}`,
    licenseType: "Pexels License",
    attributionRequired: false,
    commercialUse: true,
    creator: video.user?.name || null,
  };
}

async function searchPixabay(scene) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", scene.query);
  url.searchParams.set("per_page", "3");
  url.searchParams.set("video_type", "all");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pixabay search failed: HTTP ${response.status}`);
  const json = await response.json();
  const item = (json.hits || [])[0];
  const videos = item?.videos || {};
  const file = videos.large || videos.medium || videos.small || videos.tiny;
  if (!file?.url) return null;
  return {
    provider: "pixabay",
    sourceUrl: item.pageURL,
    downloadUrl: file.url,
    title: `Pixabay video ${item.id}`,
    licenseType: "Pixabay Content License",
    attributionRequired: false,
    commercialUse: true,
    creator: item.user || null,
  };
}

function nasaVariantRank(url) {
  const text = String(url || "").toLowerCase();
  if (/~small\.mp4/.test(text)) return 1;
  if (/~medium\.mp4/.test(text)) return 2;
  if (/~mobile\.mp4/.test(text)) return 3;
  if (/~preview\.mp4/.test(text)) return 4;
  if (/~large\.mp4/.test(text)) return 5;
  if (/~orig\.mp4/.test(text)) return 6;
  return 3;
}

async function headContentLength(url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!response.ok) return 0;
    return Number(response.headers.get("content-length") || 0);
  } catch {
    return 0;
  }
}

async function selectNasaDownloadUrl(assets, maxBytes) {
  const candidates = (Array.isArray(assets) ? assets : [])
    .filter((asset) => /\.mp4($|\?)/i.test(asset))
    .sort((a, b) => nasaVariantRank(a) - nasaVariantRank(b));
  for (const candidate of candidates) {
    const bytes = await headContentLength(candidate);
    if (!bytes || bytes <= maxBytes) return { url: candidate, bytes: bytes || null };
  }
  return null;
}

async function searchNasa(scene, { maxBytes = 80 * 1024 * 1024 } = {}) {
  const url = new URL("https://images-api.nasa.gov/search");
  url.searchParams.set("q", scene.query);
  url.searchParams.set("media_type", "video");
  url.searchParams.set("page_size", "5");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NASA search failed: HTTP ${response.status}`);
  const json = await response.json();
  const items = json.collection?.items || [];
  let item = null;
  let selectedAsset = null;
  let selectedHref = null;
  for (const candidateItem of items) {
    const href = candidateItem?.href;
    if (!href) continue;
    const assetsResponse = await fetch(href);
    if (!assetsResponse.ok) throw new Error(`NASA asset listing failed: HTTP ${assetsResponse.status}`);
    const assets = await assetsResponse.json();
    selectedAsset = await selectNasaDownloadUrl(assets, maxBytes);
    if (selectedAsset) {
      item = candidateItem;
      selectedHref = href;
      break;
    }
  }
  if (!item || !selectedAsset?.url) return null;
  const data = item.data?.[0] || {};
  return {
    provider: "nasa",
    sourceUrl: item.links?.[0]?.href || selectedHref,
    downloadUrl: selectedAsset.url,
    expectedBytes: selectedAsset.bytes,
    title: data.title || `NASA video for ${scene.query}`,
    licenseType: "NASA media usage guidelines / public domain with endorsement restrictions",
    attributionRequired: false,
    commercialUse: true,
    creator: data.center || "NASA",
    reviewNotes: "Do not imply NASA endorsement; review logos, people, and mission marks before publication.",
  };
}

async function candidateForProvider(provider, scene, declared, maxBytes) {
  if (provider === "local-authorized") {
    const entry = declaredMaterialForScene(declared, scene);
    if (!entry || !entry.path || isRemoteUrl(entry.path) || !materialRightsOk(entry)) return null;
    const abs = resolve(ROOT, entry.path);
    if (!existsSync(abs) || !statSync(abs).isFile() || !looksLikeVideoPath(abs)) return null;
    entry._used = true;
    return {
      provider,
      localPath: abs,
      sourceUrl: entry.sourceUrl || entry.path,
      title: entry.title || entry.label || scene.query,
      licenseType: entry.licenseType || entry.license || entry.rights || "declared by brief",
      attributionRequired: Boolean(entry.attributionRequired),
      attributionText: entry.attributionText || "",
      commercialUse: true,
      creator: entry.creator || null,
    };
  }
  if (provider === "direct-url") {
    const entry = declaredMaterialForScene(declared, scene);
    const url = entry?.url || entry?.downloadUrl || (isRemoteUrl(entry?.path) ? entry.path : null);
    if (!url || !looksLikeVideoPath(url) || !materialRightsOk(entry)) return null;
    entry._used = true;
    return {
      provider,
      downloadUrl: url,
      sourceUrl: entry.sourceUrl || url,
      title: entry.title || entry.label || scene.query,
      licenseType: entry.licenseType || entry.license || entry.rights || "declared by brief",
      attributionRequired: Boolean(entry.attributionRequired),
      attributionText: entry.attributionText || "",
      commercialUse: true,
      creator: entry.creator || null,
      maxBytes,
    };
  }
  if (provider === "pexels") return searchPexels(scene);
  if (provider === "pixabay") return searchPixabay(scene);
  if (provider === "nasa") return searchNasa(scene, { maxBytes });
  return null;
}

async function materializeCandidate({ candidate, scene, out, index, maxBytes, allowFixture }) {
  const rawDir = join(out, "materials", "free-stock", "raw");
  const normalizedDir = join(out, "assets", "free-stock");
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  const sceneStem = `${String(index + 1).padStart(2, "0")}-${scene.sceneId}`;
  let rawPath = null;
  let downloaded = null;
  let selected = candidate;
  if (!selected && allowFixture) {
    selected = {
      provider: "fixture",
      sourceUrl: "local-generated-fixture",
      title: `Local authorized fixture for ${scene.query}`,
      licenseType: "local generated fixture; safe for commercial workflow testing",
      attributionRequired: false,
      commercialUse: true,
      creator: "codex-video-workflow",
      reviewNotes: "Fixture proves the engine path only; replace with real free commercial footage before publication.",
    };
  }
  if (!selected) return null;
  if (selected.localPath) {
    const ext = extname(selected.localPath).toLowerCase() || ".mp4";
    rawPath = join(rawDir, `${sceneStem}${ext}`);
    copyFileSync(selected.localPath, rawPath);
    downloaded = { bytes: statSync(rawPath).size, mode: "copied-local-file" };
  } else if (selected.downloadUrl) {
    const ext = extFromUrlOrType(selected.downloadUrl);
    rawPath = join(rawDir, `${sceneStem}${ext}`);
    downloaded = await downloadFile(selected.downloadUrl, rawPath, { maxBytes });
  } else if (selected.provider === "fixture") {
    rawPath = join(rawDir, `${sceneStem}.mp4`);
    downloaded = await makeFixtureClip({ target: rawPath, scene, index });
  }
  if (!rawPath || !existsSync(rawPath)) return null;
  const normalizedPath = join(normalizedDir, `${sceneStem}.mp4`);
  await normalizeClip({ input: rawPath, output: normalizedPath, duration: 3.2 });
  const relativeRaw = relative(out, rawPath);
  const relativeNormalized = relative(out, normalizedPath);
  return {
    sceneId: scene.sceneId,
    order: scene.order,
    query: scene.query,
    keywords: scene.keywords,
    targetRole: scene.targetRole,
    provider: selected.provider,
    title: selected.title,
    creator: selected.creator || null,
    sourceUrl: selected.sourceUrl || selected.downloadUrl || "local-generated-fixture",
    downloadUrl: selected.downloadUrl || null,
    rawPath: relativeRaw,
    normalizedPath: relativeNormalized,
    licenseType: selected.licenseType,
    commercialUse: selected.commercialUse === true,
    attributionRequired: Boolean(selected.attributionRequired),
    attributionText: selected.attributionText || "",
    reviewNotes: selected.reviewNotes || "",
    byteSize: statSync(normalizedPath).size,
    rawByteSize: statSync(rawPath).size,
    sha256: sha256File(normalizedPath),
    downloaded,
    status: selected.provider === "fixture" ? "fixture-selected" : "selected",
  };
}

async function runEngine({ brief, out, providerOrder, scenesLimit, allowFixture, maxBytes }) {
  const registry = providerRegistry();
  const scenes = sceneQueriesFromBrief(brief, scenesLimit);
  const declared = collectDeclaredMaterials(brief);
  const selections = [];
  const attempts = [];
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    let selected = null;
    for (const provider of providerOrder) {
      if (!registry[provider]) {
        attempts.push({ sceneId: scene.sceneId, provider, status: "unknown-provider" });
        continue;
      }
      if (provider === "fixture") continue;
      try {
        const candidate = await candidateForProvider(provider, scene, declared, maxBytes);
        attempts.push({ sceneId: scene.sceneId, provider, status: candidate ? "candidate-found" : "no-candidate" });
        if (candidate) {
          selected = candidate;
          break;
        }
      } catch (error) {
        attempts.push({ sceneId: scene.sceneId, provider, status: "error", error: error.message });
      }
    }
    const materialized = await materializeCandidate({ candidate: selected, scene, out, index: i, maxBytes, allowFixture });
    if (materialized) selections.push(materialized);
  }
  const plan = {
    schemaVersion: 1,
    stage: "free-stock-material-retrieval",
    status: selections.length ? "ready" : "blocked-no-licensed-material",
    providerOrder,
    allowFixture,
    maxDownloadBytes: maxBytes,
    sourceRegistry: registry,
    policy: [
      "Only ingest free/commercial-compatible or user-authorized media.",
      "Record source URL, license, attribution need, download date, and local hash before use.",
      "Treat logos, people, trademarks, government marks, and sensitive contexts as human-review risks.",
      "Fixtures prove the engine path only and are not publication-ready stock footage.",
    ],
    scenes,
    attempts,
  };
  const ledger = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: selections.length ? "ready" : "empty",
    publicationReadiness: selections.every((item) => item.provider !== "fixture")
      ? "needs-human-rights-review-before-publication"
      : "demo-only-fixture-present",
    assets: selections,
  };
  writeJson(join(out, "workflow", "free-stock-material-plan.json"), plan);
  writeJson(join(out, "workflow", "free-stock-asset-ledger.json"), ledger);
  return { plan, ledger };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.brief || !args.out) {
    usage();
    if (!args.help) process.exit(1);
    return;
  }
  const brief = readJson(resolve(ROOT, args.brief));
  const out = resolve(ROOT, args.out);
  ensureDir(join(out, "workflow"));
  const providerOrder = String(args["provider-order"] || brief.freeStockProviderOrder || DEFAULT_PROVIDER_ORDER.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const scenesLimit = Math.max(1, Number(args.scenes || brief.freeStockSceneLimit || 3));
  const allowFixture = Boolean(args["allow-fixture"] || brief.allowFreeStockFixture);
  const maxMb = Number(args["max-download-mb"] || brief.freeStockMaxDownloadMb || 80);
  const maxBytes = Math.max(1, maxMb) * 1024 * 1024;
  const result = await runEngine({ brief, out, providerOrder, scenesLimit, allowFixture, maxBytes });
  console.log(JSON.stringify({
    ok: result.ledger.assets.length > 0,
    out,
    plan: "workflow/free-stock-material-plan.json",
    ledger: "workflow/free-stock-asset-ledger.json",
    assets: result.ledger.assets.map((asset) => asset.normalizedPath),
    publicationReadiness: result.ledger.publicationReadiness,
  }, null, 2));
  if (!result.ledger.assets.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
