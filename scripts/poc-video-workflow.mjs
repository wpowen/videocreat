#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_DURATION = 48;
const MIN_DURATION_SECONDS = 8;
const MELOTTS_ZH_LANGUAGE = "ZH";
const MELOTTS_ZH_DEFAULT_SPEED = "0.95";
const MIN_AUDIBLE_MEAN_DB = -36;
const MIN_AUDIBLE_MAX_DB = -18;
const SHORT_PUNCTUATION_PAUSE_SECONDS = 0.5;
const SENTENCE_END_PAUSE_SECONDS = "tts-default";
const COVER_INTRO_SECONDS = 2;

const palettes = {
  red: { accent: "#d21f2b", wash: "rgba(210,31,43,.28)" },
  ink: { accent: "#111827", wash: "rgba(17,24,39,.18)" },
  blue: { accent: "#1769e0", wash: "rgba(23,105,224,.24)" },
  green: { accent: "#087f5b", wash: "rgba(8,127,91,.24)" },
  purple: { accent: "#7c3aed", wash: "rgba(124,58,237,.22)" },
  gold: { accent: "#b45309", wash: "rgba(180,83,9,.24)" },
};

const commandLog = [];

function fileHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function fileExists(path, minSize = 1) {
  try {
    return existsSync(path) && statSync(path).size >= minSize;
  } catch {
    return false;
  }
}

function mediaDurationSeconds(path) {
  if (!fileExists(path, 1)) return 0;
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    path,
  ], { encoding: "utf8" });
  const value = Number(String(result.stdout || "").trim());
  return Number.isFinite(value) ? value : 0;
}

function readJsonIfExists(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function commandCategory(cmd, args) {
  const line = `${cmd} ${args.join(" ")}`;
  if (/cosyvoice|melo|say\b/.test(line)) return "tts";
  if (/qlmanage|sips/.test(line)) return "frame-raster";
  if (/blackdetect|volumedetect|silencedetect|ffprobe/.test(line)) return "qc";
  if (/screenshots|frames:v\s+1|-ss\b/.test(line)) return "screenshots";
  if (/ffmpeg/.test(line) && /concat|libx264|shortest|rawvideo/.test(line)) return "video-render";
  if (/ffmpeg/.test(line) && /sine|amix|loudnorm|mp3lame|aac|atrim/.test(line)) return "audio-post";
  return "other";
}

function writeTimingSummary(out) {
  const byCategory = new Map();
  for (const entry of commandLog) {
    const category = entry.category || "other";
    const prev = byCategory.get(category) || { commands: 0, durationMs: 0, failures: 0, cacheHits: 0 };
    prev.commands += 1;
    prev.durationMs += Number(entry.durationMs || 0);
    if (entry.status !== 0) prev.failures += 1;
    if (entry.cacheHit) prev.cacheHits += 1;
    byCategory.set(category, prev);
  }
  const categories = Object.fromEntries([...byCategory.entries()].map(([name, value]) => [
    name,
    { ...value, durationSeconds: Number((value.durationMs / 1000).toFixed(3)) },
  ]));
  writeJson(join(out, "workflow", "timing-summary.json"), {
    generatedAt: new Date().toISOString(),
    totalCommands: commandLog.length,
    totalDurationMs: commandLog.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0),
    categories,
    slowestCommands: [...commandLog]
      .sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))
      .slice(0, 12)
      .map((entry) => ({
        category: entry.category,
        durationMs: entry.durationMs,
        durationSeconds: Number((Number(entry.durationMs || 0) / 1000).toFixed(3)),
        status: entry.status,
        cacheHit: Boolean(entry.cacheHit),
        command: entry.command,
      })),
  });
}

function usage() {
  console.log(`Usage:
  poc-video-workflow.mjs --brief <brief.json> --out <dir> [--mode recommended|fallback] [--duration seconds]
    [--voice-backend auto|cosyvoice_local|melotts_local|say] [--allow-say-fallback]
    [--speech-style auto|conversational|tutorial|explainer|story|news|product|documentary]
    [--image-source local|image2-dryrun|image2] [--cover-only] [--allow-degraded-renderer]
    [--no-open-delivery-page]
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

function fail(message) {
  console.error(`[codex-video-workflow] ${message}`);
  process.exit(1);
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

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "n/a";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function localFileHref(out, relativePath) {
  return pathToFileURL(join(out, relativePath)).href;
}

function relativeHref(relativePath) {
  return String(relativePath || "").split("/").map(encodeURIComponent).join("/");
}

function fileInfo(out, relativePath) {
  const abs = join(out, relativePath);
  try {
    const stat = statSync(abs);
    return {
      exists: true,
      isDirectory: stat.isDirectory(),
      size: stat.isDirectory() ? null : stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch {
    return { exists: false, isDirectory: false, size: null, modifiedAt: null };
  }
}

function readTextFile(out, relativePath, maxChars = 12000) {
  try {
    const text = readFileSync(join(out, relativePath), "utf8");
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n...[truncated in delivery page]` : text;
  } catch {
    return "";
  }
}

function uniqueByPath(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.path || seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

function collectDeliveryAssets(out, manifest, coverDesign) {
  const files = manifest?.files || {};
  const assets = [
    { group: "Final", label: "Final MP4", path: manifest?.finalMp4 },
    { group: "Final", label: "Browser preview copy", path: manifest?.finalCopy },
    { group: "Final", label: "Delivery page", path: "delivery.html" },
    { group: "Script", label: "Narration", path: files.narration },
    { group: "Script", label: "Spoken narration", path: files.spokenNarration },
    { group: "Script", label: "Storyboard", path: files.storyboard },
    { group: "Script", label: "Subtitles", path: files.subtitles },
    { group: "Design", label: "Design plan", path: files.designPlan },
    { group: "Design", label: "Quality consistency contract", path: "workflow/quality-consistency-contract.json" },
    { group: "Design", label: "Image prompts", path: files.image2Prompts },
    { group: "Design", label: "Visual assets", path: files.visualAssets },
    { group: "Cover", label: "Cover design", path: files.coverDesign },
    { group: "Cover", label: "Video opening cover", path: files.videoInternalCover || coverDesign?.videoInternalCover?.file },
    { group: "Cover", label: "Cover folder", path: files.covers },
    { group: "Evidence", label: "QC result", path: files.qc },
    { group: "Evidence", label: "Scorecard", path: files.scorecard },
    { group: "Evidence", label: "Sync plan", path: files.syncPlan },
    { group: "Evidence", label: "Voice direction", path: files.voiceDirection },
    { group: "Evidence", label: "Voice subtitle manifest", path: "workflow/voice-subtitle-manifest.json" },
    { group: "Evidence", label: "Content presentation design", path: "workflow/content-presentation-design.json" },
    { group: "Evidence", label: "Motion template selection", path: "workflow/motion-template-selection.json" },
    { group: "Evidence", label: "Authorization", path: files.authorization },
    { group: "Evidence", label: "Manifest", path: "delivery-manifest.json" },
    { group: "Evidence", label: "Command log", path: "workflow/commands.json" },
    { group: "Evidence", label: "Timing summary", path: "workflow/timing-summary.json" },
    { group: "Logs", label: "FFprobe metadata", path: "logs/ffprobe.json" },
    { group: "Logs", label: "Volume detect", path: "logs/volumedetect.log" },
    { group: "Logs", label: "Black detect", path: "logs/blackdetect.log" },
    { group: "Logs", label: "Silence detect", path: "logs/silencedetect.log" },
    { group: "Screenshots", label: "Screenshot folder", path: "screenshots/" },
  ];
  for (const file of files.standaloneCovers || []) {
    assets.push({ group: "Cover", label: `Standalone cover ${file.split("/").pop()}`, path: file });
  }
  try {
    for (const file of readdirSync(join(out, "screenshots")).filter((item) => /\.(png|jpe?g|webp)$/i.test(item)).sort()) {
      assets.push({ group: "Screenshots", label: file, path: `screenshots/${file}` });
    }
  } catch {
    // Screenshots are absent for cover-only packages and failed render attempts.
  }
  return uniqueByPath(assets.filter((asset) => asset.path));
}

function openDeliveryPage(pagePath, args) {
  if (args["no-open-delivery-page"] || process.env.CI) return false;
  const href = pathToFileURL(pagePath).href;
  if (process.platform === "darwin") {
    return run("open", [href], { cwd: dirname(pagePath), check: false, timeout: 30_000 }).status === 0;
  }
  if (process.platform === "win32") {
    return run("cmd", ["/c", "start", "", href], { cwd: dirname(pagePath), check: false, timeout: 30_000 }).status === 0;
  }
  return run("xdg-open", [href], { cwd: dirname(pagePath), check: false, timeout: 30_000 }).status === 0;
}

function run(cmd, args, options = {}) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || ROOT,
    encoding: "utf8",
    env: options.env || process.env,
    stdio: options.stdio || "pipe",
    timeout: options.timeout || 900_000,
  });
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedMs;
  commandLog.push({
    command: `${cmd} ${args.map((arg) => String(arg).includes(" ") ? JSON.stringify(arg) : String(arg)).join(" ")}`,
    cwd: options.cwd || ROOT,
    category: options.category || commandCategory(cmd, args.map(String)),
    startedAt,
    finishedAt,
    durationMs,
    status: result.status,
    signal: result.signal,
    stdout: (result.stdout || "").slice(-4000),
    stderr: (result.stderr || "").slice(-4000),
  });
  if (result.status !== 0 && options.check !== false) {
    throw new Error(`${cmd} ${args.join(" ")} failed\n${result.stderr || result.stdout || ""}`);
  }
  return result;
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assetActionsHtml(out, asset) {
  const info = fileInfo(out, asset.path);
  const fileHref = localFileHref(out, asset.path);
  const relHref = relativeHref(asset.path);
  const openLabel = info.isDirectory ? "Open folder" : "Open";
  const download = info.exists && !info.isDirectory
    ? `<a class="ghost" href="${esc(relHref)}" download>Download</a>`
    : "";
  return `<article class="asset-row ${info.exists ? "" : "missing"}">
    <div>
      <div class="asset-group">${esc(asset.group)}</div>
      <h4>${esc(asset.label)}</h4>
      <p>${esc(asset.path)}</p>
      <code>${esc(join(out, asset.path))}</code>
    </div>
    <div class="asset-meta">
      <span>${info.exists ? "Available" : "Missing"}</span>
      <span>${info.isDirectory ? "Folder" : formatBytes(info.size)}</span>
      <a href="${esc(fileHref)}" target="_blank" rel="noreferrer">${openLabel}</a>
      ${download}
    </div>
  </article>`;
}

function coverGalleryHtml(out, coverDesign) {
  const variants = uniqueByPath([
    coverDesign?.videoInternalCover ? {
      label: "Video opening cover",
      path: coverDesign.videoInternalCover.file,
      ratio: coverDesign.videoInternalCover.ratio,
      usage: "in-video",
    } : null,
    ...(Array.isArray(coverDesign?.platformVariants) ? coverDesign.platformVariants.map((variant) => ({
      label: variant.platform || variant.id,
      path: variant.file,
      ratio: variant.ratio,
      usage: variant.usage,
    })) : []),
  ].filter(Boolean));
  if (!variants.length) return `<div class="empty">No cover variants were recorded.</div>`;
  return variants.map((variant) => {
    const info = fileInfo(out, variant.path);
    return `<figure class="cover-card">
      <a href="${esc(localFileHref(out, variant.path))}" target="_blank" rel="noreferrer">
        ${info.exists ? `<img src="${esc(relativeHref(variant.path))}" alt="${esc(variant.label)}" />` : `<div class="cover-missing">Missing</div>`}
      </a>
      <figcaption>
        <strong>${esc(variant.label)}</strong>
        <span>${esc(variant.ratio || "ratio n/a")} · ${esc(variant.usage || "usage n/a")}</span>
        <code>${esc(variant.path)}</code>
      </figcaption>
    </figure>`;
  }).join("\n");
}

function sceneListHtml(frames) {
  if (!Array.isArray(frames) || !frames.length) return `<div class="empty">No scene timing available.</div>`;
  let cursor = 0;
  return frames.map((frame, index) => {
    const start = cursor;
    cursor += Number(frame.durationSec || 0);
    return `<li>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${esc(frame.label || frame.id)}</strong>
        <p>${esc((frame.headline || []).join(" / "))}</p>
        <small>${start.toFixed(2)}s - ${cursor.toFixed(2)}s</small>
      </div>
    </li>`;
  }).join("\n");
}

