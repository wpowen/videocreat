#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return args;
}

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapChars(text, max = 11) {
  const chars = Array.from(String(text || "").trim());
  const lines = [];
  for (let i = 0; i < chars.length; i += max) {
    lines.push(chars.slice(i, i + max).join(""));
  }
  return lines.filter(Boolean);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function firstPersonaAsset(manifest, manifestPath) {
  const asset = Array.isArray(manifest.assets)
    ? manifest.assets.find((item) => item.relativePath || item.file || item.path)
    : null;
  if (!asset) throw new Error("No fixed persona asset found in manifest");
  const raw = asset.relativePath || asset.file || asset.path;
  const assetPath = resolve(dirname(manifestPath), raw);
  if (!existsSync(assetPath)) throw new Error(`Persona asset not found: ${assetPath}`);
  return assetPath;
}

function textBlock(lines, x, y, {
  size = 48,
  weight = 800,
  fill = "#1d232b",
  gap = 62,
  anchor = "start",
} = {}) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * gap}" text-anchor="${anchor}" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`
  )).join("\n");
}

function agentFigure(x, y, label, color) {
  return `
    <g transform="translate(${x} ${y})">
      <circle cx="0" cy="0" r="18" fill="#fffdf7" stroke="#1d232b" stroke-width="6"/>
      <path d="M0 20 L0 70 M-34 44 L34 44 M0 70 L-26 112 M0 70 L28 112" fill="none" stroke="#1d232b" stroke-width="7" stroke-linecap="round"/>
      <rect x="-76" y="124" width="152" height="52" rx="18" fill="#ffffff" stroke="${color}" stroke-width="5"/>
      <text x="0" y="160" text-anchor="middle" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="26" font-weight="800" fill="#1d232b">${esc(label)}</text>
    </g>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolve(args.out || "personal-ip-preview.svg");
  const manifestPath = resolve(args.manifest || "/Users/example/.codex/video-workflow/user-assets/personal-ip/个人ip主讲人/manifest.json");
  const manifest = readJson(manifestPath);
  const personaAssetPath = firstPersonaAsset(manifest, manifestPath);
  const personaSvg = readFileSync(personaAssetPath, "utf8");
  const personaData = Buffer.from(personaSvg).toString("base64");
  const title = args.title || "小说主题不是金句";
  const phrases = String(args.phrases || "价值命题|人物承受|冲突拷问|结局判决")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  const titleLines = wrapChars(title, 11);
  const [p1 = "", p2 = "", p3 = "", p4 = ""] = phrases;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#fffdf7"/>
  <path d="M74 150 C220 96 384 92 510 140" fill="none" stroke="#f29f3d" stroke-width="16" stroke-linecap="round"/>
  ${textBlock(titleLines, 90, 185, { size: titleLines.length > 1 ? 68 : 78, gap: 82 })}

  <g transform="translate(74 350)">
    <rect x="0" y="0" width="932" height="760" rx="42" fill="#ffffff" stroke="#1d232b" stroke-width="9"/>
    <path d="M54 108 H880" stroke="#d95b43" stroke-width="10" stroke-linecap="round"/>
    <text x="466" y="92" text-anchor="middle" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="54" font-weight="900" fill="#1d232b">${esc(p1)}</text>

    <g transform="translate(96 205)">
      <rect x="0" y="0" width="268" height="132" rx="28" fill="#fff8eb" stroke="#1d232b" stroke-width="7"/>
      <text x="134" y="83" text-anchor="middle" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="44" font-weight="900" fill="#1d232b">${esc(p2)}</text>
    </g>
    <path d="M384 272 C444 248 486 248 546 272" fill="none" stroke="#2f77d0" stroke-width="10" stroke-linecap="round"/>
    <path d="M534 250 L566 272 L530 288" fill="none" stroke="#2f77d0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(570 205)">
      <rect x="0" y="0" width="268" height="132" rx="28" fill="#eef6ff" stroke="#1d232b" stroke-width="7"/>
      <text x="134" y="83" text-anchor="middle" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="44" font-weight="900" fill="#1d232b">${esc(p3)}</text>
    </g>

    <path d="M466 374 V470" stroke="#1d232b" stroke-width="9" stroke-linecap="round"/>
    <path d="M440 446 L466 484 L494 446" fill="none" stroke="#1d232b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(262 502)">
      <rect x="0" y="0" width="408" height="136" rx="30" fill="#fff2ee" stroke="#1d232b" stroke-width="8"/>
      <text x="204" y="88" text-anchor="middle" font-family="Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="52" font-weight="900" fill="#1d232b">${esc(p4)}</text>
    </g>
    <path d="M86 670 C270 720 638 722 850 666" fill="none" stroke="#f29f3d" stroke-width="12" stroke-linecap="round"/>
  </g>

  <g transform="translate(74 1140)">
    <image href="data:image/svg+xml;base64,${personaData}" x="0" y="0" width="500" height="375" preserveAspectRatio="xMidYMid meet"/>
    <path d="M450 160 C560 120 620 80 710 26" fill="none" stroke="#1d232b" stroke-width="10" stroke-linecap="round"/>
    <path d="M690 20 L732 14 L708 52" fill="none" stroke="#1d232b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  ${agentFigure(702, 1226, "提炼命题", "#2f77d0")}
  ${agentFigure(860, 1380, "标记冲突", "#d95b43")}
  ${agentFigure(688, 1546, "递交判决", "#f29f3d")}

  <rect x="70" y="1740" width="940" height="110" rx="30" fill="#fffdf7"/>
</svg>
`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg, "utf8");
  process.stdout.write(JSON.stringify({
    ok: true,
    out,
    manifestPath,
    personaAssetPath,
  }, null, 2) + "\n");
}

main();
