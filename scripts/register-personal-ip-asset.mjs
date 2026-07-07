#!/usr/bin/env node
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
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const rootEnv = "CODEX_VIDEO_PERSONAL_IP_ASSET_ROOT";
const defaultRoot = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "video-workflow", "user-assets", "personal-ip");
const imageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/register-personal-ip-asset.mjs --name <persona-name> --source <file-or-dir> [--source <file-or-dir>]",
    "",
    "Options:",
    "  --root <dir>       User material library root. Defaults to CODEX_VIDEO_PERSONAL_IP_ASSET_ROOT or ~/.codex/video-workflow/user-assets/personal-ip",
    "  --id <persona-id>  Stable persona id. Defaults to a slug from --name.",
    "  --kind <kind>      Asset kind for subsequent --source entries. Defaults to reference-image.",
    "  --notes <text>     Optional manifest notes.",
    "  --init             Create an empty pending manifest when no source is available yet.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    name: "",
    id: "",
    root: process.env[rootEnv] || defaultRoot,
    sources: [],
    kind: "reference-image",
    notes: "",
    init: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--name") args.name = argv[++i] || "";
    else if (item === "--id") args.id = argv[++i] || "";
    else if (item === "--root") args.root = argv[++i] || "";
    else if (item === "--source") args.sources.push({ path: argv[++i] || "", kind: args.kind });
    else if (item === "--kind") args.kind = argv[++i] || "reference-image";
    else if (item === "--notes") args.notes = argv[++i] || "";
    else if (item === "--init") args.init = true;
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function resolveUserPath(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "~") return homedir();
  if (raw.startsWith("~/")) return join(homedir(), raw.slice(2));
  return resolve(workspace, raw);
}

function slug(value = "", fallback = "personal-ip") {
  return String(value || fallback)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || fallback;
}

function safeFileName(value = "", fallback = "asset") {
  return String(value || fallback)
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    || fallback;
}

function readJsonIfExists(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectFiles(sourcePath) {
  const stat = statSync(sourcePath);
  if (stat.isFile()) return [sourcePath];
  if (!stat.isDirectory()) return [];
  return readdirSync(sourcePath)
    .map((entry) => join(sourcePath, entry))
    .filter((file) => {
      try {
        return statSync(file).isFile() && imageExts.has(extname(file).toLowerCase());
      } catch {
        return false;
      }
    })
    .sort();
}

function copyAsset({ file, kind, personaDir, assetDir }) {
  const ext = extname(file).toLowerCase() || ".asset";
  const hash = sha256File(file);
  const stem = safeFileName(basename(file, ext), "persona-reference");
  const fileName = `${stem}-${hash.slice(0, 12)}${ext}`;
  const dest = join(assetDir, fileName);
  copyFileSync(file, dest);
  return {
    id: `${slug(kind || "reference-image")}-${hash.slice(0, 12)}`,
    kind: kind || "reference-image",
    file: fileName,
    relativePath: relative(personaDir, dest).split("\\").join("/"),
    sourceOriginalPath: file,
    bytes: statSync(dest).size,
    sha256: hash,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.name) throw new Error("--name is required");
  if (!args.init && args.sources.length === 0) throw new Error("At least one --source is required unless --init is used");

  const root = resolveUserPath(args.root);
  const personaId = slug(args.id || args.name);
  const personaDir = join(root, personaId);
  const assetDir = join(personaDir, "assets");
  const manifestPath = join(personaDir, "manifest.json");
  ensureDir(assetDir);

  const copiedAssets = [];
  for (const source of args.sources) {
    const sourcePath = resolveUserPath(source.path);
    if (!existsSync(sourcePath)) throw new Error(`Source does not exist: ${source.path}`);
    for (const file of collectFiles(sourcePath)) {
      copiedAssets.push(copyAsset({ file, kind: source.kind, personaDir, assetDir }));
    }
  }

  const existing = readJsonIfExists(manifestPath) || {};
  const existingAssets = Array.isArray(existing.assets) ? existing.assets : [];
  const byHash = new Map();
  for (const asset of [...existingAssets, ...copiedAssets]) {
    if (!asset?.sha256) continue;
    byHash.set(asset.sha256, asset);
  }
  const assets = [...byHash.values()];
  const now = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    status: assets.length ? "ready" : "pending-assets",
    persona: {
      id: personaId,
      name: args.name,
    },
    library: {
      root,
      personaDir,
      manifestPath,
      storageScope: "persistent-user-skill-material-library-outside-public-skill",
      publicSkillStorageAllowed: false,
    },
    assets,
    notes: args.notes || existing.notes || "",
    guidance: {
      useSavedPersonaWhenAvailable: true,
      createOnceThenReuse: true,
      noExactLikenessPromise: true,
      publicSkillStorageAllowed: false,
    },
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  writeJson(manifestPath, manifest);
  console.log(JSON.stringify({
    ok: true,
    status: manifest.status,
    manifest: manifestPath,
    personaId,
    assetCount: assets.length,
  }, null, 2));
}

main();