function writeDeliveryPage({ out, brief, manifest, qc = null, frames = [], renderer, voiceBackend, imageSource }) {
  const coverDesign = readJsonIfExists(join(out, "workflow", "cover-design.json")) || {};
  const designPlan = readJsonIfExists(join(out, "workflow", "design-plan.json")) || {};
  const voiceManifest = readJsonIfExists(join(out, "workflow", "voice-subtitle-manifest.json")) || {};
  const timingSummary = readJsonIfExists(join(out, "workflow", "timing-summary.json")) || {};
  const assets = collectDeliveryAssets(out, manifest, coverDesign);
  const narrationText = readTextFile(out, "script/narration.txt");
  const spokenText = readTextFile(out, "script/narration-spoken.txt");
  const subtitlesText = readTextFile(out, "script/subtitles.srt");
  const storyboardText = readTextFile(out, "script/storyboard.md");
  const hasVideo = Boolean(manifest?.finalCopy && fileInfo(out, manifest.finalCopy).exists);
  const status = qc ? (qc.pass ? "QC PASS" : "QC FAIL") : (manifest?.mode === "cover-only" ? "COVER PACKAGE" : "READY");
  const pagePath = join(out, "delivery.html");
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(brief.title || "Video Delivery")}</title>
<style>
  :root {
    color-scheme: light;
    --ink: #171411;
    --muted: #6f655a;
    --paper: #f6f0e6;
    --surface: #fffdf8;
    --line: #231f1a;
    --accent: #d21f2b;
    --blue: #1769e0;
    --green: #087f5b;
    --shadow: rgba(23, 20, 17, .12);
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    color: var(--ink);
    background:
      linear-gradient(90deg, rgba(23,20,17,.045) 1px, transparent 1px) 0 0 / 56px 56px,
      linear-gradient(0deg, rgba(23,20,17,.035) 1px, transparent 1px) 0 0 / 56px 56px,
      var(--paper);
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
    letter-spacing: 0;
  }
  a { color: inherit; }
  .shell { width: min(1480px, calc(100vw - 48px)); margin: 0 auto; padding: 34px 0 56px; }
  .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 900; }
  .brand-mark { width: 42px; height: 42px; display: grid; place-items: center; color: #fffdf8; background: var(--ink); border: 3px solid var(--ink); box-shadow: 6px 6px 0 var(--shadow); }
  .status { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  .pill { border: 2px solid var(--ink); background: var(--surface); padding: 9px 12px; font-weight: 850; box-shadow: 4px 4px 0 var(--shadow); }
  .pill.pass { background: var(--green); color: #fffdf8; }
  .pill.fail { background: var(--accent); color: #fffdf8; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(360px, .65fr); gap: 26px; align-items: stretch; }
  .video-panel, .summary-panel, .section, .asset-row, .cover-card { background: var(--surface); border: 3px solid var(--ink); box-shadow: 10px 10px 0 var(--shadow); }
  .video-panel { padding: 16px; }
  video { width: 100%; aspect-ratio: 16 / 9; display: block; background: #111; border: 2px solid var(--ink); }
  .no-video { aspect-ratio: 16 / 9; display: grid; place-items: center; background: #211d19; color: #fffdf8; font-weight: 900; border: 2px solid var(--ink); }
  .summary-panel { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
  h1 { margin: 0; font-size: clamp(42px, 6vw, 92px); line-height: .95; max-width: 980px; letter-spacing: 0; }
  h2 { margin: 0 0 18px; font-size: 30px; line-height: 1; }
  h3 { margin: 0 0 10px; font-size: 20px; }
  p { margin: 0; line-height: 1.55; }
  code { display: block; margin-top: 8px; color: var(--muted); font-size: 12px; word-break: break-all; white-space: normal; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .metric { border: 2px solid var(--ink); padding: 14px; background: #fffaf0; }
  .metric strong { display: block; font-size: clamp(20px, 1.8vw, 26px); line-height: 1.05; margin-bottom: 7px; overflow-wrap: anywhere; word-break: break-word; }
  .metric span { color: var(--muted); font-weight: 750; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .button, .asset-meta a { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 0 14px; background: var(--ink); color: #fffdf8; text-decoration: none; font-weight: 850; border: 2px solid var(--ink); }
  .button.secondary, .asset-meta .ghost { background: var(--surface); color: var(--ink); }
  .section { margin-top: 28px; padding: 24px; }
  .cover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
  .cover-card { padding: 12px; margin: 0; }
  .cover-card img, .cover-missing { width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #f3eadc; border: 2px solid var(--ink); }
  .cover-missing { display: grid; place-items: center; color: var(--accent); font-weight: 900; }
  figcaption { display: grid; gap: 5px; margin-top: 10px; }
  figcaption span { color: var(--muted); font-size: 13px; font-weight: 750; }
  .asset-list { display: grid; gap: 12px; }
  .asset-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; padding: 16px; align-items: center; }
  .asset-row.missing { opacity: .55; }
  .asset-group { color: var(--accent); font-size: 12px; font-weight: 950; text-transform: uppercase; }
  .asset-row h4 { margin: 4px 0; font-size: 18px; }
  .asset-row p { color: var(--muted); font-size: 14px; }
  .asset-meta { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; align-items: center; min-width: 260px; }
  .asset-meta span { border: 2px solid var(--ink); padding: 8px 10px; font-size: 12px; font-weight: 850; background: #fffaf0; }
  .script-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  details { border: 2px solid var(--ink); background: #fffaf0; padding: 14px; }
  summary { cursor: pointer; font-weight: 900; }
  pre { max-height: 360px; overflow: auto; white-space: pre-wrap; word-break: break-word; line-height: 1.6; margin: 14px 0 0; font-size: 14px; }
  .scene-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .scene-list li { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 12px; border-bottom: 1px solid rgba(23,20,17,.18); padding-bottom: 10px; }
  .scene-list li span { width: 36px; height: 36px; display: grid; place-items: center; background: var(--accent); color: #fffdf8; font-weight: 950; }
  .scene-list small { color: var(--muted); }
  .empty { border: 2px dashed rgba(23,20,17,.35); padding: 20px; color: var(--muted); background: rgba(255,253,248,.5); }
  @media (max-width: 980px) {
    .shell { width: min(100vw - 28px, 1480px); padding-top: 18px; }
    .hero, .script-grid { grid-template-columns: 1fr; }
    .topbar, .asset-row { grid-template-columns: 1fr; display: grid; }
    .status, .asset-meta { justify-content: flex-start; }
    h1 { font-size: 44px; }
  }
</style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">VC</div><div>Video Delivery Package</div></div>
      <div class="status">
        <span class="pill ${qc?.pass ? "pass" : qc ? "fail" : ""}">${esc(status)}</span>
        <span class="pill">${esc(renderer || manifest?.renderer || "renderer n/a")}</span>
        <span class="pill">${esc(imageSource || manifest?.imageSource || "image n/a")}</span>
      </div>
    </header>

    <section class="hero">
      <div class="video-panel">
        ${hasVideo ? `<video controls preload="metadata" poster="${esc(relativeHref(manifest.files?.videoInternalCover || "cover/cover-video-opening-16x9.svg"))}" src="${esc(relativeHref(manifest.finalCopy))}"></video>` : `<div class="no-video">Cover-only package · no final MP4</div>`}
      </div>
      <aside class="summary-panel">
        <div>
          <h1>${esc(brief.title || "Untitled Video")}</h1>
          <p>${esc(brief.objective || brief.goal || "本页汇总本次视频生成的最终产物、稿件、封面、质量证据和本地文件位置。")}</p>
        </div>
        <div class="meta-grid">
          <div class="metric"><strong>${esc((qc?.duration || manifest?.durationSeconds || "n/a").toString())}</strong><span>Final seconds</span></div>
          <div class="metric"><strong>${esc(voiceBackend || voiceManifest.voiceBackend || "n/a")}</strong><span>Voice backend</span></div>
          <div class="metric"><strong>${esc(designPlan.videoType || manifest?.designTemplate || "n/a")}</strong><span>Video type</span></div>
          <div class="metric"><strong>${esc(timingSummary.totalCommands ?? "n/a")}</strong><span>Recorded commands</span></div>
        </div>
        <div class="actions">
          ${hasVideo ? `<a class="button" href="${esc(localFileHref(out, manifest.finalMp4 || manifest.finalCopy))}" target="_blank" rel="noreferrer">Open final video</a>` : ""}
          <a class="button secondary" href="${esc(localFileHref(out, "delivery-manifest.json"))}" target="_blank" rel="noreferrer">Open manifest</a>
          <a class="button secondary" href="${esc(pathToFileURL(out).href)}" target="_blank" rel="noreferrer">Open output folder</a>
        </div>
        <code>${esc(out)}</code>
      </aside>
    </section>

    <section class="section">
      <h2>Cover And Title Images</h2>
      <div class="cover-grid">${coverGalleryHtml(out, coverDesign)}</div>
    </section>

    <section class="section">
      <h2>Script And Captions</h2>
      <div class="script-grid">
        <details open><summary>原始稿件 script/narration.txt</summary><pre>${esc(narrationText)}</pre></details>
        <details><summary>口播稿 script/narration-spoken.txt</summary><pre>${esc(spokenText)}</pre></details>
        <details><summary>字幕 script/subtitles.srt</summary><pre>${esc(subtitlesText)}</pre></details>
        <details><summary>分镜 script/storyboard.md</summary><pre>${esc(storyboardText)}</pre></details>
      </div>
    </section>

    <section class="section">
      <h2>Scenes</h2>
      <ol class="scene-list">${sceneListHtml(frames.length ? frames : designPlan.pages?.map((page) => page.frame) || [])}</ol>
    </section>

    <section class="section">
      <h2>Quality Details</h2>
      <div class="meta-grid">
        <div class="metric"><strong>${esc(qc?.meanVolume ?? "n/a")}</strong><span>Mean volume dB</span></div>
        <div class="metric"><strong>${esc(qc?.maxVolume ?? "n/a")}</strong><span>Max volume dB</span></div>
        <div class="metric"><strong>${esc(qc?.audioVideoDelta ?? "n/a")}</strong><span>Audio/video delta</span></div>
        <div class="metric"><strong>${esc(qc?.longNarrationSilences?.length ?? "n/a")}</strong><span>Long narration silences</span></div>
      </div>
    </section>

    <section class="section">
      <h2>Material Locations</h2>
      <div class="asset-list">${assets.map((asset) => assetActionsHtml(out, asset)).join("\n")}</div>
    </section>
  </main>
</body>
</html>`;
  write(pagePath, html);
  return pagePath;
}

function clampDuration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DURATION;
  return Math.max(MIN_DURATION_SECONDS, Math.round(n));
}

function estimateAutoDuration({ narration, frames, brief }) {
  const text = String(narration || "").trim();
  const zhChars = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const nonZh = text.replace(/[\u3400-\u9fff\s]/g, "").length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const speechSeconds = zhChars
    ? zhChars / 4.1 + nonZh / 8
    : words / 2.45;
  const sceneSeconds = Math.max(0, (frames?.length || 0) * 1.2);
  const requestedDepth = /(完整|详细|深入|教程|历史|long|complete|detailed|deep|tutorial|history)/i.test(`${brief?.title || ""} ${brief?.objective || ""} ${brief?.goal || ""}`)
    ? 10
    : 0;
  return clampDuration(Math.ceil((speechSeconds + sceneSeconds + requestedDepth + 4) / 5) * 5);
}

function normalizeFrames(brief, duration) {
  const raw = Array.isArray(brief.scenes) && brief.scenes.length >= 3 ? brief.scenes : [];
  const frames = raw.slice(0, 8).map((scene, index) => ({
    id: scene.id || `scene-${index + 1}`,
    label: scene.label || `Scene ${index + 1}`,
    kicker: scene.kicker || `${String(index + 1).padStart(2, "0")} / POINT`,
    headline: Array.isArray(scene.headline) ? scene.headline.slice(0, 3) : [scene.headline || scene.label || `Scene ${index + 1}`],
    stat: scene.stat || String(index + 1),
    body: scene.body || scene.subtitle || "",
    subtitle: scene.subtitle || scene.body || "",
    narration: scene.narration || scene.voiceover || "",
    palette: palettes[scene.palette] ? scene.palette : Object.keys(palettes)[index % Object.keys(palettes).length],
  }));
  if (!frames.length) fail("Brief must contain at least three scenes for this video workflow.");
  const total = Math.max(MIN_DURATION_SECONDS, Number(duration) || DEFAULT_DURATION);
  let cursor = 0;
  return frames.map((frame, index) => {
    const next = index === frames.length - 1
      ? total
      : Number((((index + 1) * total) / frames.length).toFixed(3));
    const durationSec = Number((next - cursor).toFixed(3));
    cursor = next;
    return { ...frame, durationSec };
  });
}

function textComparable(value) {
  return String(value || "").replace(/\s+/g, "");
}

function frameNarrationSegments(narration, frames) {
  const expected = textComparable(narration);
  const explicit = frames.map((frame, index) => ({
    index: index + 1,
    frameId: frame.id,
    label: frame.label,
    text: String(frame.narration || "").trim(),
  }));
  const explicitText = explicit.map((segment) => segment.text).join("");
  if (explicit.every((segment) => segment.text) && textComparable(explicitText) === expected) {
    return explicit;
  }

  const sentences = splitSentences(narration);
  if (!sentences.length) {
    throw new Error("Cannot build frame-bound narration segments: narration has no sentence boundaries.");
  }
  if (sentences.length < frames.length) {
    throw new Error(`Cannot bind audio to ${frames.length} visual frames from only ${sentences.length} spoken sentences. Add per-scene narration fields or reduce scenes.`);
  }

  const counts = Array.from({ length: frames.length }, () => Math.floor(sentences.length / frames.length));
  let remainder = sentences.length - counts.reduce((sum, count) => sum + count, 0);
  if (remainder > 0 && counts.length) {
    counts[0] += 1;
    remainder -= 1;
  }
  if (remainder > 0 && counts.length > 1) {
    counts[counts.length - 1] += 1;
    remainder -= 1;
  }
  for (let i = 1; remainder > 0 && i < counts.length - 1; i += 1) {
    counts[i] += 1;
    remainder -= 1;
  }

  let cursor = 0;
  const segments = frames.map((frame, index) => {
    const count = index === frames.length - 1
      ? sentences.length - cursor
      : Math.max(1, counts[index] || 0);
    const text = sentences.slice(cursor, cursor + count).join("");
    cursor += count;
    return {
      index: index + 1,
      frameId: frame.id,
      label: frame.label,
      text,
    };
  });
  const actual = textComparable(segments.map((segment) => segment.text).join(""));
  if (actual !== expected) {
    throw new Error("Frame narration segmentation did not preserve spoken narration exactly.");
  }
  return segments;
}

function applyAudioTimingsToFrames(frames, segmentTimings) {
  if (!Array.isArray(segmentTimings) || segmentTimings.length !== frames.length) {
    throw new Error(`Frame/audio segment count mismatch: ${frames.length} frames vs ${segmentTimings?.length || 0} audio segments`);
  }
  return frames.map((frame, index) => {
    const timing = segmentTimings[index];
    if (timing.frameId !== frame.id) {
      throw new Error(`Frame/audio segment id mismatch at ${index + 1}: ${frame.id} vs ${timing.frameId}`);
    }
    const durationSec = Number(Number(timing.durationSeconds || 0).toFixed(3));
    if (!durationSec || durationSec < 0.1) {
      throw new Error(`Invalid TTS segment duration for ${frame.id}: ${durationSec}`);
    }
    return {
      ...frame,
      durationSec,
      subtitle: timing.text || frame.subtitle,
      spokenText: timing.text || "",
      audioSegment: {
        index: timing.index,
        start: timing.start,
        end: timing.end,
        durationSeconds: timing.durationSeconds,
      },
    };
  });
}

function aspectRatio(width, height) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function coverTargetSpecs(videoWidth = 1920, videoHeight = 1080) {
  const videoRatio = aspectRatio(videoWidth, videoHeight);
  return [
    {
      id: "video-opening",
      platform: "Video opening frame",
      usage: "in-video",
      width: videoWidth,
      height: videoHeight,
      ratio: videoRatio,
      file: `cover/cover-video-opening-${videoRatio.replace(":", "x")}.svg`,
      rule: "Must match the final MP4 aspect ratio; never use platform-cropped upload covers inside the video.",
    },
    {
      id: "youtube-long",
      platform: "YouTube long-form",
      usage: "standalone-upload",
      width: 3840,
      height: 2160,
      ratio: "16:9",
      file: "cover/cover-youtube-16x9.svg",
      rule: "Large 16:9 custom thumbnail; keep hook readable and policy-safe.",
    },
    {
      id: "bilibili-4x3",
      platform: "Bilibili",
      usage: "standalone-upload",
      width: 1440,
      height: 1080,
      ratio: "4:3",
      file: "cover/cover-bilibili-4x3.svg",
      rule: "Bilibili-specific 4:3 composition; reflow the design instead of stretching the video cover.",
    },
    {
      id: "bilibili-16x9-safe",
      platform: "Bilibili",
      usage: "standalone-upload-safe-crop",
      width: 1920,
      height: 1080,
      ratio: "16:9",
      file: "cover/cover-bilibili-16x9-safe.svg",
      rule: "Optional horizontal-safe variant for upload contexts that preview in 16:9.",
    },
    {
      id: "douyin-tiktok-vertical",
      platform: "Douyin / TikTok",
      usage: "standalone-upload-or-cover-frame",
      width: 1080,
      height: 1920,
      ratio: "9:16",
      file: "cover/cover-douyin-tiktok-9x16.svg",
      rule: "Vertical mobile grid cover; keep hook clear of top/bottom app UI crop zones.",
    },
    {
      id: "x-video-match",
      platform: "X",
      usage: "standalone-upload-video-match",
      width: videoWidth,
      height: videoHeight,
      ratio: videoRatio,
      file: `cover/cover-x-video-match-${videoRatio.replace(":", "x")}.svg`,
      rule: "Custom X video thumbnails should match the video aspect ratio.",
    },
    {
      id: "x-square-feed",
      platform: "X",
      usage: "standalone-feed-image",
      width: 1200,
      height: 1200,
      ratio: "1:1",
      file: "cover/cover-x-square.svg",
      rule: "Square feed image variant for posts that need a non-video image card.",
    },
  ];
}

function deriveCoverTexts({ coverPromise, frames, language = "zh" }) {
  const compact = (value, max) => String(value || "")
    .replace(/[：:，,。！？!?；;]/g, " ")
    .replace(/\s+/g, language === "en" ? " " : "")
    .trim()
    .slice(0, max);
  const raw = String(coverPromise || (language === "en" ? "Proof, not just render" : "核心承诺"));
  if (language === "en") {
    const payoffSource = frames.find((frame) => frame.headline?.some((item) => item !== coverPromise))?.headline?.[1]
      || frames[1]?.headline?.[0]
      || "Evidence package";
    return {
      hookText: compact(raw, 28) || "Proof, not just render",
      payoffText: compact(payoffSource, 24) || "Evidence package",
      curiosityGap: "What changes when a video workflow proves the script, timing, visuals, voice, cover, and QC instead of only exporting an MP4?",
      viewerDecision: "Understand in one second: this skill turns a brief into a reviewed, reproducible video package.",
    };
  }
  const hookText = /读者|灵感|承诺/.test(raw) ? "读者不买灵感" : compact(raw, 10);
  const payoffSource = frames.find((frame) => frame.headline?.some((item) => item !== coverPromise))?.headline?.[1]
    || frames[1]?.headline?.[0]
    || "承诺才留人";
  const payoffText = /承诺|读者/.test(String(payoffSource)) ? compact(payoffSource, 9) : "承诺才留人";
  return {
    hookText: hookText || compact(raw, 10) || "核心承诺",
    payoffText: payoffText || "承诺才留人",
    curiosityGap: "为什么宏大设定留不住人，而普通文笔能让读者追下去？",
    viewerDecision: "一秒内看懂：问题不在灵感，而在能不能持续兑现读者情绪。",
  };
}

function coverSvg({ target, coverTexts, language = "zh" }) {
  const { width, height } = target;
  const vertical = height > width * 1.25;
  const squareish = Math.abs(width - height) < Math.min(width, height) * 0.18;
  const margin = Math.round(Math.min(width, height) * (vertical ? 0.075 : 0.065));
  const accent = "#d21f2b";
  const ink = "#171411";
  const paper = "#f7f3eb";
  const hookChars = language === "en" ? (vertical ? 10 : squareish ? 12 : 18) : vertical ? 5 : squareish ? 6 : 8;
  const hookLines = splitSvgLines(coverTexts.hookText, hookChars, vertical ? 3 : 2);
  const payoffLines = splitSvgLines(coverTexts.payoffText, language === "en" ? (vertical ? 10 : 16) : vertical ? 5 : 8, 2);
  const hookSize = Math.round(Math.min(width / (language === "en" ? (vertical ? 5.2 : squareish ? 6.2 : 8.8) : vertical ? 4.7 : squareish ? 5.1 : 7.6), height * (vertical ? 0.08 : 0.15)));
  const payoffSize = Math.round(Math.min(width / (vertical ? 7.5 : 11), height * 0.055));
  const motifSize = Math.round(Math.min(width, height) * (vertical ? 0.25 : 0.22));
  const motifCx = vertical || squareish ? width * 0.5 : width * 0.76;
  const motifCy = vertical ? height * 0.67 : squareish ? height * 0.68 : height * 0.47;
  const hookX = vertical || squareish ? margin : width * 0.08;
  const hookY = vertical ? height * 0.18 : squareish ? height * 0.19 : height * 0.28;
  const payoffX = hookX;
  const payoffY = hookY + hookLines.length * hookSize * 1.18 + height * 0.055;
  const ribbonY = vertical ? height * 0.08 : height * 0.1;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${paper}"/>
  <g opacity=".24" stroke="#d8cdbb" stroke-width="${Math.max(2, Math.round(Math.min(width, height) / 520))}">
    ${Array.from({ length: 18 }, (_, i) => `<path d="M${i * width / 8 - width} 0 L${i * width / 8} ${height}"/>`).join("")}
  </g>
  <rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" rx="${Math.min(width, height) * 0.025}" fill="#fffdf8" stroke="${ink}" stroke-width="${Math.max(5, Math.round(Math.min(width, height) / 190))}"/>
  <rect x="${margin}" y="${ribbonY}" width="${Math.min(width - margin * 2, width * (vertical ? 0.72 : 0.42))}" height="${Math.max(16, height * 0.025)}" fill="${accent}"/>
  <text x="${hookX}" y="${ribbonY + height * 0.06}" font-size="${Math.max(22, Math.round(height * 0.028))}" font-weight="850" fill="${accent}" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif">${language === "en" ? "Not just a render" : "不是设定问题"}</text>
  ${svgText(hookLines, hookX, hookY, hookSize, ink, "950", Math.round(hookSize * 1.05))}
  <rect x="${payoffX}" y="${payoffY - payoffSize * 0.88}" width="${Math.min(width - margin * 2, width * (vertical ? 0.78 : 0.42))}" height="${payoffSize * (payoffLines.length + 0.75)}" rx="${payoffSize * 0.35}" fill="${ink}"/>
  ${svgText(payoffLines, payoffX + payoffSize * 0.55, payoffY, payoffSize, "#fffdf8", "850", Math.round(payoffSize * 1.12))}
  <g transform="translate(${motifCx} ${motifCy})">
    <circle cx="0" cy="0" r="${motifSize}" fill="${accent}" stroke="${ink}" stroke-width="${Math.max(5, Math.round(motifSize / 28))}"/>
    <circle cx="0" cy="0" r="${motifSize * 0.62}" fill="#fffdf8" stroke="${ink}" stroke-width="${Math.max(4, Math.round(motifSize / 45))}"/>
    <text x="0" y="${-motifSize * 0.1}" text-anchor="middle" font-size="${motifSize * (language === "en" ? 0.23 : 0.32)}" font-weight="950" fill="${ink}" font-family="PingFang SC, sans-serif">${language === "en" ? "PROOF" : "承诺"}</text>
    <text x="0" y="${motifSize * 0.24}" text-anchor="middle" font-size="${motifSize * (language === "en" ? 0.13 : 0.17)}" font-weight="850" fill="${accent}" font-family="PingFang SC, sans-serif">${language === "en" ? "QC" : "兑现"}</text>
    <path d="M${-motifSize * 0.95} ${motifSize * 0.78} L${motifSize * 0.95} ${-motifSize * 0.78}" stroke="${ink}" stroke-width="${Math.max(7, Math.round(motifSize / 24))}" stroke-linecap="round"/>
  </g>
  <text x="${hookX}" y="${height - margin * 1.55}" font-size="${Math.max(18, Math.round(height * 0.025))}" font-weight="760" fill="#5c5044" font-family="PingFang SC, sans-serif">${language === "en" ? "Brief · Voice · Motion · Cover · QC" : "情绪合同 · 压力 · 选择 · 代价"}</text>
</svg>
`;
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
}

function subtitles(frames, startOffset = 0) {
  let cursor = startOffset;
  return frames.map((frame, index) => {
    const start = cursor;
    const end = cursor + frame.durationSec;
    cursor = end;
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${frame.subtitle}\n`;
  }).join("\n");
}

function storyboard(frames, startOffset = 0) {
  let cursor = startOffset;
  const rows = frames.map((frame) => {
    const start = cursor;
    cursor += frame.durationSec;
    return `| ${start.toFixed(1)}-${cursor.toFixed(1)} | ${frame.label} | ${frame.headline.join(" / ")} | ${frame.subtitle} |`;
  }).join("\n");
  return `# Storyboard\n\n| Time | Scene | Visual text | Subtitle |\n| --- | --- | --- | --- |\n${rows}\n`;
}

const DESIGN_TEMPLATES = {
  "writing-method": {
    id: "writing-method",
    label: "小说写作方法视频",
    visualLanguage: "editorial-story-lab",
    motionLanguage: "paper-depth, evidence-board, kinetic annotations, slow push-in",
    palette: ["#171411", "#f7f3eb", "#d21f2b", "#1769e0", "#087f5b", "#b45309"],
    shots: [
      { template: "cold-open-anomaly", imageRole: "cinematic manuscript anomaly", camera: "fast parallax push-in" },
      { template: "doorway-inciting-image", imageRole: "story opening visual metaphor", camera: "door reveal with paper wipe" },
      { template: "conflict-triangle-board", imageRole: "diagrammatic plot board", camera: "node cascade" },
      { template: "chapter-question-thread", imageRole: "suspense thread board", camera: "question mark rack-focus" },
      { template: "twist-rewrite-lens", imageRole: "old scene reinterpreted by new clue", camera: "lens sweep" },
      { template: "edit-desk-three-cuts", imageRole: "editing desk with cut marks", camera: "three decisive cuts" },
    ],
  },
  "tutorial-explainer": {
    id: "tutorial-explainer",
    label: "教程解释视频",
    visualLanguage: "demonstration-layers",
    motionLanguage: "problem-demo, process map, checklist, proof frame",
    palette: ["#101827", "#f4f0e8", "#35d4ff", "#f0b23d", "#6ed16d"],
    shots: [
      { template: "problem-closeup", imageRole: "problem moment", camera: "quick reveal" },
      { template: "method-map", imageRole: "workflow diagram", camera: "left-to-right build" },
      { template: "checklist-proof", imageRole: "finished result board", camera: "settle and resolve" },
    ],
  },
  "professional-explainer": {
    id: "professional-explainer",
    label: "专业解释视频",
    visualLanguage: "evidence-board",
    motionLanguage: "cinematic title, evidence cards, restrained transitions",
    palette: ["#111318", "#f4f0e8", "#1769e0", "#d21f2b", "#087f5b"],
    shots: [
      { template: "claim-evidence", imageRole: "evidence visual", camera: "slow push" },
      { template: "process-board", imageRole: "structured process", camera: "card cascade" },
      { template: "summary-rule", imageRole: "final operating rule", camera: "resolve" },
    ],
  },
};

function inferVideoType(brief, frames) {
  const explicit = String(brief.videoType || brief.type || "").trim();
  if (DESIGN_TEMPLATES[explicit]) return explicit;
  const text = `${brief.title || ""} ${brief.objective || ""} ${brief.audience || ""} ${frames.map((frame) => `${frame.label} ${frame.body} ${frame.headline.join(" ")}`).join(" ")}`;
  if (/小说|网文|写作|章节|悬念|反转|文笔|剧情|主角/.test(text)) return "writing-method";
  if (/教程|步骤|怎么|方法|workflow|how to/i.test(text)) return "tutorial-explainer";
  return "professional-explainer";
}

function visualRoleForFrame(type, frame, index, total) {
  if (type === "writing-method") {
    if (index === 0) return "hook";
    if (/开头|第一秒|门|葬礼/.test(`${frame.label} ${frame.headline.join("")}`)) return "opening-anomaly";
    if (/冲突|欲望|阻碍|倒计时/.test(`${frame.label} ${frame.headline.join("")}`)) return "conflict-system";
    if (/章节|悬念|问题/.test(`${frame.label} ${frame.headline.join("")}`)) return "chapter-question";
    if (/反转|重写|新信息/.test(`${frame.label} ${frame.headline.join("")}`)) return "twist-rewrite";
    if (/删|检查|三刀|编辑/.test(`${frame.label} ${frame.headline.join("")}`)) return "edit-pass";
  }
  if (index === 0) return "hook";
  if (index === total - 1) return "summary";
  return "method-step";
}

function image2PromptForPage(template, page, brief) {
  if (template.id === "writing-method") {
    return [
      "生成一张 16:9 横版专业短视频插图，风格为中文小说编辑部的电影感写作实验室。",
      "画面要像视频镜头素材，不要像 PPT：有前景纸张、桌面景深、批注线、线索节点、少量动态感构图。",
      `场景角色：${page.visualRole}。主题：${page.frame.headline.join(" / ")}。`,
      `叙事用途：${page.imageRole}。`,
      "不要真实人物肖像，不要名人，不要商标，不要密集小字，不要平台 UI。",
      "画面留出左侧或下方安全区，方便叠加中文大标题和字幕。",
    ].join("");
  }
  return [
    "Generate a 16:9 professional short-video illustration, cinematic infographic style, not a presentation slide.",
    `Topic: ${page.frame.headline.join(" / ")}. Video: ${brief.title || "explainer"}.`,
    `Scene role: ${page.visualRole}. Asset role: ${page.imageRole}.`,
    "Use clear depth layers and leave safe area for overlaid title/captions. No likenesses, logos, dense small text, or platform UI.",
  ].join(" ");
}

function buildDesignPlan({ brief, frames, imageSource }) {
  const videoType = inferVideoType(brief, frames);
  const template = DESIGN_TEMPLATES[videoType] || DESIGN_TEMPLATES["professional-explainer"];
  const aestheticDirection = buildAestheticDirection({ brief, template, videoType });
  const pages = frames.map((frame, index) => {
    const shot = template.shots[index % template.shots.length];
    const visualRole = visualRoleForFrame(template.id, frame, index, frames.length);
    const page = {
      id: frame.id,
      sceneIndex: index + 1,
      durationSec: frame.durationSec,
      shotTemplate: shot.template,
      visualRole,
      imageRole: shot.imageRole,
      layout: template.visualLanguage,
      camera: shot.camera,
      insertMode: index % 2 === 0 ? "foreground-illustration-with-title-overlay" : "background-illustration-with-evidence-cards",
      motion: {
        entrance: index === 0 ? "cold-open-pop" : "paper-wipe",
        emphasis: visualRole === "twist-rewrite" ? "lens-sweep" : visualRole === "conflict-system" ? "node-cascade" : "annotation-pop",
        transition: index === frames.length - 1 ? "rule-resolve" : "page-turn",
      },
      language: brief.language || "zh",
      frame,
    };
    return {
      ...page,
      image2Prompt: image2PromptForPage(template, page, brief),
      imageAsset: `assets/visuals/${String(index + 1).padStart(2, "0")}-${frame.id}.svg`,
      image2Asset: `assets/image2/${String(index + 1).padStart(2, "0")}-${frame.id}.png`,
    };
  });
  return {
    stage: "design-planning",
    purpose: "Choose video type, visual templates, illustration prompts, inserted assets, and motion language before rendering.",
    videoType,
    imageSource,
    templateKit: {
      id: template.id,
      label: template.label,
      visualLanguage: template.visualLanguage,
      motionLanguage: template.motionLanguage,
      palette: template.palette,
    },
    aestheticDirection,
    rules: [
      "Video must not be only text cards; each scene needs an inserted illustration or visual metaphor layer.",
      "Image prompts are image2-compatible and rights-safe; local SVG fallback remains deterministic.",
      "Captions stay in a safe area and must not cover the primary illustration.",
      "Aesthetic direction is a first-class gate: palette, typography, composition, imagery, and motion must feel intentional, not default.",
    ],
    pages,
  };
}

function buildMotionTemplateSelection(designPlan) {
  const videoType = designPlan.videoType || "professional-explainer";
  const writing = videoType === "writing-method";
  const processLike = /model|workflow|tutorial|process/i.test(`${videoType} ${designPlan.templateKit?.label || ""}`);
  const selectedTemplate = processLike
    ? "semantic-timeline-reveal"
    : writing
      ? "interactive-proof-board"
      : "kinetic-editorial-explainer";
  const implementationPath = {
    "semantic-timeline-reveal": "templates/html-motion/semantic-timeline-reveal.html",
    "interactive-proof-board": "templates/html-motion/interactive-proof-board.html",
    "kinetic-editorial-explainer": "templates/html-motion/kinetic-editorial-explainer.html",
  }[selectedTemplate];
  return {
    selectedTemplate,
    registry: "templates/html-motion/motion-template-registry.json",
    sourcePlatformLogic: "local CSS keyframes + SVG + Web Animations API, with GSAP/Motion/Anime.js reserved for documented complex timelines",
    whyThisTemplate: writing
      ? "Writing-method explainers need evidence, pressure, and cause-effect relationships to feel inspected rather than presented as static slides."
      : processLike
        ? "Process/model content needs visible progress and active beat changes tied to the shared timecode plan."
        : "A premium explainer needs kinetic hierarchy, semantic emphasis, and a strong first-second reveal.",
    motionJobs: {
      entrance: "bring the core hook or evidence object into focus immediately",
      reveal: "show the relationship between headline, visual metaphor, and current script beat",
      emphasis: "use accent motion only on the current idea, not as random decoration",
      transition: "move between scenes with the same design language as the selected template kit",
      exit: "resolve the scene into the next beat without dropping caption readability",
    },
    semanticBinding: "Motion is bound to storyboard/subtitle timing in workflow/sync-timecode-plan.json; long-form runs must bind to ASR or forced-alignment timing.",
    interactionFeeling: "Even in rendered video, the composition should feel responsive through parallax, focus shifts, spring-like entry, or stateful highlight.",
    implementationPath,
    fallbackPolicy: "If the renderer falls back, preserve the same layout system, motion jobs, caption safe area, visual metaphor, and template identity; mark the renderer degraded if motion is reduced.",
    verification: [
      "capture at least opening/middle/ending screenshots",
      "record motion evidence through renderer logs or a motion-difference check",
      "confirm subtitles remain readable during animated states",
    ],
    rejectList: [
      "static card output",
      "random floating decoration",
      "copying third-party demo code or style without license",
      "motion timing unrelated to narration/subtitles",
      "animation that makes exact Chinese text or captions unreadable",
    ],
  };
}

function buildAestheticDirection({ brief, template, videoType }) {
  const isWriting = videoType === "writing-method";
  return {
    status: "active-art-direction",
    source: "planner-inferred plus codex-video-workflow template",
    tasteGoal: isWriting
      ? "让创作者感觉这是一本编辑部手稿被拍成电影，而不是一套教学 PPT。"
      : "Clear, premium explainer visuals with enough depth and pace to hold attention.",
    visualTerritory: isWriting ? "cinematic editorial story lab" : template.visualLanguage,
    moodKeywords: isWriting
      ? ["纸张质感", "深墨批注", "线索板", "电影感桌面", "节制高亮", "留白"]
      : ["premium", "focused", "depth", "clear hierarchy", "controlled contrast"],
    avoid: [
      "纯文字卡片",
      "廉价渐变背景",
      "随机装饰元素",
      "满屏小字",
      "同一版式重复到底",
      "色彩只靠单一色相变化",
      "image2 直接生成最终文字版面",
    ],
    composition: {
      rule: "one focal visual per scene, clear foreground/midground/background, copy occupies a deliberate safe zone",
      focalBalance: "headline and visual metaphor should share attention; neither should look pasted on",
      negativeSpace: "leave at least one calm zone for viewer rest and subtitle readability",
    },
    color: {
      base: ["warm paper", "deep ink"],
      accents: template.palette.slice(2),
      rule: "use accent color as editorial signal, not as full-canvas tint",
      contrast: "caption and main title must stay high contrast on every frame",
    },
    typography: {
      rule: "large expressive CJK display headline, short support line, caption band separate from art",
      maxHeadlineLines: 3,
      avoid: "generic centered poster text on every scene",
    },
    imagery: {
      strategy: "Image2/generative layer owns mood, texture, depth, metaphor; deterministic layer owns exact Chinese text and captions.",
      promptRule: "ask for one cinematic insert asset or scene visual, not a finished slide",
      fallbackRule: "local SVG fallback must still express a scene-specific metaphor",
    },
    motion: {
      rule: "motion should reveal meaning: paper wipe, node cascade, lens sweep, edit cuts, not only fade-in text",
      pacing: "each 5-8 second scene needs entrance, emphasis, and exit intent",
    },
    capabilityRouting: [
      {
        capability: "design",
        useFor: "durable repo-local design source of truth and aesthetic principles",
        when: "workflow-level taste, visual language, tokens, and review criteria need to be maintained",
      },
      {
        capability: "awesome-design-md",
        useFor: "borrowing mature product-style design contracts such as Linear/Stripe/Notion/Vercel",
        when: "a known premium UI/editorial style should anchor the video package",
      },
      {
        capability: "creative-production:moodboard-explorer",
        useFor: "broad visual territory exploration before locking art direction",
        when: "the video style is not yet selected or multiple aesthetic routes are needed",
      },
      {
        capability: "creative-production:shot-explorer",
        useFor: "camera/crop/angle variants from a selected image anchor",
        when: "a hero visual exists but framing needs stronger retention",
      },
      {
        capability: "creative-production:scene-explorer",
        useFor: "contextual scene libraries and image prompt families",
        when: "the subject needs richer environments or visual metaphors",
      },
      {
        capability: "creative-production:generative-polish",
        useFor: "premium texture, lighting, depth, and background polish while preserving exact copy deterministically",
        when: "the base composition is approved and needs final visual finish",
      },
      {
        capability: "visual-ralph / visual-verdict",
        useFor: "measured screenshot/reference iteration and aesthetic gap finding",
        when: "a visual reference exists and the render must match a target quality threshold",
      },
      {
        capability: "GPT Image 2 / image2",
        useFor: "high-polish original insert images, backgrounds, metaphors, and editorial visual texture",
        when: "API credentials and review boundaries are available; exact text remains deterministic",
      },
    ],
  };
}

function buildQualityConsistencyContract({ brief, designPlan, motionSelection }) {
  return {
    schemaVersion: 1,
    status: "required-final-quality-gate",
    qualityProfile: brief.qualityProfile || "premium-consistent-local-video",
    purpose: "Keep every generated video high-quality and internally consistent while allowing topic-specific visual direction.",
    consistencyAnchors: {
      videoType: designPlan.videoType,
      templateKitId: designPlan.templateKit?.id,
      templateKitLabel: designPlan.templateKit?.label,
      motionTemplateId: motionSelection.selectedTemplate,
      motionImplementationPath: motionSelection.implementationPath,
      visualLanguage: designPlan.templateKit?.visualLanguage,
      motionLanguage: designPlan.templateKit?.motionLanguage,
      palette: designPlan.templateKit?.palette || [],
      captionSafeArea: "bottom-caption-band",
      exactTextOwner: "deterministic HTML/SVG/CSS layers only; generated images may not own exact Chinese text",
    },
    hardGates: [
      "rendererNotDegraded",
      "resolution1080p",
      "openingCoverInVideo",
      "frameAudioTimingBound",
      "audibleAudio",
      "narrationContinuityOk",
      "contentPresentationDesignPresent",
      "aestheticCapabilityRoutingPresent",
      "motionTemplateSelectionPresent",
      "insertedVisualAssetsPresent",
      "qualityConsistencyContractEnforced",
    ],
    requiredArtifacts: [
      "workflow/content-presentation-design.json",
      "workflow/aesthetic-brief.json",
      "workflow/aesthetic-quality-rubric.md",
      "workflow/motion-template-selection.json",
      "workflow/design-plan.json",
      "workflow/image2-prompts.json",
      "workflow/visual-asset-manifest.json",
      "workflow/sync-timecode-plan.json",
      "workflow/voice-subtitle-manifest.json",
      "workflow/cover-design.json",
      "workflow/quality-scorecard.md",
      "delivery.html",
    ],
    sceneContracts: designPlan.pages.map((page) => ({
      sceneId: page.id,
      order: page.sceneIndex,
      shotTemplate: page.shotTemplate,
      visualRole: page.visualRole,
      imageRole: page.imageRole,
      layout: page.layout,
      camera: page.camera,
      insertMode: page.insertMode,
      motion: page.motion,
      insertedVisualRequired: true,
      captionSafeArea: "bottom-caption-band",
      qualityBar: "one focal visual, clear hierarchy, visible metaphor, readable captions, and motion tied to the current narration beat",
    })),
    variationPolicy: {
      rule: "Consistency comes from shared art direction and gates; scene design must still vary by role, shot template, camera, and motion job.",
      minimumDistinctShotTemplates: Math.min(3, designPlan.pages.length),
      minimumDistinctVisualRoles: Math.min(3, designPlan.pages.length),
      minimumPaletteColors: 4,
    },
    rejectList: [
      "static PPT cards",
      "same layout repeated for every scene",
      "average-duration visual timing",
      "missing video-internal cover",
      "missing scene-specific inserted visuals",
      "motion removed to save render time",
      "generic decorative imagery unrelated to scene content",
      "unreadable captions or title overlap",
      "generated images containing exact unrelated text",
      "quiet narration or long mid-video silence",
      "fallback renderer marked as final without explicit degraded approval",
    ],
  };
}

function writeAestheticArtifacts({ out, brief, designPlan }) {
  const motionSelection = buildMotionTemplateSelection(designPlan);
  writeJson(join(out, "workflow", "content-presentation-design.json"), {
    topicType: designPlan.videoType,
    audienceState: {
      knows: "The viewer understands the broad topic but may not know why a chapter fails to retain readers.",
      wants: "A concrete framework that turns abstract craft advice into usable writing decisions.",
      likelyMisunderstanding: "The viewer may confuse inspiration, setting, or labels with a reader-facing promise.",
    },
    contentJobs: designPlan.pages.map((page, index) => ({
      scene: page.id,
      order: index + 1,
      job: page.frame?.label || page.shotTemplate,
      primaryMessage: page.frame?.headline?.[0] || page.visualRole,
      supportMessage: page.frame?.subtitle || "",
    })),
    informationHierarchy: {
      primary: "large scene headline",
      secondary: "one-line explanatory support copy",
      tertiary: "visual metaphor/insert asset",
      caption: "safe-area spoken subtitle layer",
      progress: "scene index and progress mark",
    },
    displayLogic: "hook -> contrast -> core question -> concept -> model -> example -> tool -> final rule",
    visualMetaphor: designPlan.templateKit?.visualLanguage || "topic-specific editorial metaphor",
    layoutSystem: {
      grid: "wide 16:9 editorial grid with left text rail and right visual rail",
      safeZones: "bottom caption band remains clear; no exact Chinese text is delegated to generated imagery",
      densityLimit: "one main idea, one support idea, one visual metaphor per scene",
    },
    motionPurpose: designPlan.templateKit?.motion || designPlan.motionLanguage || "motion reveals relationships and state changes",
    syncContract: "Scene changes, captions, progress indicators, and opening visuals use the same storyboard/subtitle timing for this video; long narration must upgrade to ASR or forced alignment.",
    coverContinuity: "The cover promise appears in the first frame and is paid off by the opening scene headline.",
    aestheticBar: "professional premium editorial explainer; high hierarchy, restrained color, visible metaphor, readable captions",
    rejectList: ["static PPT cards", "generic decoration", "missing subtitles", "crowded paragraphs", "uncontrolled audio dynamics"],
  });
  writeJson(join(out, "workflow", "aesthetic-brief.json"), designPlan.aestheticDirection);
  writeJson(join(out, "workflow", "motion-template-selection.json"), motionSelection);
  writeJson(join(out, "workflow", "quality-consistency-contract.json"), buildQualityConsistencyContract({ brief, designPlan, motionSelection }));
  const rubric = [
    ["Art direction", "The video has a named visual territory and avoids default PPT composition."],
    ["Composition", "Each scene has one clear focal image, deliberate negative space, and readable copy safe zones."],
    ["Color taste", "Base/accent usage is restrained; no one-note palette or cheap full-screen tint."],
    ["Typography", "Headline, support text, and captions have distinct hierarchy and do not collide."],
    ["Imagery", "Image2/local assets are scene-specific visual metaphors, not decorative fillers."],
    ["Motion", "Movement reveals meaning and varies by scene role."],
    ["Retention", "The first frame communicates tension or curiosity within one second."],
    ["Deterministic exactness", "Generated imagery does not own exact Chinese text, claims, captions, or logos."],
  ];
  write(
    join(out, "workflow", "aesthetic-quality-rubric.md"),
    `# Aesthetic Quality Rubric\n\n| Dimension | Pass signal |\n| --- | --- |\n${rubric.map((row) => `| ${row[0]} | ${row[1]} |`).join("\n")}\n`,
  );
}

function writeSyncAndCoverArtifacts({ out, brief, frames, duration, designPlan, coverIntroSeconds = 0 }) {
  let cursor = coverIntroSeconds;
  const scenes = frames.map((frame, index) => {
    const start = cursor;
    const end = cursor + frame.durationSec;
    cursor = end;
    return {
      id: frame.id,
      order: index + 1,
      start,
      end,
      duration: Number(frame.durationSec || 0),
      subtitle: frame.subtitle,
      spokenText: frame.spokenText || frame.subtitle,
      visualHeadline: frame.headline?.[0] || frame.label,
      durationSource: frame.audioSegment ? "actual_tts_segment_duration" : "estimated_scene_duration",
      audioSegment: frame.audioSegment || null,
    };
  });
  writeJson(join(out, "workflow", "sync-timecode-plan.json"), {
    source: frames.every((frame) => frame.audioSegment)
      ? "actual_per_frame_tts_segments_plus_opening_cover"
      : "estimated_scene_durations_pending_tts",
    duration,
    coverIntroSeconds,
    upgradeRequiredForLongNarration: "Use ASR or forced alignment when word-level subtitle timing is required; scene-level timing must still come from per-frame TTS segment durations.",
    sharedBy: ["narration", "per-frame TTS segment durations", "subtitles", "main visual scenes", "progress indicators", "opening cover continuity"],
    openingCover: coverIntroSeconds > 0 ? {
      id: "opening-cover",
      start: 0,
      end: coverIntroSeconds,
      file: "cover/cover-video-opening-16x9.svg",
      purpose: "The video-internal cover is visible in the MP4 before the first spoken scene.",
    } : null,
    scenes,
    guardrail: "Do not create independent fixed-duration or equal-distribution visual timing for narration. Every main visual frame must use its own generated TTS segment duration.",
  });

  const coverDir = join(out, "cover");
  ensureDir(coverDir);
  const coverPromise = brief.coverTheme || brief.title || brief.objective || frames[0]?.headline?.[0] || designPlan.templateKit?.label || "核心承诺";
  const coverTexts = deriveCoverTexts({ coverPromise, frames, language: brief.language || "zh" });
  const coverTargets = coverTargetSpecs(1920, 1080);
  for (const target of coverTargets) {
    write(join(out, target.file), coverSvg({ target, coverTexts, language: brief.language || "zh" }));
  }
  const standaloneTargets = coverTargets.filter((target) => target.usage !== "in-video");
  const videoInternalCover = coverTargets.find((target) => target.usage === "in-video");
  writeJson(join(out, "workflow", "cover-design.json"), {
    researchSynthesis: [
      "The thumbnail must make a one-second click decision, not merely repeat the title.",
      "YouTube favors large, readable 16:9 custom thumbnails that stay policy-safe and title-consistent.",
      "Bilibili needs a Chinese-first composition with clear subject, strong contrast, and a dedicated 4:3 upload variant when requested.",
      "Douyin/TikTok covers are chosen before posting and need vertical mobile-grid readability.",
      "X custom video thumbnails should match the video aspect ratio to avoid playback/display issues.",
    ],
    platformTargets: standaloneTargets.map((target) => ({
      id: target.id,
      platform: target.platform,
      usage: target.usage,
      ratio: target.ratio,
      width: target.width,
      height: target.height,
      file: target.file,
      rule: target.rule,
    })),
    videoInternalCover: {
      id: videoInternalCover.id,
      ratio: videoInternalCover.ratio,
      width: videoInternalCover.width,
      height: videoInternalCover.height,
      file: videoInternalCover.file,
      rule: videoInternalCover.rule,
    },
    viewerDecision: coverTexts.viewerDecision,
    coverPromise,
    curiosityGap: coverTexts.curiosityGap,
    hookText: coverTexts.hookText,
    payoffText: coverTexts.payoffText,
    visualSubject: "editorial promise seal and manuscript-board visual metaphor",
    emotionalSignal: "contradiction between failed inspiration and reliable reader promise",
    composition: "shared click promise with per-platform reflow: horizontal split for 16:9, centered compression for 4:3/square, stacked poster logic for 9:16",
    typography: "bold Chinese sans-serif, two text groups maximum, high contrast",
    colorContrast: "warm paper background, black ink text, red accent focal signal",
    smallPreviewTest: "At 120-180px wide, the hook text and red promise seal remain recognizable without reading platform metadata.",
    platformVariants: coverTargets.map((target) => ({
      id: target.id,
      platform: target.platform,
      usage: target.usage,
      width: target.width,
      height: target.height,
      ratio: target.ratio,
      file: target.file,
    })),
    contentTruth: "cover promise is the same first-scene promise and must be paid off in the opening seconds",
    rejectList: ["tiny text", "generic AI glow", "too many elements", "misleading hook", "wrong platform ratio", "copied creator thumbnail style", "visible platform/spec/debug labels on the cover"],
  });
}

function localIllustrationSvg(page, frame, index) {
  const palette = palettes[frame.palette] || palettes.blue;
  const title = esc(frame.headline[0] || frame.label);
  const role = page.visualRole;
  const english = page.language === "en";
  const stopText = english ? "STOP!" : "停!";
  const conflictText = english ? "Tension" : "冲突";
  const rewriteText = english ? "Rewrite" : "重写";
  const cutsText = english ? "3 checks" : "3刀";
  const nodes = frame.headline.slice(0, 3);
  const nodeMarkup = nodes.map((node, i) => {
    const x = 140 + i * 270;
    const y = 420 + (i % 2) * 86;
    return `<g class="node" transform="translate(${x} ${y})">
      <circle r="54" fill="#fffaf0" stroke="#171411" stroke-width="6"/>
      <text x="0" y="10" text-anchor="middle" font-size="34" font-weight="900" fill="#171411" font-family="PingFang SC, sans-serif">${esc(node)}</text>
    </g>`;
  }).join("\n");
  const connectorMarkup = nodes.slice(0, -1).map((_, i) => {
    const x1 = 194 + i * 270;
    const y1 = 420 + (i % 2) * 86;
    const x2 = 356 + i * 270;
    const y2 = 420 + ((i + 1) % 2) * 86;
    return `<path class="thread" d="M${x1} ${y1} C${x1 + 75} ${y1 - 80}, ${x2 - 75} ${y2 + 80}, ${x2} ${y2}" fill="none" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>`;
  }).join("\n");
  const roleSpecific = {
    hook: `<g transform="translate(520 122) rotate(-5)">
      <rect x="0" y="0" width="300" height="170" rx="8" fill="${palette.accent}" stroke="#171411" stroke-width="6"/>
      <text x="150" y="108" text-anchor="middle" font-size="${english ? 58 : 76}" font-weight="900" fill="#fffaf0" font-family="PingFang SC, sans-serif">${stopText}</text>
    </g>`,
    "opening-anomaly": `<g transform="translate(520 110)">
      <path d="M40 500 V80 Q40 40 80 40 H260 Q300 40 300 80 V500" fill="#201b16" stroke="#171411" stroke-width="8"/>
      <path d="M92 500 V110 H248 V500" fill="#fffaf0" opacity=".92"/>
      <circle cx="226" cy="306" r="13" fill="${palette.accent}"/>
      <text x="170" y="258" text-anchor="middle" font-size="92" font-weight="900" fill="${palette.accent}" font-family="PingFang SC, sans-serif">?</text>
    </g>`,
    "conflict-system": `<g transform="translate(472 110)">
      <polygon points="190,40 350,360 30,360" fill="#fffaf0" stroke="#171411" stroke-width="8"/>
      <circle cx="190" cy="40" r="45" fill="${palette.accent}"/>
      <circle cx="350" cy="360" r="45" fill="#1769e0"/>
      <circle cx="30" cy="360" r="45" fill="#087f5b"/>
      <text x="190" y="230" text-anchor="middle" font-size="${english ? 62 : 86}" font-weight="900" fill="#171411" font-family="PingFang SC, sans-serif">${conflictText}</text>
    </g>`,
    "chapter-question": `<g transform="translate(520 120)">
      <path d="M0 80 C100 0, 250 0, 350 80 C450 160, 450 300, 350 380 C250 460, 100 460, 0 380 C-100 300, -100 160, 0 80Z" fill="#fffaf0" stroke="#171411" stroke-width="8"/>
      <text x="175" y="290" text-anchor="middle" font-size="230" font-weight="900" fill="${palette.accent}" font-family="PingFang SC, sans-serif">?</text>
    </g>`,
    "twist-rewrite": `<g transform="translate(475 112)">
      <rect x="0" y="80" width="420" height="310" rx="18" fill="#fffaf0" stroke="#171411" stroke-width="8"/>
      <path d="M42 170 H332 M42 235 H370 M42 300 H250" stroke="#171411" stroke-width="16" stroke-linecap="round" opacity=".25"/>
      <circle cx="278" cy="250" r="138" fill="none" stroke="${palette.accent}" stroke-width="22"/>
      <path d="M372 345 L462 435" stroke="${palette.accent}" stroke-width="28" stroke-linecap="round"/>
      <text x="210" y="260" text-anchor="middle" font-size="${english ? 58 : 76}" font-weight="900" fill="#171411" font-family="PingFang SC, sans-serif">${rewriteText}</text>
    </g>`,
    "edit-pass": `<g transform="translate(492 108)">
      <rect x="0" y="50" width="390" height="470" rx="12" fill="#fffaf0" stroke="#171411" stroke-width="8"/>
      <path d="M70 155 H315 M70 260 H315 M70 365 H315" stroke="#171411" stroke-width="18" stroke-linecap="round" opacity=".22"/>
      <path d="M58 160 L330 118 M58 265 L330 224 M58 370 L330 330" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round"/>
      <text x="195" y="475" text-anchor="middle" font-size="${english ? 46 : 68}" font-weight="900" fill="${palette.accent}" font-family="PingFang SC, sans-serif">${cutsText}</text>
    </g>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-label="${title}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="18" dy="18" stdDeviation="0" flood-color="#171411" flood-opacity=".20"/>
    </filter>
    <pattern id="paper" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M0 44 H44 M44 0 V44" stroke="#171411" stroke-opacity=".05"/>
    </pattern>
  </defs>
  <rect width="960" height="640" rx="34" fill="#fff7e8"/>
  <rect width="960" height="640" rx="34" fill="url(#paper)"/>
  <g filter="url(#shadow)" transform="translate(68 58)">
    <rect width="820" height="520" rx="24" fill="#fffdf8" stroke="#171411" stroke-width="7"/>
    <path d="M42 92 H400 M42 160 H338 M42 228 H450" stroke="#171411" stroke-width="12" stroke-linecap="round" opacity=".16"/>
    ${connectorMarkup}
    ${nodeMarkup}
    ${roleSpecific[role] || roleSpecific.hook}
    <text x="58" y="78" font-size="42" font-weight="900" fill="#171411" font-family="PingFang SC, sans-serif">${title}</text>
    <rect x="55" y="470" width="300" height="16" fill="${palette.accent}"/>
  </g>
  <g opacity=".28">
    <circle cx="82" cy="104" r="12" fill="${palette.accent}"/>
    <circle cx="878" cy="540" r="18" fill="${palette.accent}"/>
    <path d="M806 74 C858 110, 870 170, 838 212" fill="none" stroke="${palette.accent}" stroke-width="11" stroke-linecap="round"/>
  </g>
</svg>`;
}

function pageVisualMarkup(page) {
  if (page.image2DataUri) {
    return `<img src="${page.image2DataUri}" alt="${esc(page.imageRole)}" />`;
  }
  return page.localSvg || "";
}

function frameHtml(frame, index, total, page = {}) {
  const palette = palettes[frame.palette] || palettes.blue;
  const visualMarkup = pageVisualMarkup(page);
  const headline = frame.headline
    .map((line, i) => `<span class="line line-${i + 1}">${esc(line)}</span>`)
    .join("\n");
  const chips = frame.headline
    .map((line, i) => `<span style="--i:${i}">${esc(line)}</span>`)
    .join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=1920,height=1080" />
<title>${esc(frame.label)}</title>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; }
body {
  color: #171411;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  letter-spacing: 0;
  background: #f7f3eb;
}
.stage {
  position: absolute;
  inset: 0;
  padding: 86px 104px 72px;
  background:
    linear-gradient(90deg, rgba(23,20,17,0.055) 1px, transparent 1px) 0 0 / 96px 96px,
    linear-gradient(0deg, rgba(23,20,17,0.045) 1px, transparent 1px) 0 0 / 96px 96px,
    #f7f3eb;
}
.stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 78% 18%, ${palette.wash}, transparent 34%);
}
.stage::after {
  content: "";
  position: absolute;
  inset: -80px;
  opacity: .14;
  background:
    linear-gradient(115deg, transparent 0 42%, ${palette.accent} 42% 43%, transparent 43% 100%),
    radial-gradient(circle at 15% 85%, #171411 0 2px, transparent 3px);
  animation: atmosphericDrift 9s ease-in-out infinite alternate;
}
.top {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28px;
  font-weight: 800;
}
.rule {
  height: 6px;
  width: 980px;
  background: ${palette.accent};
  transform-origin: left;
  animation: rule .8s cubic-bezier(.16,1,.3,1) .2s both;
}
.mark {
  font-size: 90px;
  line-height: .85;
  font-weight: 900;
  color: ${palette.accent};
  transform: translateY(-28px) rotate(-8deg);
  opacity: 0;
  animation: drop .75s cubic-bezier(.16,1,.3,1) .45s forwards;
}
.headline {
  position: relative;
  z-index: 6;
  margin-top: 86px;
  max-width: 1040px;
  font-weight: 900;
  line-height: .95;
}
.line {
  display: block;
  font-size: 132px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(54px);
}
.line-1 { animation: lineIn .7s cubic-bezier(.16,1,.3,1) .65s forwards; }
.line-2 { color: ${palette.accent}; animation: lineInTilt .7s cubic-bezier(.16,1,.3,1) .85s forwards; }
.line-3 { animation: lineIn .7s cubic-bezier(.16,1,.3,1) 1.05s forwards; }
.body {
  position: relative;
  z-index: 6;
  margin-top: 46px;
  max-width: 820px;
  font-size: 43px;
  font-weight: 650;
  line-height: 1.28;
  opacity: 0;
  animation: up .65s ease-out 1.45s forwards;
}
.visual-plate {
  position: absolute;
  right: 72px;
  top: 210px;
  width: 790px;
  height: 530px;
  z-index: 3;
  transform: translate(70px, 22px) rotate(1deg) scale(.94);
  opacity: 0;
  animation: visualIn 1s cubic-bezier(.16,1,.3,1) .55s forwards, floatFrame 6s ease-in-out 1.6s infinite alternate;
}
.visual-plate svg, .visual-plate img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border: 5px solid #171411;
  box-shadow: 24px 24px 0 rgba(23,20,17,.16);
  background: #fffdf8;
}
.motion-note {
  position: absolute;
  z-index: 7;
  right: 690px;
  top: 690px;
  min-width: 250px;
  padding: 18px 24px;
  border: 4px solid #171411;
  background: #fffaf0;
  box-shadow: 12px 12px 0 rgba(23,20,17,.18);
  font-size: 34px;
  font-weight: 900;
  color: ${palette.accent};
  transform: translateY(28px) rotate(-4deg);
  opacity: 0;
  animation: notePop .55s cubic-bezier(.16,1,.3,1) 1.35s forwards;
}
.depth-strip {
  position: absolute;
  z-index: 2;
  right: 28px;
  bottom: 136px;
  width: 730px;
  height: 78px;
  background: ${palette.accent};
  opacity: .76;
  transform: skewX(-12deg) translateX(80px);
  animation: stripSweep 1.1s cubic-bezier(.16,1,.3,1) .95s forwards;
}
.chips { display: grid; gap: 14px; }
.chips span {
  display: block;
  border: 2px solid #171411;
  padding: 13px 18px;
  background: #fffdf8;
  font-size: 30px;
  font-weight: 800;
  opacity: 0;
  animation: up .45s ease-out calc(1.65s + var(--i) * .13s) forwards;
}
.subtitle {
  position: absolute;
  z-index: 8;
  left: 104px;
  right: 104px;
  bottom: 62px;
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 36px;
  background: #171411;
  color: #fffaf0;
  font-size: 38px;
  font-weight: 750;
  line-height: 1.25;
  opacity: 0;
  transform: translateY(22px);
  animation: subtitle .55s ease-out 1.95s forwards;
}
.progress {
  position: absolute;
  left: 104px;
  bottom: 32px;
  width: calc((100% - 208px) * ${index + 1} / ${total});
  height: 8px;
  background: ${palette.accent};
  transform-origin: left;
  animation: rule .9s ease-out 2.1s both;
}
@keyframes rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes up { to { opacity: 1; transform: translateY(0); } }
@keyframes drop { to { opacity: 1; transform: translateY(0) rotate(-4deg); } }
@keyframes lineIn { to { opacity: 1; transform: translateY(0); } }
@keyframes lineInTilt { to { opacity: 1; transform: translateY(0) rotate(-2deg); } }
@keyframes cardIn { to { opacity: 1; transform: translate(0, 0) rotate(1deg); } }
@keyframes subtitle { to { opacity: 1; transform: translateY(0); } }
@keyframes visualIn { to { opacity: 1; transform: translate(0, 0) rotate(1deg) scale(1); } }
@keyframes floatFrame { to { transform: translate(-18px, -12px) rotate(-.4deg) scale(1.018); } }
@keyframes notePop { to { opacity: 1; transform: translateY(0) rotate(-4deg); } }
@keyframes stripSweep { to { transform: skewX(-12deg) translateX(0); } }
@keyframes atmosphericDrift { to { transform: translate3d(-30px, 18px, 0) scale(1.03); } }
</style>
</head>
<body>
  <main class="stage">
    <header class="top">
      <div>${esc(frame.kicker)}</div>
      <div class="rule"></div>
      <div class="mark">${esc(frame.stat)}</div>
    </header>
    <section class="visual-plate">${visualMarkup}</section>
    <div class="depth-strip"></div>
    <section class="headline">${headline}</section>
    <section class="body">${esc(frame.body)}</section>
    <aside class="motion-note">
      ${esc(frame.label)}
      <div class="chips">${chips}</div>
    </aside>
    <div class="subtitle">${esc(frame.subtitle)}</div>
    <div class="progress"></div>
  </main>
</body>
</html>`;
}

function splitSvgLines(text, maxChars, maxLines) {
  const value = String(text || "");
  const lines = [];
  for (let i = 0; i < value.length && lines.length < maxLines; i += maxChars) {
    lines.push(value.slice(i, i + maxChars));
  }
  return lines;
}

function svgText(lines, x, y, size, fill, weight = "800", lineHeight = Math.round(size * 1.18)) {
  return lines.map((line, index) =>
    `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif">${esc(line)}</text>`
  ).join("\n");
}

function fallbackMotif(page, palette) {
  const role = page?.visualRole || "hook";
  if (role === "conflict-system") {
    return `<polygon points="1570,230 1750,610 1390,610" fill="#fffdf8" stroke="#171411" stroke-width="8"/>
    <circle cx="1570" cy="230" r="56" fill="${palette.accent}"/>
    <circle cx="1750" cy="610" r="56" fill="#1769e0"/>
    <circle cx="1390" cy="610" r="56" fill="#087f5b"/>
    <text x="1570" y="456" text-anchor="middle" font-size="70" font-weight="900" fill="#171411" font-family="PingFang SC, sans-serif">冲突</text>`;
  }
  if (role === "chapter-question") {
    return `<path d="M1370 286 C1480 180, 1680 180, 1790 286 C1900 392, 1900 560, 1790 666 C1680 772, 1480 772, 1370 666 C1260 560, 1260 392, 1370 286Z" fill="#fffdf8" stroke="#171411" stroke-width="8"/>
    <text x="1580" y="610" text-anchor="middle" font-size="300" font-weight="900" fill="${palette.accent}" font-family="PingFang SC, sans-serif">?</text>`;
  }
  if (role === "twist-rewrite") {
    return `<rect x="1330" y="250" width="460" height="360" rx="18" fill="#fffdf8" stroke="#171411" stroke-width="8"/>
    <path d="M1380 360 H1700 M1380 430 H1750 M1380 500 H1600" stroke="#171411" stroke-width="18" stroke-linecap="round" opacity=".22"/>
    <circle cx="1600" cy="438" r="150" fill="none" stroke="${palette.accent}" stroke-width="22"/>
    <path d="M1705 548 L1805 650" stroke="${palette.accent}" stroke-width="28" stroke-linecap="round"/>
    <text x="1560" y="464" text-anchor="middle" font-size="76" font-weight="900" fill="#171411" font-family="PingFang SC, sans-serif">重写</text>`;
  }
  if (role === "edit-pass") {
    return `<rect x="1370" y="210" width="390" height="500" rx="14" fill="#fffdf8" stroke="#171411" stroke-width="8"/>
    <path d="M1430 340 H1710 M1430 460 H1710 M1430 580 H1710" stroke="#171411" stroke-width="20" stroke-linecap="round" opacity=".22"/>
    <path d="M1418 345 L1720 295 M1418 465 L1720 415 M1418 585 L1720 535" stroke="${palette.accent}" stroke-width="18" stroke-linecap="round"/>
    <text x="1565" y="700" text-anchor="middle" font-size="78" font-weight="900" fill="${palette.accent}" font-family="PingFang SC, sans-serif">3刀</text>`;
  }
  return `<rect x="1340" y="230" width="470" height="420" rx="18" fill="#fffdf8" stroke="#171411" stroke-width="8"/>
  <path d="M1390 350 H1695 M1390 430 H1760 M1390 510 H1600" stroke="#171411" stroke-width="18" stroke-linecap="round" opacity=".2"/>
  <rect x="1500" y="160" width="300" height="170" rx="8" fill="${palette.accent}" stroke="#171411" stroke-width="8"/>
  <text x="1650" y="270" text-anchor="middle" font-size="82" font-weight="900" fill="#fffaf0" font-family="PingFang SC, sans-serif">停!</text>`;
}

function fallbackSvgCard(frame, index, total, page = {}) {
  const palette = palettes[frame.palette] || palettes.blue;
  const headlineLines = frame.headline.flatMap((line) => splitSvgLines(line, 9, 2)).slice(0, 4);
  const subtitleLines = splitSvgLines(frame.subtitle, 18, 2);
  const embeddedVisual = fallbackMotif(page, palette);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#f7f3eb"/>
  <path d="M0 0 H1920 V1080 H0 Z" fill="${palette.wash}"/>
  <g opacity="0.16" stroke="#171411" stroke-width="1">
    ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 96}" y1="0" x2="${i * 96}" y2="1080"/>`).join("\n")}
    ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 96}" x2="1920" y2="${i * 96}"/>`).join("\n")}
  </g>
  <text x="104" y="134" font-size="30" font-weight="800" fill="#171411" font-family="PingFang SC, sans-serif">${esc(frame.kicker)}</text>
  <rect x="460" y="120" width="980" height="6" fill="${palette.accent}"/>
  <text x="1680" y="154" font-size="86" font-weight="900" fill="${palette.accent}" font-family="PingFang SC, sans-serif">${esc(frame.stat)}</text>
  ${svgText(headlineLines, 104, 338, 96, "#171411", "900", 104)}
  <text x="104" y="704" font-size="42" font-weight="750" fill="#171411" font-family="PingFang SC, sans-serif">${esc(frame.body)}</text>
  ${embeddedVisual}
  <rect x="1260" y="760" width="520" height="72" fill="${palette.accent}" opacity=".76" transform="skewX(-12)"/>
  <text x="1300" y="812" font-size="34" font-weight="900" fill="#fffaf0" font-family="PingFang SC, sans-serif">${esc(frame.label)}</text>
  <rect x="104" y="918" width="1712" height="100" fill="#171411"/>
  ${svgText(subtitleLines, 220, 974, 34, "#fffaf0", "760", 42)}
  <rect x="104" y="1040" width="${Math.round(1712 * (index + 1) / total)}" height="8" fill="${palette.accent}"/>
</svg>`;
}

async function generateImage2Png({ prompt, outputPath }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for --image-source image2");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE || "1536x864",
      output_format: "png",
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`image2 generation failed: HTTP ${response.status} ${JSON.stringify(json).slice(0, 1000)}`);
  }
  const image = json.data?.[0];
  if (image?.b64_json) {
    write(outputPath, Buffer.from(image.b64_json, "base64"));
    return outputPath;
  }
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) throw new Error(`image2 download failed: HTTP ${imageResponse.status}`);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    write(outputPath, bytes);
    return outputPath;
  }
  throw new Error(`image2 response did not include b64_json or url: ${JSON.stringify(json).slice(0, 1000)}`);
}

async function prepareVisualAssets({ out, designPlan, imageSource }) {
  const assets = [];
  const promptRows = [];
  const failures = [];
  ensureDir(join(out, "assets", "visuals"));
  ensureDir(join(out, "assets", "image2"));
  for (let i = 0; i < designPlan.pages.length; i += 1) {
    const page = designPlan.pages[i];
    const frame = page.frame;
    const localSvg = localIllustrationSvg(page, frame, i);
    const localPath = join(out, page.imageAsset);
    write(localPath, localSvg);
    page.localSvg = localSvg;
    promptRows.push({
      sceneId: page.id,
      imageSource,
      kind: "image2-compatible-still",
      prompt: page.image2Prompt,
      localFallback: page.imageAsset,
      target: page.image2Asset,
    });
    let selectedAsset = page.imageAsset;
    let selectedSource = "local-svg";
    if (imageSource === "image2") {
      try {
        const image2Path = join(out, page.image2Asset);
        await generateImage2Png({ prompt: page.image2Prompt, outputPath: image2Path });
        const b64 = readFileSync(image2Path).toString("base64");
        page.image2DataUri = `data:image/png;base64,${b64}`;
        selectedAsset = page.image2Asset;
        selectedSource = "image2";
      } catch (error) {
        failures.push({ sceneId: page.id, error: error.message });
        if (!process.env.ALLOW_IMAGE2_FALLBACK) throw error;
      }
    }
    assets.push({
      sceneId: page.id,
      visualRole: page.visualRole,
      shotTemplate: page.shotTemplate,
      selectedSource,
      selectedAsset,
      localFallback: page.imageAsset,
      image2Asset: page.image2Asset,
      insertMode: page.insertMode,
      promptId: `image2-${String(i + 1).padStart(2, "0")}-${page.id}`,
    });
  }
  writeJson(join(out, "workflow", "image2-prompts.json"), {
    model: "gpt-image-2",
    mode: imageSource,
    note: imageSource === "image2-dryrun"
      ? "Prompts are recorded for GPT Image 2 generation; deterministic local SVG assets are inserted for this run."
      : imageSource === "local"
        ? "Local SVG assets are inserted; image2 prompts remain available for later generation."
        : "GPT Image 2 assets requested; failures require ALLOW_IMAGE2_FALLBACK=1 to continue with local SVG.",
    prompts: promptRows,
  });
  writeJson(join(out, "workflow", "visual-asset-manifest.json"), {
    imageSource,
    insertedVisualAssets: assets,
    failures,
    policy: "Use original generated illustrations or GPT Image 2 outputs from original prompts. No copied creator assets, logos, celebrity likenesses, or unclear-license media.",
  });
  const designForDisk = {
    ...designPlan,
    pages: designPlan.pages.map(({ localSvg, image2DataUri, frame, ...page }) => ({
      ...page,
      frame: {
        id: frame.id,
        label: frame.label,
        headline: frame.headline,
        subtitle: frame.subtitle,
        durationSec: frame.durationSec,
      },
    })),
  };
  writeJson(join(out, "workflow", "design-plan.json"), designForDisk);
  return designPlan;
}

function writeCorePackage({ out, brief, frames, narration, spokenNarration, voiceDirection, mode, designPlan, coverIntroSeconds = 0 }) {
  ensureDir(out);
  ensureDir(join(out, ".html-video"));
  ensureDir(join(out, "assets"));
  ensureDir(join(out, "logs"));
  ensureDir(join(out, "renders"));
  ensureDir(join(out, "screenshots"));
  ensureDir(join(out, "script"));
  ensureDir(join(out, "workflow"));
  writeJson(join(out, "brief.json"), brief);
  write(join(out, "script", "narration.txt"), `${narration}\n`);
  write(join(out, "script", "narration-spoken.txt"), `${spokenNarration}\n`);
  write(join(out, "script", "storyboard.md"), storyboard(frames, coverIntroSeconds));
  write(join(out, "script", "subtitles.srt"), subtitles(frames, coverIntroSeconds));
  writeJson(join(out, "workflow", "voice-direction.json"), voiceDirection);
  writeAestheticArtifacts({ out, brief, designPlan });
  writeSyncAndCoverArtifacts({ out, brief, frames, duration: brief.durationSeconds, designPlan, coverIntroSeconds });
  write(
    join(out, "AUTHORIZATION.md"),
    `# Authorization

This workflow uses only locally generated or original material.

- Text/script: original for this run.
- Visuals: original HTML/CSS/SVG generated by \`poc-video-workflow.mjs\`, plus optional GPT Image 2 outputs only when \`--image-source image2\` is explicitly used.
- Voice: local CosyVoice or MeloTTS only by default; no cloned voice, real-person imitation, private upload, or paid API.
- Voice direction: ${voiceDirection?.label || "not planned"}; pauses are placed only after complete sentences or semantic beats. Comma-like punctuation stays a short in-clause pause (${SHORT_PUNCTUATION_PAUSE_SECONDS}s when explicit); sentence-ending punctuation keeps the TTS/default pause.
- Music: ffmpeg-generated sine-pad bed.
- Fonts: local system sans-serif fallback stack.
- External media: none.
- Mode: ${mode}.
- Design template: ${designPlan?.templateKit?.label || "not yet planned"}.
- Image source: ${designPlan?.imageSource || "not yet planned"}.

Commercial/platform publication still requires human review for AI labeling, voice terms, licensing, and editorial suitability.
`,
  );
}

function findVoicePocRoot(startDir) {
  const roots = [startDir, ROOT];
  for (const root of roots) {
    let dir = root;
    for (let i = 0; i < 10; i += 1) {
      const direct = join(dir, "voice-quality-poc");
      const nested = join(dir, "research", "voice-quality-poc");
      if (existsSync(join(direct, "cosyvoice")) || existsSync(join(direct, "melotts"))) return direct;
      if (existsSync(join(nested, "cosyvoice")) || existsSync(join(nested, "melotts"))) return nested;
      const next = dirname(dir);
      if (next === dir) break;
      dir = next;
    }
  }
  return null;
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\n+/g, " ")
    .split(/(?<=[。！？!?.；;])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasLineBreakAfterComma(text) {
  return /[，,、]\s*\n/u.test(String(text || ""));
}

function splitLongSentence(sentence, maxChars) {
  if (sentence.length <= maxChars) return [sentence];
  const chunks = [];
  for (let start = 0; start < sentence.length; start += maxChars) {
    chunks.push(sentence.slice(start, start + maxChars));
  }
  return chunks;
}

function ttsSegments(text, maxChars = 120) {
  const segments = [];
  let current = "";
  for (const sentence of splitSentences(text).flatMap((item) => splitLongSentence(item, maxChars))) {
    if (current && current.length + sentence.length > maxChars) {
      segments.push(current);
      current = sentence;
    } else {
      current = current ? `${current}${sentence}` : sentence;
    }
  }
  if (current) segments.push(current);
  return segments.length ? segments : [String(text || "").trim()].filter(Boolean);
}

function inferSpeechStyle(brief, videoType, requested) {
  const value = String(requested || brief.speechStyle || brief.voiceStyle || "").trim().toLowerCase();
  if (/口语|conversational|casual|spoken/.test(value)) return "conversational";
  if (/tutorial|教程|how/.test(value)) return "tutorial";
  if (/story|narrative|故事|叙事/.test(value)) return "story";
  if (/news|analysis|新闻|分析/.test(value)) return "news";
  if (/product|demo|产品|演示/.test(value)) return "product";
  if (/documentary|纪录/.test(value)) return "documentary";
  if (/explainer|知识|解释/.test(value)) return "explainer";
  if (videoType === "writing-method") return "conversational";
  if (videoType === "tutorial-explainer") return "tutorial";
  return "explainer";
}

function buildVoiceDirection({ brief, videoType, requestedStyle }) {
  const speechStyle = inferSpeechStyle(brief, videoType, requestedStyle);
  const presets = {
    conversational: {
      label: "口语讲解",
      pace: "medium-slow",
      tone: "像创作者面对镜头讲重点，有呼吸感但不散。",
      pause: "short pause after every complete sentence; slightly longer pause after hook, example, and final rule.",
      sentenceRule: "Do not insert pauses inside an unfinished clause. Keep each sentence semantically complete before a pause.",
      punctuation: "Use Chinese sentence endings and newlines as TTS pause cues.",
    },
    tutorial: {
      label: "教程步骤",
      pace: "steady",
      tone: "清楚、可跟做、每一步有边界。",
      pause: "pause after step labels and completed instructions; avoid dramatic pauses.",
      sentenceRule: "Keep command/result pairs together before pausing.",
      punctuation: "Use sentence endings plus line breaks between steps.",
    },
    explainer: {
      label: "知识解释",
      pace: "medium",
      tone: "专业但不端着，概念句后给观众消化时间。",
      pause: "pause after definitions, contrasts, and examples.",
      sentenceRule: "Do not split definition subject and predicate.",
      punctuation: "Use punctuation and line breaks after complete ideas.",
    },
    story: {
      label: "故事叙事",
      pace: "variable",
      tone: "有画面感和悬念，停顿服务情绪和转折。",
      pause: "pause after scene beats, reveals, and reversals.",
      sentenceRule: "Keep action beat complete before pausing.",
      punctuation: "Use paragraph breaks for scene beats.",
    },
    news: {
      label: "新闻分析",
      pace: "controlled",
      tone: "可信、克制、信息密度高但不抢。",
      pause: "pause after facts, dates, numbers, and causal conclusions.",
      sentenceRule: "Keep attribution and conclusion in the same sentence when needed.",
      punctuation: "Use clean sentence endings; avoid excessive ellipses.",
    },
    product: {
      label: "产品演示",
      pace: "crisp",
      tone: "结果导向，先说用户收益，再说操作。",
      pause: "pause after benefit, action, and proof.",
      sentenceRule: "Do not separate feature from user benefit.",
      punctuation: "Use concise complete sentences.",
    },
    documentary: {
      label: "纪录片旁白",
      pace: "slow",
      tone: "沉稳、有空间感，少口头禅。",
      pause: "longer pause after imagery-heavy sentences and section turns.",
      sentenceRule: "Keep image description complete before pausing.",
      punctuation: "Use paragraph breaks sparingly for breath.",
    },
  };
  const preset = presets[speechStyle] || presets.explainer;
  const pauseDurations = {
    commaLikeSeconds: SHORT_PUNCTUATION_PAUSE_SECONDS,
    commaLikePunctuation: ["，", ",", "、"],
    sentenceEnd: SENTENCE_END_PAUSE_SECONDS,
    sentenceEndPunctuation: ["。", "！", "？", "!", "?", "."],
    semanticEndPunctuation: ["；", ";"],
    rule: "Comma-like punctuation uses a short in-clause pause; sentence-ending punctuation keeps the TTS/default pause duration.",
  };
  return {
    stage: "voice-direction",
    videoType,
    speechStyle,
    requestedStyle: requestedStyle || brief.speechStyle || brief.voiceStyle || "auto",
    ...preset,
    pauseDurations,
    shortPausePolicy: "Do not split lines or TTS segments at commas. If a backend or renderer inserts explicit comma silence, cap it at 0.5s; leave sentence endings default.",
    hardRules: [
      "Pauses belong after complete sentences or complete semantic beats.",
      "Comma-like punctuation is a short in-clause pause only; do not turn commas into line breaks or long sentence pauses.",
      "Never insert a pause between subject and predicate, verb and object, number and unit, or setup and its required answer.",
      "Keep subtitles concise; spoken narration may include line breaks for TTS breathing.",
      "Use local CosyVoice or MeloTTS by default; no voice cloning or real-person imitation.",
    ],
    outputFiles: {
      sourceNarration: "script/narration.txt",
      spokenNarration: "script/narration-spoken.txt",
      voiceDirection: "workflow/voice-direction.json",
    },
  };
}

function applyVoiceDirection(narration, voiceDirection) {
  const sentences = splitSentences(narration).map((sentence) => String(sentence || "").trim()).filter(Boolean);
  if (!sentences.length) return String(narration || "").trim();
  if (voiceDirection.speechStyle === "conversational") {
    return sentences.map((sentence, index) => {
      const longPause = index === 0 || index === sentences.length - 1 || /比如|最后|记住|反转|第三步|第四步/.test(sentence);
      return longPause ? `${sentence}\n` : sentence;
    }).join("\n");
  }
  if (["tutorial", "product"].includes(voiceDirection.speechStyle)) {
    return sentences.join("\n");
  }
  if (["story", "documentary"].includes(voiceDirection.speechStyle)) {
    return sentences.map((sentence, index) => (index % 2 === 1 ? `${sentence}\n` : sentence)).join("\n");
  }
  return sentences.join("\n");
}

function coverFrameHtml(coverSvg) {
  const inlineCover = String(coverSvg || "").replace("<svg ", "<svg class=\"cover-art\" ");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<style>
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #0b0b0d;
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
  .stage {
    width: 100vw;
    height: 100vh;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.08), rgba(0,0,0,0.94));
  }
  .cover-art {
    width: 100vw;
    height: 100vh;
    display: block;
    animation: coverPush 2s ease-out forwards;
    transform-origin: 50% 50%;
  }
  @keyframes coverPush {
    from { transform: scale(1.018); filter: contrast(1.04) saturate(0.96); }
    to { transform: scale(1); filter: contrast(1) saturate(1); }
  }
</style>
</head>
<body>
  <main class="stage">${inlineCover}</main>
</body>
</html>`;
}

function writeCosyVoiceBatchScript(out) {
  const script = String.raw`#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import soundfile as sf


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-dir", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--segments-json", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--speaker", default="中文女")
    args = parser.parse_args()

    repo_dir = Path(args.repo_dir).resolve()
    sys.path.insert(0, str(repo_dir))
    sys.path.insert(0, str(repo_dir / "third_party" / "Matcha-TTS"))

    from cosyvoice.cli.cosyvoice import AutoModel

    segments = json.loads(Path(args.segments_json).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    model = AutoModel(model_dir=args.model_dir)
    print(f"available speakers: {model.list_available_spks()}", flush=True)
    for segment in segments:
        text = segment["text"].strip()
        if not text:
            continue
        primary = output_dir / f"segment-{segment['index']:04d}.wav"
        if primary.exists() and primary.stat().st_size > 1000:
            print(f"cached {primary}", flush=True)
            continue
        wrote = False
        for i, item in enumerate(model.inference_sft(text, args.speaker, stream=False)):
            suffix = "" if i == 0 else f"_{i}"
            out = output_dir / f"segment-{segment['index']:04d}{suffix}.wav"
            wav = item["tts_speech"].squeeze().detach().cpu().numpy()
            sf.write(str(out), wav, model.sample_rate)
            print(f"saved {out}", flush=True)
            wrote = True
        if not wrote:
            raise RuntimeError(f"no audio generated for segment {segment['index']}")


if __name__ == "__main__":
    main()
`;
  const path = join(out, "scripts", "generate_cosyvoice_batch.py");
  write(path, script);
  return path;
}

function concatAudio(files, output, out) {
  const concatPath = join(out, "workflow", `${output.split("/").pop()}.concat.txt`);
  write(concatPath, files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n") + "\n");
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", output], { cwd: out });
}

function normalizeTtsInputSegments(narration, narrationSegments) {
  const source = Array.isArray(narrationSegments) && narrationSegments.length
    ? narrationSegments
    : ttsSegments(narration).map((text, index) => ({ index: index + 1, frameId: `audio-${index + 1}`, label: `Audio ${index + 1}`, text }));
  const segments = source.map((segment, index) => ({
    index: segment.index || index + 1,
    frameId: segment.frameId || `audio-${index + 1}`,
    label: segment.label || `Audio ${index + 1}`,
    text: String(segment.text || "").trim(),
  }));
  if (segments.some((segment) => !segment.text)) {
    throw new Error("TTS segment text must be non-empty for frame-bound audio timing.");
  }
  return segments;
}

function chunksForSegment(outputDir, segmentIndex, extension = "wav") {
  const prefix = `segment-${String(segmentIndex).padStart(4, "0")}`;
  return readdirSync(outputDir)
    .filter((file) => file === `${prefix}.${extension}` || new RegExp(`^${prefix}_\\d+\\.${extension}$`).test(file))
    .sort((a, b) => {
      const suffix = (name) => {
        const match = name.match(/_(\d+)\.[^.]+$/);
        return match ? Number(match[1]) : 0;
      };
      return suffix(a) - suffix(b);
    })
    .map((file) => join(outputDir, file));
}

function buildSegmentTimings({ segments, filesBySegment, rawDuration }) {
  let cursor = 0;
  const timings = segments.map((segment) => {
    const files = filesBySegment.get(segment.index) || [];
    if (!files.length) throw new Error(`No audio chunks found for segment ${segment.index}`);
    const duration = files.reduce((sum, file) => sum + mediaDurationSeconds(file), 0);
    if (!duration || duration < 0.1) throw new Error(`Invalid audio duration for segment ${segment.index}: ${duration}`);
    const start = Number(cursor.toFixed(3));
    const end = Number((cursor + duration).toFixed(3));
    cursor = end;
    return {
      index: segment.index,
      frameId: segment.frameId,
      label: segment.label,
      text: segment.text,
      start,
      end,
      durationSeconds: Number(duration.toFixed(3)),
      files: files.map((file) => relative(ROOT, file)),
    };
  });
  const delta = Number(rawDuration || 0) - cursor;
  if (timings.length && Math.abs(delta) > 0.01) {
    const last = timings[timings.length - 1];
    last.end = Number(rawDuration.toFixed(3));
    last.durationSeconds = Number((last.durationSeconds + delta).toFixed(3));
  }
  return timings;
}

function generateWithCosyVoice({ out, voiceRoot, narration, rawOutput, narrationSegments = null }) {
  const python = join(voiceRoot || "", "cosyvoice", ".venv", "bin", "python");
  const repo = join(voiceRoot || "", "cosyvoice", "CosyVoice");
  const model = join(repo, "pretrained_models", "CosyVoice-300M-SFT");
  if (!voiceRoot || !existsSync(python) || !existsSync(model)) {
    throw new Error("CosyVoice local POC environment not found under " + (voiceRoot || "<missing voice-quality-poc>"));
  }
  const segments = normalizeTtsInputSegments(narration, narrationSegments);
  writeJson(join(out, "script", "tts-segments-cosyvoice.json"), segments);
  const outputDir = join(out, "assets", "voice", "cosyvoice");
  ensureDir(outputDir);
  const speaker = process.env.COSYVOICE_SPEAKER || "中文女";
  const cachePath = join(outputDir, "cache-manifest.json");
  const cacheKey = fileHash(JSON.stringify({ backend: "cosyvoice_local", speaker, segments }));
  const files = segments.map((segment) => join(outputDir, `segment-${String(segment.index).padStart(4, "0")}.wav`));
  const cached = readJsonIfExists(cachePath);
  const cacheHit = cached?.cacheKey === cacheKey && files.every((file) => fileExists(file, 1000));
  if (cacheHit) {
    commandLog.push({
      command: "cosyvoice_local cache hit",
      cwd: out,
      category: "tts",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      status: 0,
      signal: null,
      stdout: `reused ${files.length} cached CosyVoice segments`,
      stderr: "",
      cacheHit: true,
    });
  } else {
    run(python, [
      writeCosyVoiceBatchScript(out),
      "--repo-dir", repo,
      "--model-dir", model,
      "--segments-json", join(out, "script", "tts-segments-cosyvoice.json"),
      "--output-dir", outputDir,
      "--speaker", speaker,
    ], {
      cwd: out,
      category: "tts",
      timeout: 3 * 60 * 60 * 1000,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        CUDA_VISIBLE_DEVICES: "",
      },
    });
    writeJson(cachePath, { cacheKey, backend: "cosyvoice_local", speaker, segments: segments.length, generatedAt: new Date().toISOString() });
  }
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length) throw new Error(`CosyVoice missing ${missing.length} segment files`);
  const filesBySegment = new Map(segments.map((segment) => [segment.index, chunksForSegment(outputDir, segment.index)]));
  const chunkFiles = segments.flatMap((segment) => filesBySegment.get(segment.index) || []);
  if (chunkFiles.length < files.length) throw new Error("CosyVoice generated fewer chunks than expected.");
  concatAudio(chunkFiles, rawOutput, out);
  const rawDuration = mediaDurationSeconds(rawOutput);
  const segmentTimings = buildSegmentTimings({ segments, filesBySegment, rawDuration });
  return {
    backend: "cosyvoice_local",
    rawOutput,
    segments: segments.length,
    chunks: chunkFiles.length,
    rawDurationSeconds: rawDuration,
    segmentTimings,
    segmentTimingSource: "actual_per_frame_tts_segments",
    speaker,
    cacheHit,
  };
}

function generateWithMeloTTS({ out, voiceRoot, narrationPath, rawOutput, narrationSegments = null }) {
  const melo = join(voiceRoot || "", "melotts", ".venv", "bin", "melo");
  if (!voiceRoot || !existsSync(melo)) {
    throw new Error("MeloTTS local POC environment not found under " + (voiceRoot || "<missing voice-quality-poc>"));
  }
  const speed = process.env.MELOTTS_SPEED || MELOTTS_ZH_DEFAULT_SPEED;
  const segments = normalizeTtsInputSegments(readFileSync(narrationPath, "utf8"), narrationSegments);
  writeJson(join(out, "script", "tts-segments-melotts.json"), segments);
  const outputDir = join(out, "assets", "voice", "melotts");
  ensureDir(outputDir);
  const cachePath = join(outputDir, "cache-manifest.json");
  const cacheKey = fileHash(JSON.stringify({
    backend: "melotts_local",
    language: MELOTTS_ZH_LANGUAGE,
    speed,
    segments,
  }));
  const cached = readJsonIfExists(cachePath);
  const files = segments.map((segment) => join(outputDir, `segment-${String(segment.index).padStart(4, "0")}.wav`));
  const cacheHit = cached?.cacheKey === cacheKey && files.every((file) => fileExists(file, 1000));
  if (cacheHit) {
    commandLog.push({
      command: "melotts_local cache hit",
      cwd: out,
      category: "tts",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      status: 0,
      signal: null,
      stdout: `reused ${files.length} cached MeloTTS segments`,
      stderr: "",
      cacheHit: true,
    });
  } else {
    for (const segment of segments) {
      const segmentTextPath = join(out, "script", `melotts-segment-${String(segment.index).padStart(4, "0")}.txt`);
      const segmentOutput = join(outputDir, `segment-${String(segment.index).padStart(4, "0")}.wav`);
      write(segmentTextPath, `${segment.text}\n`);
      run(melo, [
        "-l", MELOTTS_ZH_LANGUAGE,
        "-s", speed,
        "-d", "cpu",
        "-f", segmentTextPath,
        segmentOutput,
      ], {
        cwd: out,
        category: "tts",
        timeout: 3 * 60 * 60 * 1000,
        env: {
          ...process.env,
          PYTORCH_ENABLE_MPS_FALLBACK: "1",
          CUDA_VISIBLE_DEVICES: "",
        },
      });
    }
    writeJson(cachePath, { cacheKey, backend: "melotts_local", language: MELOTTS_ZH_LANGUAGE, speed, segments: segments.length, generatedAt: new Date().toISOString() });
  }
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length) throw new Error(`MeloTTS missing ${missing.length} segment files`);
  const filesBySegment = new Map(segments.map((segment) => [segment.index, [join(outputDir, `segment-${String(segment.index).padStart(4, "0")}.wav`)]]));
  concatAudio(files, rawOutput, out);
  const rawDuration = mediaDurationSeconds(rawOutput);
  const segmentTimings = buildSegmentTimings({ segments, filesBySegment, rawDuration });
  return {
    backend: "melotts_local",
    rawOutput,
    segments: segments.length,
    rawDurationSeconds: rawDuration,
    segmentTimings,
    segmentTimingSource: "actual_per_frame_tts_segments",
    language: MELOTTS_ZH_LANGUAGE,
    device: "cpu",
    speed,
    cacheHit,
  };
}

function generateWithSay({ out, narration, rawOutput, narrationSegments = null }) {
  const segments = normalizeTtsInputSegments(narration, narrationSegments);
  writeJson(join(out, "script", "tts-segments-say.json"), segments);
  const outputDir = join(out, "assets", "voice", "say");
  ensureDir(outputDir);
  const files = [];
  const voice = process.env.SAY_VOICE || "Samantha";
  const rate = process.env.SAY_RATE || "185";
  for (const segment of segments) {
    const base = `segment-${String(segment.index).padStart(4, "0")}`;
    const aiff = join(outputDir, `${base}.aiff`);
    const wav = join(outputDir, `${base}.wav`);
    run("say", ["-v", voice, "-r", rate, "-o", aiff, segment.text], { cwd: out, category: "tts" });
    run("ffmpeg", ["-y", "-i", aiff, "-ar", "48000", "-ac", "1", wav], { cwd: out, category: "tts" });
    files.push(wav);
  }
  const filesBySegment = new Map(segments.map((segment) => [segment.index, [join(outputDir, `segment-${String(segment.index).padStart(4, "0")}.wav`)]]));
  concatAudio(files, rawOutput, out);
  const rawDuration = mediaDurationSeconds(rawOutput);
  return {
    backend: "say",
    rawOutput,
    explicitFallback: true,
    voice,
    rate,
    segments: segments.length,
    rawDurationSeconds: rawDuration,
    segmentTimings: buildSegmentTimings({ segments, filesBySegment, rawDuration }),
    segmentTimingSource: "actual_per_frame_tts_segments",
  };
}

function voiceBackendOrder(value, allowSayFallback) {
  const requested = String(value || "auto").trim();
  let order;
  if (requested === "cosyvoice_local") order = ["cosyvoice_local", "melotts_local"];
  else if (requested === "melotts_local") order = ["melotts_local", "cosyvoice_local"];
  else if (requested === "auto") order = ["cosyvoice_local", "melotts_local"];
  else if (requested === "say" && allowSayFallback) order = ["say"];
  else if (requested === "say") throw new Error("--voice-backend say requires --allow-say-fallback and should be used only for explicitly degraded/local-English runs.");
  else throw new Error("--voice-backend must be auto, cosyvoice_local, melotts_local, or explicit say with --allow-say-fallback.");
  if (allowSayFallback) order.push("say");
  order = [...new Set(order)];
  return order;
}

function generateAudio({ out, narration, duration, voiceBackend = "auto", allowSayFallback = false, voiceDirection, coverIntroSeconds = 0, narrationSegments = null }) {
  const assets = join(out, "assets");
  const raw = join(assets, "narration.raw.wav");
  const narrationM4a = join(assets, "narration.m4a");
  const narrationWav = join(assets, "narration.wav");
  const narrationMp3 = join(assets, "narration.mp3");
  const bgm = join(assets, "generated-pad.m4a");
  const mixed = join(assets, "mix.m4a");
  const voiceRoot = findVoicePocRoot(out);
  const failures = [];
  const order = voiceBackendOrder(voiceBackend, allowSayFallback);
  let selected = null;
  for (const backend of order) {
    try {
      if (backend === "cosyvoice_local") {
        selected = generateWithCosyVoice({ out, voiceRoot, narration, rawOutput: raw, narrationSegments });
      } else if (backend === "melotts_local") {
        selected = generateWithMeloTTS({ out, voiceRoot, narrationPath: join(out, "script", "narration-spoken.txt"), rawOutput: raw, narrationSegments });
      } else if (backend === "say") {
        selected = generateWithSay({ out, narration, rawOutput: raw, narrationSegments });
      }
      break;
    } catch (error) {
      failures.push({ backend, error: error.message });
      write(join(out, "logs", `voice-${backend}.log`), `${error.stack || error.message}\n`);
    }
  }
  if (!selected) {
    throw new Error(`CosyVoice and MeloTTS both failed. Refusing non-local-TTS fallback by default: ${JSON.stringify(failures)}`);
  }
  const rawDuration = selected.rawDurationSeconds || mediaDurationSeconds(selected.rawOutput || raw);
  if (!rawDuration || rawDuration < 1) {
    throw new Error(`Generated narration has invalid duration: ${rawDuration}`);
  }
  const finalDuration = Number((coverIntroSeconds + rawDuration).toFixed(3));
  const coverDelayMs = Math.round(coverIntroSeconds * 1000);
  const narrationFilter = [
    ...(coverIntroSeconds > 0 ? [`adelay=${coverDelayMs}|${coverDelayMs}`] : []),
    "apad",
    `atrim=0:${finalDuration}`,
    `afade=t=out:st=${Math.max(0, finalDuration - 0.35).toFixed(3)}:d=0.3`,
  ].join(",");
  run("ffmpeg", [
    "-y",
    "-i", selected.rawOutput || raw,
    "-af", narrationFilter,
    "-ar", "48000",
    "-ac", "2",
    narrationWav,
  ], { cwd: out });
  run("ffmpeg", ["-y", "-i", narrationWav, "-codec:a", "libmp3lame", "-q:a", "2", narrationMp3], { cwd: out });
  run("ffmpeg", ["-y", "-i", narrationWav, "-c:a", "aac", "-b:a", "192k", narrationM4a], { cwd: out });
  run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `sine=frequency=98:duration=${finalDuration}`,
    "-f", "lavfi", "-i", `sine=frequency=196:duration=${finalDuration}`,
    "-filter_complex", `[0:a]volume=-26dB[a0];[1:a]volume=-33dB[a1];[a0][a1]amix=inputs=2,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, finalDuration - 2)}:d=2[a]`,
    "-map", "[a]",
    "-c:a", "aac",
    "-b:a", "160k",
    bgm,
  ], { cwd: out });
  run("ffmpeg", [
    "-y",
    "-i", narrationM4a,
    "-i", bgm,
    "-filter_complex", "[0:a]volume=1.2,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,dynaudnorm=f=150:g=9:p=0.9[a0];[1:a]volume=0.35[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=10[a]",
    "-map", "[a]",
    "-c:a", "aac",
    "-b:a", "192k",
    mixed,
  ], { cwd: out });
  writeJson(join(out, "workflow", "voice-subtitle-manifest.json"), {
    voiceBackend: selected.backend,
    requestedVoiceBackend: voiceBackend,
    backendOrder: order,
    failures,
    narration: "assets/narration.m4a",
    reviewWav: "assets/narration.wav",
    reviewMp3: "assets/narration.mp3",
    sourceNarration: "script/narration.txt",
    spokenNarration: "script/narration-spoken.txt",
    voiceDirection: "workflow/voice-direction.json",
    speechStyle: voiceDirection?.speechStyle || "unknown",
    pauseDurations: voiceDirection?.pauseDurations,
    shortPausePolicy: voiceDirection?.shortPausePolicy,
    music: "assets/generated-pad.m4a",
    mix: "assets/mix.m4a",
    subtitleFile: "script/subtitles.srt",
    segmentTimingSource: selected.segmentTimingSource || "unknown",
    segmentTimings: selected.segmentTimings || [],
    ttsParameters: selected.backend === "melotts_local"
      ? {
          language: selected.language,
          speed: selected.speed,
          device: selected.device,
          requiredLanguageCase: "uppercase ZH",
        }
      : selected.backend === "say"
        ? {
            voice: selected.voice,
            rate: selected.rate,
            explicitFallback: true,
          }
      : undefined,
    loudnessPolicy: {
      target: "normal spoken-video volume; slightly amplified narration is preferred over quiet narration",
      minMeanDb: MIN_AUDIBLE_MEAN_DB,
      minMaxDb: MIN_AUDIBLE_MAX_DB,
    },
    dynamicsProcessing: {
      filterChain: "volume=1.2,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,dynaudnorm=f=150:g=9:p=0.9,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=10",
      purpose: "reduce noticeable narration loudness swings while preserving clear口播 presence",
    },
    timing: {
      estimatedDurationSeconds: duration,
      rawNarrationDurationSeconds: rawDuration,
      coverIntroSeconds,
      finalDurationSeconds: finalDuration,
      policy: "Final duration follows actual generated narration plus the opening cover. Each main visual scene duration must be bound to its own generated TTS segment duration, not an average split.",
    },
    policy: "CosyVoice/MeloTTS local generation by default. No voice cloning, no celebrity/likeness imitation, no private upload, no paid API. macOS say is allowed only with --allow-say-fallback.",
  });
  return { voiceBackend: selected.backend, narrationM4a, bgm, mixed, rawDurationSeconds: rawDuration, durationSeconds: finalDuration, coverIntroSeconds, segmentTimings: selected.segmentTimings || [], segmentTimingSource: selected.segmentTimingSource || "unknown" };
}

function parseVolumeDetect(output) {
  const mean = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const max = output.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  return {
    meanVolume: mean ? Number(mean[1]) : null,
    maxVolume: max ? Number(max[1]) : null,
  };
}

function parseSilenceDetect(output, fallbackDuration = 0) {
  const ranges = [];
  let currentStart = null;
  for (const line of String(output || "").split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*([0-9.]+)/i);
    if (start) {
      currentStart = Number(start[1]);
      continue;
    }
    const end = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/i);
    if (end && currentStart !== null) {
      ranges.push({
        start: currentStart,
        end: Number(end[1]),
        duration: Number(end[2]),
      });
      currentStart = null;
    }
  }
  if (currentStart !== null && fallbackDuration > currentStart) {
    ranges.push({
      start: currentStart,
      end: fallbackDuration,
      duration: fallbackDuration - currentStart,
      openEnded: true,
    });
  }
  return ranges;
}

function problematicNarrationSilences(ranges, { coverIntroSeconds, duration }) {
  const openingAllowance = Number(coverIntroSeconds || 0) + 0.75;
  const endingAllowance = Math.max(0, Number(duration || 0) - 0.75);
  return ranges.filter((range) => {
    if (range.end <= openingAllowance) return false;
    if (range.start >= endingAllowance) return false;
    return range.duration > 3;
  });
}

async function renderWithHtmlVideo({ out, brief, frames, narration, audio, designPlan }) {
  const cliPath = resolve(ROOT, "research/html-video-research/html-video/packages/cli/dist/index.js");
  if (!existsSync(cliPath)) throw new Error(`html-video CLI build not found at ${cliPath}`);
  const { bootstrap } = await import(pathToFileURL(cliPath).href);
  const ctx = await bootstrap({ cwd: out });
  const coverIntroSeconds = audio.coverIntroSeconds || 0;
  const coverFile = join(out, "cover", "cover-video-opening-16x9.svg");
  const renderFrames = coverIntroSeconds > 0
    ? [{
        id: "opening-cover",
        kind: "cover",
        label: "视频封面",
        headline: [brief.coverTheme || brief.title || "视频封面"],
        subtitle: "",
        durationSec: coverIntroSeconds,
        coverFile,
      }, ...frames]
    : frames;
  const project = await ctx.orchestrator.create({
    name: "codex-viral-novel-writing",
    intent: brief.objective || brief.title,
    preferences: {
      aspect: "16:9",
      commercial: false,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      language: brief.language || "zh",
      durationTargetSec: renderFrames.reduce((sum, frame) => sum + frame.durationSec, 0),
    },
  });
  await ctx.orchestrator.setTemplate(project.id, "frame-bold-poster");
  const graph = {
    schemaVersion: 1,
    intent: designPlan.videoType,
    synopsis: brief.objective || brief.title,
    nodes: renderFrames.map((frame) => ({
      id: frame.id,
      kind: "text",
      label: frame.label,
      frameIntent: frame.kind === "cover"
        ? "video-internal-opening-cover"
        : designPlan.pages.find((page) => page.id === frame.id)?.shotTemplate || "designed-video-scene",
      durationSec: frame.durationSec,
      text: frame.headline.join(" "),
      visualRole: designPlan.pages.find((page) => page.id === frame.id)?.visualRole,
      imagePrompt: designPlan.pages.find((page) => page.id === frame.id)?.image2Prompt,
    })),
    edges: renderFrames.slice(0, -1).map((frame, index) => ({
      from: frame.id,
      to: renderFrames[index + 1].id,
      kind: "dependency",
      reason: "linear teaching sequence",
    })),
  };
  await ctx.orchestrator.writeContentGraph(project.id, graph);
  for (let i = 0; i < renderFrames.length; i += 1) {
    const frame = renderFrames[i];
    const sceneIndex = i - (coverIntroSeconds > 0 ? 1 : 0);
    const html = frame.kind === "cover"
      ? coverFrameHtml(readFileSync(frame.coverFile, "utf8"))
      : frameHtml(frame, sceneIndex, frames.length, designPlan.pages[sceneIndex]);
    await ctx.orchestrator.writeFrameHtml(project.id, frame.id, html);
  }
  await ctx.orchestrator.addFileAsset(project.id, audio.narrationM4a, "Chinese system TTS narration");
  await ctx.orchestrator.addFileAsset(project.id, audio.bgm, "Generated sine-pad background");
  const withAssets = await ctx.orchestrator.load(project.id);
  const narrationAsset = withAssets.assets.find((asset) => asset.metadata.filename === "narration.m4a");
  const bgmAsset = withAssets.assets.find((asset) => asset.metadata.filename === "generated-pad.m4a");
  withAssets.soundtrack = {
    narrationAssetId: narrationAsset?.id,
    musicAssetId: bgmAsset?.id,
    narrationText: narration,
    narrationByFrame: Object.fromEntries(renderFrames.map((frame) => [frame.id, frame.subtitle])),
    musicPrompt: "locally generated low sine-pad bed",
    musicVolumeDb: -24,
    narrationVolumeDb: 1,
    fadeInSec: 0.4,
    fadeOutSec: 1.2,
  };
  await ctx.projects.save(withAssets);
  const result = await ctx.orchestrator.exportMp4({
    projectId: project.id,
    outputPath: join(out, "renders", "final.mp4"),
    onProgress: (pct, stage) => process.stdout.write(`[render] ${Math.round(pct)}% ${stage}\n`),
  });
  writeJson(join(out, "workflow", "html-video-render.json"), {
    projectId: project.id,
    projectStore: join(out, ".html-video", "projects", project.id),
    outputPath: result.outputPath,
    renderer: "html-video",
    openingCoverInVideo: coverIntroSeconds > 0,
    openingCoverSeconds: coverIntroSeconds,
    openingCoverFile: "cover/cover-video-opening-16x9.svg",
  });
  return result.outputPath;
}

function renderWithFallback({ out, frames, audio, duration, designPlan }) {
  write(join(out, "logs", "fallback-render.log"), "Fallback renderer used. This path creates local SVG cards, converts them through macOS Quick Look, then uses ffmpeg for concat/audio mux.\n");
  const list = join(out, "workflow", "fallback-concat.txt");
  const parts = [];
  const renderStamp = `${process.pid}-${Date.now()}`;
  const coverIntroSeconds = audio.coverIntroSeconds || 0;
  const coverFile = join(out, "cover", "cover-video-opening-16x9.svg");
  const renderFrames = coverIntroSeconds > 0 && existsSync(coverFile)
    ? [{
        id: "opening-cover",
        kind: "cover",
        durationSec: coverIntroSeconds,
        coverFile,
      }, ...frames]
    : frames;
  for (let i = 0; i < renderFrames.length; i += 1) {
    const frame = renderFrames[i];
    const sceneIndex = i - (renderFrames.length === frames.length ? 0 : 1);
    const svg = join(out, "assets", `scene-${String(i + 1).padStart(2, "0")}-${renderStamp}.svg`);
    const image = `${svg}.png`;
    write(svg, frame.kind === "cover"
      ? readFileSync(frame.coverFile, "utf8")
      : fallbackSvgCard(frame, sceneIndex, frames.length, designPlan.pages[sceneIndex]));
    run("qlmanage", ["-t", "-s", "1920", "-o", dirname(svg), svg], { cwd: out });
    run("sips", ["-z", "1080", "1920", image], { cwd: out });
    const part = join(out, "renders", `part-${String(i + 1).padStart(2, "0")}.mp4`);
    run("ffmpeg", [
      "-y",
      "-loop", "1",
      "-t", String(frame.durationSec),
      "-i", image,
      "-vf", "scale=1920:1080,format=yuv420p",
      "-r", "30",
      "-c:v", "libx264",
      part,
    ], { cwd: out });
    parts.push(part);
  }
  writeJson(join(out, "workflow", "fallback-render.json"), {
    renderer: "ffmpeg-fallback",
    openingCoverInVideo: coverIntroSeconds > 0 && existsSync(coverFile),
    openingCoverSeconds: coverIntroSeconds,
    openingCoverFile: "cover/cover-video-opening-16x9.svg",
  });
  write(list, parts.map((part) => `file '${part.replaceAll("'", "'\\''")}'`).join("\n"));
  const silentVideo = join(out, "renders", "fallback-silent.mp4");
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silentVideo], { cwd: out });
  const final = join(out, "renders", "final.mp4");
  run("ffmpeg", [
    "-y",
    "-i", silentVideo,
    "-i", audio.mixed,
    "-t", String(duration),
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    final,
  ], { cwd: out });
  return final;
}

function runQc({ out, finalMp4, duration, renderer, voiceBackend, allowDegradedRenderer = false }) {
  const logs = join(out, "logs");
  const screenshots = join(out, "screenshots");
  const brief = readJsonIfExists(join(out, "brief.json")) || {};
  const renderManifest = readJsonIfExists(join(out, "workflow", "html-video-render.json"))
    || readJsonIfExists(join(out, "workflow", "fallback-render.json"))
    || {};
  const voiceManifest = readJsonIfExists(join(out, "workflow", "voice-subtitle-manifest.json")) || {};
  const syncPlan = readJsonIfExists(join(out, "workflow", "sync-timecode-plan.json")) || {};
  const designPlan = readJsonIfExists(join(out, "workflow", "design-plan.json")) || {};
  const motionSelection = readJsonIfExists(join(out, "workflow", "motion-template-selection.json")) || {};
  const visualAssetManifest = readJsonIfExists(join(out, "workflow", "visual-asset-manifest.json")) || {};
  const qualityContract = readJsonIfExists(join(out, "workflow", "quality-consistency-contract.json")) || {};
  const coverIntroSeconds = Number(voiceManifest.timing?.coverIntroSeconds || renderManifest.openingCoverSeconds || 0);
  const ffprobe = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,duration",
    "-of", "json",
    finalMp4,
  ], { cwd: out });
  const metadata = JSON.parse(ffprobe.stdout);
  writeJson(join(logs, "ffprobe.json"), metadata);
  const black = run("ffmpeg", [
    "-v", "info",
    "-i", finalMp4,
    "-vf", "blackdetect=d=0.2:pix_th=0.10",
    "-an",
    "-f", "null",
    "-",
  ], { cwd: out, check: false });
  write(join(logs, "blackdetect.log"), `${black.stderr || ""}\n${black.stdout || ""}`);
  const volume = run("ffmpeg", [
    "-i", finalMp4,
    "-af", "volumedetect",
    "-vn",
    "-sn",
    "-dn",
    "-f", "null",
    "-",
  ], { cwd: out, check: false });
  const volumeLog = `${volume.stderr || ""}\n${volume.stdout || ""}`;
  write(join(logs, "volumedetect.log"), volumeLog);
  const loudness = parseVolumeDetect(volumeLog);
  const narrationWav = join(out, "assets", "narration.wav");
  const silenceTarget = existsSync(narrationWav) ? narrationWav : finalMp4;
  const silence = run("ffmpeg", [
    "-hide_banner",
    "-i", silenceTarget,
    "-af", "silencedetect=n=-42dB:d=1.2",
    "-f", "null",
    "-",
  ], { cwd: out, check: false });
  const silenceLog = `${silence.stderr || ""}\n${silence.stdout || ""}`;
  write(join(logs, "silencedetect.log"), silenceLog);
  const silenceRanges = parseSilenceDetect(silenceLog, duration);
  const longNarrationSilences = problematicNarrationSilences(silenceRanges, { coverIntroSeconds, duration });
  const shotTimes = [
    coverIntroSeconds > 0 ? Math.min(0.5, Math.max(0.1, coverIntroSeconds / 2)) : 2,
    Math.min(Math.max(3, duration - 3), Math.floor(duration / 2) + 3),
    Math.max(4, duration - 3),
  ];
  shotTimes.forEach((time, index) => {
    run("ffmpeg", [
      "-y",
      "-ss", String(time),
      "-i", finalMp4,
      "-frames:v", "1",
      join(screenshots, `frame-${String(index + 1).padStart(2, "0")}.png`),
    ], { cwd: out });
  });
  const video = metadata.streams.find((stream) => stream.codec_type === "video") || {};
  const audio = metadata.streams.find((stream) => stream.codec_type === "audio") || {};
  const actualDuration = Number(metadata.format?.duration || 0);
  const videoDuration = Number(video.duration || actualDuration || 0);
  const audioDuration = Number(audio.duration || actualDuration || 0);
  const audioVideoDelta = Math.abs(videoDuration - audioDuration);
  const blackHits = /black_start:/i.test(`${black.stderr || ""}\n${black.stdout || ""}`);
  const requiredFiles = [
    "brief.json",
    "script/narration.txt",
    "script/narration-spoken.txt",
    "script/frame-narration-segments.json",
    "script/storyboard.md",
    "script/subtitles.srt",
    "workflow/commands.json",
    "workflow/tool-candidate-selection.json",
    "workflow/voice-direction.json",
    "workflow/voice-subtitle-manifest.json",
    "workflow/sync-timecode-plan.json",
    "workflow/cover-design.json",
    "workflow/content-presentation-design.json",
    "workflow/quality-consistency-contract.json",
    "workflow/aesthetic-brief.json",
    "workflow/aesthetic-quality-rubric.md",
    "workflow/motion-template-selection.json",
    "workflow/design-plan.json",
    "workflow/image2-prompts.json",
    "workflow/visual-asset-manifest.json",
    "AUTHORIZATION.md",
    "renders/final.mp4",
    "logs/ffprobe.json",
    "logs/blackdetect.log",
    "logs/volumedetect.log",
    "logs/silencedetect.log",
  ];
  const checks = {
    durationRange: actualDuration >= MIN_DURATION_SECONDS - 0.5,
    requestedDurationClose: Math.abs(actualDuration - duration) <= 2.5,
    resolution1080p: video.width === 1920 && video.height === 1080,
    hasVideo: Boolean(video.codec_name),
    hasAudio: Boolean(audio.codec_name),
    audibleAudio: loudness.meanVolume !== null
      && loudness.maxVolume !== null
      && loudness.meanVolume >= MIN_AUDIBLE_MEAN_DB
      && loudness.maxVolume >= MIN_AUDIBLE_MAX_DB,
    voiceBackendCompliant: ["cosyvoice_local", "melotts_local"].includes(voiceBackend)
      || (brief.language === "en" && voiceBackend === "say"),
    voiceDirectionPresent: existsSync(join(out, "workflow", "voice-direction.json")),
    contentPresentationDesignPresent: (() => {
      try {
        const presentation = JSON.parse(readFileSync(join(out, "workflow", "content-presentation-design.json"), "utf8"));
        return Boolean(presentation.topicType)
          && Boolean(presentation.audienceState)
          && Array.isArray(presentation.contentJobs)
          && presentation.contentJobs.length > 0
          && Boolean(presentation.informationHierarchy)
          && Boolean(presentation.displayLogic)
          && Boolean(presentation.visualMetaphor)
          && Boolean(presentation.layoutSystem)
          && Boolean(presentation.motionPurpose)
          && Boolean(presentation.syncContract)
          && Boolean(presentation.coverContinuity)
          && Array.isArray(presentation.rejectList)
          && presentation.rejectList.length > 0;
      } catch {
        return false;
      }
    })(),
    syncTimecodePlanPresent: (() => {
      try {
        return Array.isArray(syncPlan.scenes)
          && syncPlan.scenes.length >= 3
          && /actual_per_frame_tts_segments/.test(syncPlan.source || "")
          && Array.isArray(syncPlan.sharedBy)
          && syncPlan.sharedBy.includes("subtitles")
          && syncPlan.sharedBy.includes("per-frame TTS segment durations")
          && /ASR|forced|per-frame TTS/i.test(syncPlan.upgradeRequiredForLongNarration || syncPlan.source || "");
      } catch {
        return false;
      }
    })(),
    frameAudioTimingBound: (() => {
      const scenes = Array.isArray(syncPlan.scenes) ? syncPlan.scenes : [];
      const timings = Array.isArray(voiceManifest.segmentTimings) ? voiceManifest.segmentTimings : [];
      if (!/actual_per_frame_tts_segments/.test(syncPlan.source || "")) return false;
      if (voiceManifest.segmentTimingSource !== "actual_per_frame_tts_segments") return false;
      if (!scenes.length || scenes.length !== timings.length) return false;
      return scenes.every((scene, index) => {
        const timing = timings[index] || {};
        const sceneStart = Number(scene.start || 0);
        const sceneEnd = Number(scene.end || 0);
        const expectedStart = Number((Number(timing.start || 0) + coverIntroSeconds).toFixed(3));
        const expectedEnd = Number((Number(timing.end || 0) + coverIntroSeconds).toFixed(3));
        return scene.id === timing.frameId
          && scene.durationSource === "actual_tts_segment_duration"
          && Math.abs(Number(scene.duration || 0) - Number(timing.durationSeconds || 0)) <= 0.075
          && Math.abs(sceneStart - expectedStart) <= 0.075
          && Math.abs(sceneEnd - expectedEnd) <= 0.075
          && textComparable(scene.spokenText || scene.subtitle) === textComparable(timing.text);
      });
    })(),
    audioVideoDurationDeltaOk: audioVideoDelta <= (1 / 30 + 0.2),
    openingCoverInVideo: renderer === "html-video"
      ? renderManifest.openingCoverInVideo === true
        && Number(renderManifest.openingCoverSeconds || 0) >= COVER_INTRO_SECONDS
        && Boolean(renderManifest.openingCoverFile)
        && existsSync(join(out, renderManifest.openingCoverFile))
      : allowDegradedRenderer,
    narrationContinuityOk: longNarrationSilences.length === 0
      && Number(voiceManifest.timing?.rawNarrationDurationSeconds || 0) >= Math.max(1, Number(duration || 0) - coverIntroSeconds - 1.5),
    coverDesignPresent: (() => {
      try {
        const cover = JSON.parse(readFileSync(join(out, "workflow", "cover-design.json"), "utf8"));
        return Array.isArray(cover.platformTargets)
          && cover.platformTargets.length >= 5
          && Array.isArray(cover.platformVariants)
          && cover.platformVariants.length >= 6
          && Boolean(cover.videoInternalCover)
          && cover.videoInternalCover.ratio === aspectRatio(1920, 1080)
          && cover.platformTargets.some((target) => target.platform === "Bilibili" && target.ratio === "4:3")
          && Boolean(cover.coverPromise)
          && Boolean(cover.hookText)
          && Boolean(cover.curiosityGap)
          && Boolean(cover.viewerDecision)
          && Boolean(cover.visualSubject)
          && Boolean(cover.composition)
          && Boolean(cover.typography)
          && Boolean(cover.colorContrast)
          && Boolean(cover.contentTruth)
          && Array.isArray(cover.rejectList);
      } catch {
        return false;
      }
    })(),
    coverFilesPresent: (() => {
      try {
        const cover = JSON.parse(readFileSync(join(out, "workflow", "cover-design.json"), "utf8"));
        const files = [
          cover.videoInternalCover?.file,
          ...(Array.isArray(cover.platformVariants) ? cover.platformVariants.map((variant) => variant.file) : []),
        ].filter(Boolean);
        return files.length >= 7
          && files.every((file) => existsSync(join(out, file)))
          && files.includes("cover/cover-bilibili-4x3.svg")
          && files.includes("cover/cover-video-opening-16x9.svg");
      } catch {
        return false;
      }
    })(),
    spokenNarrationPresent: existsSync(join(out, "script", "narration-spoken.txt")),
    voicePausePolicyPresent: (() => {
      try {
        const direction = JSON.parse(readFileSync(join(out, "workflow", "voice-direction.json"), "utf8"));
        const spoken = readFileSync(join(out, "script", "narration-spoken.txt"), "utf8");
        const pause = direction.pauseDurations || {};
        return Boolean(direction.sentenceRule)
          && Array.isArray(direction.hardRules)
          && direction.hardRules.some((rule) => /complete sentences/.test(rule))
          && direction.hardRules.some((rule) => /Comma-like punctuation/.test(rule))
          && pause.commaLikeSeconds === SHORT_PUNCTUATION_PAUSE_SECONDS
          && pause.sentenceEnd === SENTENCE_END_PAUSE_SECONDS
          && Array.isArray(pause.commaLikePunctuation)
          && pause.commaLikePunctuation.includes("，")
          && !hasLineBreakAfterComma(spoken)
          && /\n/.test(spoken.trim());
      } catch {
        return false;
      }
    })(),
    aestheticBriefPresent: existsSync(join(out, "workflow", "aesthetic-brief.json")),
    aestheticRubricPresent: existsSync(join(out, "workflow", "aesthetic-quality-rubric.md")),
    qualityConsistencyContractPresent: (() => {
      try {
        return qualityContract.schemaVersion === 1
          && qualityContract.status === "required-final-quality-gate"
          && Boolean(qualityContract.qualityProfile)
          && qualityContract.consistencyAnchors?.templateKitId === designPlan.templateKit?.id
          && qualityContract.consistencyAnchors?.motionTemplateId === motionSelection.selectedTemplate
          && Array.isArray(qualityContract.consistencyAnchors?.palette)
          && qualityContract.consistencyAnchors.palette.length >= 4
          && Array.isArray(qualityContract.hardGates)
          && qualityContract.hardGates.includes("frameAudioTimingBound")
          && qualityContract.hardGates.includes("openingCoverInVideo")
          && qualityContract.hardGates.includes("rendererNotDegraded")
          && Array.isArray(qualityContract.requiredArtifacts)
          && qualityContract.requiredArtifacts.includes("workflow/quality-scorecard.md")
          && Array.isArray(qualityContract.sceneContracts)
          && qualityContract.sceneContracts.length === (Array.isArray(designPlan.pages) ? designPlan.pages.length : 0)
          && Array.isArray(qualityContract.rejectList)
          && qualityContract.rejectList.includes("static PPT cards")
          && qualityContract.rejectList.includes("average-duration visual timing");
      } catch {
        return false;
      }
    })(),
    qualityConsistencyContractEnforced: (() => {
      try {
        const pages = Array.isArray(designPlan.pages) ? designPlan.pages : [];
        const scenes = Array.isArray(qualityContract.sceneContracts) ? qualityContract.sceneContracts : [];
        const assets = Array.isArray(visualAssetManifest.insertedVisualAssets) ? visualAssetManifest.insertedVisualAssets : [];
        if (!pages.length || pages.length !== scenes.length || assets.length < pages.length) return false;
        const minimumDistinctShotTemplates = Number(qualityContract.variationPolicy?.minimumDistinctShotTemplates || 3);
        const minimumDistinctVisualRoles = Number(qualityContract.variationPolicy?.minimumDistinctVisualRoles || 3);
        const shotTemplates = new Set(scenes.map((scene) => scene.shotTemplate).filter(Boolean));
        const visualRoles = new Set(scenes.map((scene) => scene.visualRole).filter(Boolean));
        if (shotTemplates.size < Math.min(minimumDistinctShotTemplates, scenes.length)) return false;
        if (visualRoles.size < Math.min(minimumDistinctVisualRoles, scenes.length)) return false;
        return scenes.every((scene, index) => {
          const page = pages[index] || {};
          const asset = assets.find((item) => item.sceneId === scene.sceneId);
          return scene.sceneId === page.id
            && scene.order === page.sceneIndex
            && scene.shotTemplate === page.shotTemplate
            && scene.visualRole === page.visualRole
            && scene.camera === page.camera
            && scene.insertedVisualRequired === true
            && scene.captionSafeArea === "bottom-caption-band"
            && Boolean(scene.motion?.entrance)
            && Boolean(scene.motion?.emphasis)
            && Boolean(scene.motion?.transition)
            && Boolean(asset?.selectedAsset)
            && existsSync(join(out, asset.selectedAsset));
        });
      } catch {
        return false;
      }
    })(),
    aestheticCapabilityRoutingPresent: (() => {
      try {
        const brief = JSON.parse(readFileSync(join(out, "workflow", "aesthetic-brief.json"), "utf8"));
        return Array.isArray(brief.capabilityRouting) && brief.capabilityRouting.length >= 5
          && Boolean(brief.composition?.rule)
          && Boolean(brief.imagery?.strategy)
          && Array.isArray(brief.avoid)
          && brief.avoid.includes("纯文字卡片");
      } catch {
        return false;
      }
    })(),
    motionTemplateSelectionPresent: (() => {
      try {
        const selection = JSON.parse(readFileSync(join(out, "workflow", "motion-template-selection.json"), "utf8"));
        return Boolean(selection.selectedTemplate)
          && Boolean(selection.sourcePlatformLogic)
          && Boolean(selection.whyThisTemplate)
          && Boolean(selection.motionJobs?.entrance)
          && Boolean(selection.motionJobs?.reveal)
          && Boolean(selection.semanticBinding)
          && Boolean(selection.interactionFeeling)
          && Boolean(selection.implementationPath)
          && Boolean(selection.fallbackPolicy)
          && Array.isArray(selection.verification)
          && selection.verification.length > 0
          && Array.isArray(selection.rejectList)
          && selection.rejectList.length > 0;
      } catch {
        return false;
      }
    })(),
    designPlanPresent: existsSync(join(out, "workflow", "design-plan.json")),
    image2PromptsPresent: existsSync(join(out, "workflow", "image2-prompts.json")),
    visualAssetManifestPresent: existsSync(join(out, "workflow", "visual-asset-manifest.json")),
    insertedVisualAssetsPresent: (() => {
      try {
        return Array.isArray(visualAssetManifest.insertedVisualAssets) && visualAssetManifest.insertedVisualAssets.length >= 3
          && visualAssetManifest.insertedVisualAssets.every((asset) => asset.selectedAsset && existsSync(join(out, asset.selectedAsset)));
      } catch {
        return false;
      }
    })(),
    blackdetectClean: !blackHits,
    requiredFilesPresent: requiredFiles.every((file) => existsSync(join(out, file))),
    screenshotsPresent: ["frame-01.png", "frame-02.png", "frame-03.png"].every((file) => existsSync(join(screenshots, file))),
    rendererNotDegraded: renderer !== "ffmpeg-fallback" || allowDegradedRenderer,
  };
  const pass = Object.values(checks).every(Boolean);
  const qc = {
    pass,
    renderer,
    allowDegradedRenderer,
    voiceBackend,
    finalMp4,
    duration: actualDuration,
    width: video.width,
    height: video.height,
    meanVolume: loudness.meanVolume,
    maxVolume: loudness.maxVolume,
    coverIntroSeconds,
    silenceRanges,
    longNarrationSilences,
    audioVideoDelta,
    loudnessPolicy: {
      minMeanDb: MIN_AUDIBLE_MEAN_DB,
      minMaxDb: MIN_AUDIBLE_MAX_DB,
    },
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    checks,
  };
  writeJson(join(logs, "qc.json"), qc);
  const rows = [
    ["Reproducibility", pass ? "PASS" : "WARN", "Commands, brief, storyboard, subtitles, logs, screenshots, and manifest are written locally."],
    ["Rights safety", "PASS", "Original text/HTML plus local TTS and ffmpeg-generated audio bed; no external media."],
    ["Script originality", "PASS", "Original narration and examples for this workflow."],
    ["Content presentation design", checks.contentPresentationDesignPresent ? "PASS" : "FAIL", "Topic type, audience state, hierarchy, display logic, metaphor, layout, motion purpose, and reject list are planned before render."],
    ["Quality consistency contract", checks.qualityConsistencyContractPresent && checks.qualityConsistencyContractEnforced ? "PASS" : "FAIL", "A reusable quality baseline binds template, palette, motion, visuals, captions, cover, audio sync, and scene variation gates."],
    ["Sync timecode", checks.syncTimecodePlanPresent && checks.frameAudioTimingBound && checks.audioVideoDurationDeltaOk ? "PASS" : "FAIL", `Scene timing is bound to actual per-frame TTS segments; audio/video duration delta ${audioVideoDelta.toFixed(3)}s.`],
    ["Cover/thumbnail strategy", checks.coverDesignPresent && checks.coverFilesPresent ? "PASS" : "FAIL", "Platform cover targets, promise, hook text, subject, composition, type, contrast, and variants are written."],
    ["Opening cover in MP4", checks.openingCoverInVideo ? "PASS" : "FAIL", `Video-internal cover is rendered into the MP4 for ${coverIntroSeconds}s, not only exported as a standalone file.`],
    ["Aesthetic direction", checks.aestheticBriefPresent && checks.aestheticCapabilityRoutingPresent ? "PASS" : "FAIL", "Art direction, anti-PPT rules, and design/polish capability routing are written before render."],
    ["HTML motion template", checks.motionTemplateSelectionPresent ? "PASS" : "FAIL", "A reusable motion template, platform logic, semantic binding, fallback policy, and verification route are recorded before rendering."],
    ["Visual design plan", checks.designPlanPresent && checks.image2PromptsPresent ? "PASS" : "FAIL", "Type-specific template, motion language, and image2-compatible prompts are recorded before rendering."],
    ["Inserted visuals", checks.insertedVisualAssetsPresent ? "PASS" : "FAIL", "Each scene has an inserted original illustration layer or explicitly generated image asset."],
    ["Visual readability", checks.resolution1080p && checks.screenshotsPresent ? "PASS" : "WARN", "1920x1080 designed scenes with inserted visuals, large text, and bottom captions."],
    ["Audio/subtitle alignment", checks.hasAudio && checks.audibleAudio && checks.frameAudioTimingBound ? "PASS" : "FAIL", `Voice backend: ${voiceBackend}; mean ${loudness.meanVolume ?? "n/a"} dB; max ${loudness.maxVolume ?? "n/a"} dB; SRT scenes match TTS segment timing.`],
    ["Narration continuity", checks.narrationContinuityOk ? "PASS" : "FAIL", longNarrationSilences.length ? `Long post-opening silence detected: ${JSON.stringify(longNarrationSilences)}` : "No long post-opening narration silence detected."],
    ["Voice direction", checks.voiceDirectionPresent && checks.voicePausePolicyPresent ? "PASS" : "FAIL", "Speech style, sentence-complete pause policy, comma short-pause policy, and spoken narration file are generated before TTS."],
    ["Voice backend compliance", checks.voiceBackendCompliant ? "PASS" : "FAIL", "Chinese narration must use cosyvoice_local or melotts_local for final-quality runs."],
    ["Render stability", pass ? "PASS" : "WARN", `Renderer: ${renderer}; blackdetect clean: ${checks.blackdetectClean}.`],
    ["Platform readiness", "WARN", "Human review still required for AI labeling, licensing, policy, and editorial suitability."],
  ];
  write(
    join(out, "workflow", "quality-scorecard.md"),
    `# Quality Scorecard

| Check | Status | Evidence |
| --- | --- | --- |
${rows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join("\n")}
`,
  );
  return qc;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.brief || !args.out) {
    usage();
    if (!args.help) process.exit(1);
    return;
  }
  const out = resolve(ROOT, args.out);
  const brief = JSON.parse(readFileSync(resolve(ROOT, args.brief), "utf8"));
  const initialFrames = normalizeFrames(brief, DEFAULT_DURATION);
  const narration = String(brief.narration || initialFrames.map((frame) => frame.subtitle).join(""));
  const fixedBriefDuration = brief.durationMode === "fixed" || brief.fixedDuration === true;
  const estimatedDuration = args.duration
    ? clampDuration(args.duration)
    : fixedBriefDuration && brief.durationSeconds
      ? clampDuration(brief.durationSeconds)
      : estimateAutoDuration({ narration, frames: initialFrames, brief });
  let frames = normalizeFrames(brief, estimatedDuration);
  const requestedMode = args.mode === "fallback" ? "fallback" : "recommended";
  const allowDegradedRenderer = Boolean(args["allow-degraded-renderer"]);
  if (requestedMode === "fallback" && !allowDegradedRenderer) {
    fail("Fallback mode is degraded and cannot be used as a final output by default. Pass --allow-degraded-renderer only for an explicit draft.");
  }
  const imageSource = args["image-source"] || brief.imageSource || "image2-dryrun";
  if (!["local", "image2-dryrun", "image2"].includes(imageSource)) fail("--image-source must be local, image2-dryrun, or image2");
  let designPlan = buildDesignPlan({ brief, frames, imageSource });
  const voiceDirection = buildVoiceDirection({
    brief,
    videoType: designPlan.videoType,
    requestedStyle: args["speech-style"],
  });
  const spokenNarration = applyVoiceDirection(narration, voiceDirection);
  let finalBrief = { ...brief, durationSeconds: estimatedDuration, imageSource, speechStyle: voiceDirection.speechStyle };
  writeCorePackage({
    out,
    brief: finalBrief,
    frames,
    narration,
    spokenNarration,
    voiceDirection,
    mode: requestedMode,
    designPlan,
    coverIntroSeconds: args["cover-only"] ? 0 : COVER_INTRO_SECONDS,
  });
  if (args["cover-only"]) {
    const coverDesign = JSON.parse(readFileSync(join(out, "workflow", "cover-design.json"), "utf8"));
    const coverManifest = {
      mode: "cover-only",
      outputDirectory: out,
      durationSeconds: estimatedDuration,
      renderer: "none-cover-only",
      imageSource,
      designTemplate: designPlan.templateKit.id,
      command: `node ${process.argv.slice(1).join(" ")}`,
      files: {
        brief: "brief.json",
        designPlan: "workflow/design-plan.json",
        qualityConsistencyContract: "workflow/quality-consistency-contract.json",
        coverDesign: "workflow/cover-design.json",
        videoInternalCover: coverDesign.videoInternalCover?.file,
        standaloneCovers: coverDesign.platformTargets.map((target) => target.file),
        covers: "cover/",
        authorization: "AUTHORIZATION.md",
      },
    };
    writeJson(join(out, "delivery-manifest.json"), coverManifest);
    writeJson(join(out, "workflow", "commands.json"), commandLog);
    writeTimingSummary(out);
    coverManifest.files.deliveryPage = "delivery.html";
    writeJson(join(out, "delivery-manifest.json"), coverManifest);
    const deliveryPage = writeDeliveryPage({
      out,
      brief: finalBrief,
      manifest: coverManifest,
      frames,
      renderer: "none-cover-only",
      voiceBackend: "none",
      imageSource,
    });
    const openedDeliveryPage = openDeliveryPage(deliveryPage, args);
    writeJson(join(out, "workflow", "commands.json"), commandLog);
    writeTimingSummary(out);
    console.log(JSON.stringify({
      ok: true,
      mode: "cover-only",
      out,
      deliveryPage,
      openedDeliveryPage,
      coverDesign: "workflow/cover-design.json",
      videoInternalCover: coverDesign.videoInternalCover?.file,
      standaloneCovers: coverDesign.platformTargets.map((target) => target.file),
    }, null, 2));
    return;
  }
  const narrationSegments = frameNarrationSegments(spokenNarration, frames);
  writeJson(join(out, "script", "frame-narration-segments.json"), {
    source: "spoken narration split once and bound to visual frames before TTS",
    preservation: "The concatenated segment text must match script/narration-spoken.txt except whitespace.",
    segments: narrationSegments,
  });
  const audio = generateAudio({
    out,
    narration: spokenNarration,
    duration: estimatedDuration,
    voiceBackend: args["voice-backend"] || brief.voiceBackend || "auto",
    allowSayFallback: Boolean(args["allow-say-fallback"]),
    voiceDirection,
    coverIntroSeconds: COVER_INTRO_SECONDS,
    narrationSegments,
  });
  const finalDuration = audio.durationSeconds;
  frames = applyAudioTimingsToFrames(frames, audio.segmentTimings);
  finalBrief = { ...brief, durationSeconds: finalDuration, imageSource, speechStyle: voiceDirection.speechStyle };
  designPlan = buildDesignPlan({ brief: finalBrief, frames, imageSource });
  writeCorePackage({
    out,
    brief: finalBrief,
    frames,
    narration,
    spokenNarration,
    voiceDirection,
    mode: requestedMode,
    designPlan,
    coverIntroSeconds: COVER_INTRO_SECONDS,
  });
  await prepareVisualAssets({ out, designPlan, imageSource });
  writeJson(join(out, "workflow", "tool-candidate-selection.json"), {
    recommended: "html-video content graph plus per-frame HTML visual renderer, then local audio/QC/package",
    fallback: "existing video-maker HyperFrames/FFmpeg path or local ffmpeg card renderer",
    voice: "local CosyVoice or MeloTTS required by default; macOS say is explicit fallback only",
    voiceDirection: "planner chooses speech style by video type or --speech-style; spoken narration adds pauses only after complete sentences/semantic beats; comma-like punctuation remains a 0.5s short in-clause pause when explicit",
    design: "planner first: infer video type, choose core template kit, write design-plan/image2-prompts/visual-asset-manifest before render",
    images: imageSource === "image2"
      ? "GPT Image 2 requested explicitly; local SVG fallback requires ALLOW_IMAGE2_FALLBACK=1 if API generation fails"
      : imageSource === "image2-dryrun"
        ? "GPT Image 2 prompts are written and local original SVG illustrations are inserted for deterministic local rendering"
        : "local original SVG illustrations inserted; image2 prompts still recorded for upgrade path",
    selectedMode: requestedMode,
    selectedImageSource: imageSource,
    selectedDesignTemplate: designPlan.templateKit.id,
    selectedReason: requestedMode === "recommended"
      ? "html-video build is available locally and demonstrates the renderer integration point"
      : "fallback mode requested or html-video unavailable",
    unusableByDefault: ["OpenAI Sora deprecated", "Runway/Veo require external account/credits", "commercial stock/music/fonts without explicit license", "voice cloning/reference voice"],
  });
  let renderer = "html-video";
  let finalMp4;
  try {
    if (requestedMode === "fallback") throw new Error("fallback mode requested");
    finalMp4 = await renderWithHtmlVideo({ out, brief, frames, narration: spokenNarration, audio, designPlan });
  } catch (error) {
    renderer = "ffmpeg-fallback";
    write(join(out, "logs", "render-attempts.log"), `html-video failed or skipped:\n${error.stack || error.message}\n`);
    if (!allowDegradedRenderer) {
      writeJson(join(out, "delivery-manifest.json"), {
        ok: false,
        blocked: "degraded-renderer",
        finalMp4: null,
        outputDirectory: out,
        renderer,
        imageSource,
        designTemplate: designPlan.templateKit.id,
        reason: "The fallback renderer produces static card video and does not satisfy the skill's final motion/design contract.",
        nextStep: "Fix html-video/HyperFrames rendering or rerun with --allow-degraded-renderer only for an explicit draft.",
        files: {
          brief: "brief.json",
          storyboard: "script/storyboard.md",
          designPlan: "workflow/design-plan.json",
          qualityConsistencyContract: "workflow/quality-consistency-contract.json",
          coverDesign: "workflow/cover-design.json",
          covers: "cover/",
          renderAttempts: "logs/render-attempts.log",
        },
      });
      writeJson(join(out, "workflow", "commands.json"), commandLog);
      writeTimingSummary(out);
      fail("html-video render failed; refusing to silently deliver degraded ffmpeg fallback as final output. See logs/render-attempts.log.");
    }
    finalMp4 = renderWithFallback({ out, frames, audio, duration: finalDuration, designPlan });
  }
  if (!existsSync(finalMp4)) fail(`Expected final MP4 was not created: ${finalMp4}`);
  copyFileSync(finalMp4, join(out, "final.mp4"));
  const deliveryManifest = {
    finalMp4: "renders/final.mp4",
    finalCopy: "final.mp4",
    outputDirectory: out,
    durationSeconds: finalDuration,
    rawNarrationDurationSeconds: audio.rawDurationSeconds,
    coverIntroSeconds: audio.coverIntroSeconds,
    openingCoverInVideo: true,
    renderer,
    imageSource,
    designTemplate: designPlan.templateKit.id,
    command: `node ${process.argv.slice(1).join(" ")}`,
    files: {
      brief: "brief.json",
      storyboard: "script/storyboard.md",
      designPlan: "workflow/design-plan.json",
      qualityConsistencyContract: "workflow/quality-consistency-contract.json",
      image2Prompts: "workflow/image2-prompts.json",
      visualAssets: "workflow/visual-asset-manifest.json",
      narration: "script/narration.txt",
      spokenNarration: "script/narration-spoken.txt",
      voiceDirection: "workflow/voice-direction.json",
      subtitles: "script/subtitles.srt",
      syncPlan: "workflow/sync-timecode-plan.json",
      coverDesign: "workflow/cover-design.json",
      videoInternalCover: "cover/cover-video-opening-16x9.svg",
      covers: "cover/",
      authorization: "AUTHORIZATION.md",
      scorecard: "workflow/quality-scorecard.md",
      qc: "logs/qc.json",
      deliveryPage: "delivery.html",
    },
  };
  writeJson(join(out, "delivery-manifest.json"), deliveryManifest);
  writeJson(join(out, "workflow", "commands.json"), commandLog);
  writeTimingSummary(out);
  const qc = runQc({ out, finalMp4, duration: finalDuration, renderer, voiceBackend: audio.voiceBackend, allowDegradedRenderer });
  const deliveryPage = writeDeliveryPage({
    out,
    brief: finalBrief,
    manifest: deliveryManifest,
    qc,
    frames,
    renderer,
    voiceBackend: audio.voiceBackend,
    imageSource,
  });
  const openedDeliveryPage = openDeliveryPage(deliveryPage, args);
  writeJson(join(out, "workflow", "commands.json"), commandLog);
  writeTimingSummary(out);
  const size = statSync(finalMp4).size;
  console.log(JSON.stringify({ ok: qc.pass, renderer, finalMp4, out, size, qc: "logs/qc.json", deliveryPage, openedDeliveryPage }, null, 2));
  if (!qc.pass) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
