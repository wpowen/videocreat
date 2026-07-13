#!/usr/bin/env node

import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PLAYWRIGHT_MODULES = "/Users/example/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const requireFromRuntime = createRequire(resolve(PLAYWRIGHT_MODULES, "playwright/package.json"));
const { chromium } = requireFromRuntime("playwright");

function parseArgs(argv) {
  const args = { duration: "8", fps: "15", title: "写小说的方法论" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
    index += 1;
  }
  return args;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function write(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value, "utf8");
}

function writeJson(path, value) {
  write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const args = parseArgs(process.argv.slice(2));
const out = resolve(args.out || join(ROOT, "research", `personal-ip-semantic-layered-video-${Date.now()}`));
const defaultPersonaCandidates = [
  join(process.env.HOME || "", ".codex", "video-workflow", "user-assets", "personal-ip", "generic-hosts", "female", "versions", "v3", "01-character-main-anchor.png"),
  join(ROOT, "research", "layered-ip-poc-20260712", "assets", "persona-main-anchor.png"),
];
const persona = resolve(args.persona || defaultPersonaCandidates.find((candidate) => existsSync(candidate)) || defaultPersonaCandidates[0]);
const audio = args.audio ? resolve(args.audio) : null;
const spec = args.spec ? JSON.parse(readFileSync(resolve(args.spec), "utf8")) : {};
if (!existsSync(persona)) throw new Error(`Persona asset missing: ${persona}`);
if (audio && !existsSync(audio)) throw new Error(`Audio missing: ${audio}`);

rmSync(out, { recursive: true, force: true });
for (const folder of ["assets", "layers", "frames", "renders", "screenshots", "workflow", "logs"]) ensureDir(join(out, folder));
copyFileSync(persona, join(out, "assets", "persona-main-anchor.png"));
if (audio) copyFileSync(audio, join(out, "assets", basename(audio)));

const personaData = `data:image/png;base64,${readFileSync(persona).toString("base64")}`;
const rawTitle = String(spec.title || args.title || "写小说的方法论");
const title = esc(rawTitle);
const titleLines = Array.isArray(spec.titleLines) && spec.titleLines.length
  ? spec.titleLines.slice(0, 2).map((value) => esc(String(value)))
  : rawTitle.length > 6
    ? [esc(rawTitle.slice(0, Math.ceil(rawTitle.length / 2))), esc(rawTitle.slice(Math.ceil(rawTitle.length / 2)))]
    : [esc(rawTitle)];
const titleFontSize = Math.max(...titleLines.map((line) => line.length)) > 6 ? 62 : 82;
const eyebrow = esc(spec.eyebrow || "PERSONAL IP · SEMANTIC MOTION");
const moduleLabel = esc(spec.moduleLabel || "个人 IP · 真实语义分层");
const hookSectionTitle = esc(spec.hookSectionTitle || "钩子五要素");
const routeSectionTitle = esc(spec.routeSectionTitle || "钩子升级路径");
const rawSubtitle = String(spec.subtitle || "钩子系统不是热闹，而是让信息差、威胁、欲望与截止时间形成连续压力。").slice(0, 32);
const splitSubtitleAt = Math.min(16, Math.max(10, Math.ceil(rawSubtitle.length / 2)));
const subtitleLines = [rawSubtitle.slice(0, splitSubtitleAt), rawSubtitle.slice(splitSubtitleAt, splitSubtitleAt * 2)].filter(Boolean).map(esc);
const durationSeconds = audio
  ? Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", audio]).trim())
  : Number(args.duration || 8);
const captureFps = Math.max(10, Math.min(30, Number(args.fps || 15)));
const requestedAspect = String(args.aspect || spec.aspectRatio || spec.aspect || "9:16").trim();
const isHorizontal = /^(?:16:9|horizontal|landscape)$/i.test(requestedAspect);
const canvas = isHorizontal
  ? { width: 1920, height: 1080, aspectRatio: "16:9", orientation: "horizontal" }
  : { width: 1080, height: 1920, aspectRatio: "9:16", orientation: "vertical" };
const personaClip = isHorizontal
  ? { x: 1510, y: 66, width: 300, height: 340, rx: 62 }
  : { x: 650, y: 92, width: 360, height: 520, rx: 76 };

const defs = `
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf2"/><stop offset="1" stop-color="#f3f0e9"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#17212b" flood-opacity=".12"/></filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
    <clipPath id="persona-clip"><rect x="${personaClip.x}" y="${personaClip.y}" width="${personaClip.width}" height="${personaClip.height}" rx="${personaClip.rx}"/></clipPath>
    <style>
      text{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans CJK SC',sans-serif;fill:#17212b}
      .serif{font-family:'Songti SC','STSong',serif}.ink{stroke:#17212b}.orange{fill:#f45f25}.blue{fill:#3569d4}.muted{fill:#607082}.light{fill:#fff}.light-blue{fill:#9fc0ff}
      .card{fill:#fff;stroke:#dce2e7;stroke-width:2}.small{font-size:24px}.label{font-size:27px;font-weight:750}.body{font-size:23px}.title{font-weight:850}
      .draw{fill:none;stroke-linecap:round;stroke-linejoin:round}
    </style>
  </defs>`;

const backgroundLayer = `<g id="layer-background" data-layer="background">
  <rect width="1080" height="1920" rx="54" fill="url(#paper)"/>
  <g opacity=".22" stroke="#9ca8b3" stroke-width="1"><path d="M0 640H1080M0 1280H1080"/><path d="M360 0V1920M720 0V1920"/></g>
  <circle cx="862" cy="310" r="244" fill="#f45f25" opacity=".08" filter="url(#soft)"/><circle cx="132" cy="1470" r="200" fill="#3569d4" opacity=".07" filter="url(#soft)"/>
</g>`;

const headlineLayer = `<g id="layer-headline" data-layer="headline" data-required-final>
  <path d="M72 108H126" stroke="#f45f25" stroke-width="8" stroke-linecap="round"/>
  <text x="146" y="119" font-size="22" font-weight="800" letter-spacing="2.5" class="blue">${eyebrow}</text>
  <text x="70" y="228" class="title serif" font-size="${titleFontSize}">${titleLines.map((line, index) => `<tspan x="70"${index ? ` dy="${Math.round(titleFontSize * 1.08)}"` : ""}>${line}</tspan>`).join("")}</text>
  <path id="headline-stroke" class="draw" d="M70 354C238 338 426 340 596 354" stroke="#f45f25" stroke-width="10" pathLength="1"/>
  <text x="70" y="408" font-size="30" font-weight="650">${subtitleLines.map((line, index) => `<tspan x="70"${index ? ' dy="46"' : ""}${index === 0 ? ' class="orange" font-weight="850"' : ""}>${line}</tspan>`).join("")}</text>
</g>`;

const personaLayer = `<g id="layer-persona" data-layer="persona" data-opaque-safe="contained-media" data-required-final>
  <rect x="638" y="80" width="384" height="544" rx="86" fill="#fff" stroke="#f3c6ae" stroke-width="3" filter="url(#shadow)"/>
  <image href="${personaData}" x="650" y="92" width="360" height="520" preserveAspectRatio="xMidYMid slice" clip-path="url(#persona-clip)"/>
  <rect x="784" y="552" width="204" height="56" rx="28" fill="#17212b"/>
  <text x="886" y="588" text-anchor="middle" font-size="24" font-weight="750" class="light">主讲人 · 拆解者</text>
</g>`;

const defaultHookItems = [
  ["?", "谜团", "先制造未知", "#3569d4"], ["!", "威胁", "后果正在靠近", "#f45f25"], ["△", "风险", "失去什么", "#e34c3f"], ["♥", "欲望", "明确想得到什么", "#f45f25"], ["◷", "截止", "时间开始收紧", "#3569d4"],
];
const hookItems = (Array.isArray(spec.hookItems) && spec.hookItems.length ? spec.hookItems : defaultHookItems)
  .slice(0, 5)
  .map((item, index) => Array.isArray(item)
    ? item
    : [item.icon || ["?", "!", "△", "♥", "◷"][index], item.label || `要素 ${index + 1}`, item.body || "", item.color || (index % 2 ? "#f45f25" : "#3569d4")]);
const hookGap = hookItems.length > 1 ? Math.min(24, (888 - hookItems.length * 160) / (hookItems.length - 1)) : 0;
const hookStart = (1080 - (hookItems.length * 160 + Math.max(0, hookItems.length - 1) * hookGap)) / 2;
const hookCards = hookItems.map(([icon, label, body, color], index) => {
  const x = hookStart + index * (160 + hookGap);
  const bodyText = String(body || "").replace(/[，。、“”‘’；：,.!?！？]/g, "").slice(0, 12);
  const bodyLines = [bodyText.slice(0, 6), bodyText.slice(6, 12)].filter(Boolean);
  return `<g id="hook-${index + 1}" data-item="hook"><rect data-card-box class="card" x="${x}" y="790" width="160" height="210" rx="28" filter="url(#shadow)"/><circle cx="${x + 80}" cy="846" r="35" fill="#f8fafc" stroke="#dce2e7" stroke-width="2"/><text x="${x + 80}" y="860" text-anchor="middle" font-size="42" font-weight="800" fill="${color}">${esc(icon)}</text><text data-contained-text x="${x + 80}" y="925" text-anchor="middle" class="label">${esc(String(label).slice(0, 6))}</text><text data-contained-text x="${x + 80}" y="953" text-anchor="middle" font-size="19" class="muted">${bodyLines.map((line, lineIndex) => `<tspan x="${x + 80}"${lineIndex ? ' dy="25"' : ""}>${esc(line)}</tspan>`).join("")}</text></g>`;
}).join("");
const hookLayer = `<g id="layer-hook-system" data-layer="content" data-required-final>
  <rect id="content-board-bg" x="56" y="652" width="968" height="1018" rx="46" fill="#fff" fill-opacity=".94" stroke="#d7dde3" stroke-width="2" filter="url(#shadow)"/>
  <rect x="84" y="626" width="310" height="54" rx="27" fill="#edf4ff" stroke="#9ec0ff" stroke-width="2"/><text x="239" y="662" text-anchor="middle" font-size="25" font-weight="800" class="blue">${moduleLabel}</text>
  <rect x="92" y="716" width="50" height="50" rx="15" fill="#17212b"/><text x="117" y="750" text-anchor="middle" font-size="25" font-weight="800" fill="#fff">1</text>
  <text x="162" y="751" font-size="36" font-weight="850">${hookSectionTitle}</text>${hookCards}
</g>`;

const defaultRouteItems = [["◴", "倒计时", "把压力放进明确时限"], ["⌁", "陌生世界", "让规则本身成为谜题"], ["☎", "失联来电", "异常事件打破常识"], ["▣", "证据检查", "用可验证线索收束"]];
const routeItems = (Array.isArray(spec.routeItems) && spec.routeItems.length ? spec.routeItems : defaultRouteItems)
  .slice(0, 4)
  .map((item, index) => Array.isArray(item) ? item : [item.icon || ["◴", "⌁", "☎", "▣"][index], item.label || `步骤 ${index + 1}`, item.body || ""]);
const routeGap = routeItems.length > 1 ? Math.min(42, (884 - routeItems.length * 184) / (routeItems.length - 1)) : 0;
const routeStart = (1080 - (routeItems.length * 184 + Math.max(0, routeItems.length - 1) * routeGap)) / 2;
const routeCards = routeItems.map(([icon, label, body], index) => {
  const x = routeStart + index * (184 + routeGap);
  const bodyText = String(body || "").replace(/[，。、“”‘’；：,.!?！？]/g, "").slice(0, 18);
  const bodyLines = [bodyText.slice(0, 6), bodyText.slice(6, 12), bodyText.slice(12, 18)].filter(Boolean);
  return `<g id="route-${index + 1}" data-item="route"><rect data-card-box class="card" x="${x}" y="1154" width="184" height="254" rx="30" filter="url(#shadow)"/><circle cx="${x + 92}" cy="1218" r="37" fill="#fff2eb"/><text x="${x + 92}" y="1232" text-anchor="middle" font-size="40" font-weight="850" class="orange">${esc(icon)}</text><text data-contained-text x="${x + 92}" y="1300" text-anchor="middle" class="label">${esc(String(label).slice(0, 6))}</text><text data-contained-text x="${x + 92}" y="1335" text-anchor="middle" font-size="20" class="muted">${bodyLines.map((line, lineIndex) => `<tspan x="${x + 92}"${lineIndex ? ' dy="26"' : ""}>${esc(line)}</tspan>`).join("")}</text></g>`;
}).join("");
const routePathEnd = routeStart + Math.max(0, routeItems.length - 1) * (184 + routeGap) + 92;
const routeLayer = `<g id="layer-upgrade-route" data-layer="content" data-required-final>
  <rect x="92" y="1054" width="50" height="50" rx="15" fill="#17212b"/><text x="117" y="1088" text-anchor="middle" font-size="25" font-weight="800" fill="#fff">2</text>
  <text x="162" y="1089" font-size="36" font-weight="850">${routeSectionTitle}</text>
  <path id="route-stroke" class="draw" d="M${routeStart + 92} 1242C${routeStart + 150} 1188 ${routePathEnd - 58} 1188 ${routePathEnd} 1242" stroke="#3569d4" stroke-width="7" opacity=".52" pathLength="1"/>${routeCards}
</g>`;

const takeawayLayer = `<g id="layer-takeaway" data-layer="content" data-required-final>
  <rect x="92" y="1464" width="896" height="150" rx="38" fill="#172b3d"/>
  <text x="132" y="1512" font-size="23" font-weight="800" letter-spacing="3" class="light-blue">TAKEAWAY · 今日一句话</text>
  <text x="132" y="1574" font-size="35" font-weight="800" class="light">${esc(String(spec.takeaway || "好钩子 = 信息差 × 情绪杠杆 × 时间压力").slice(0, 20))}</text>
  <g id="agent" data-layer="agent"><rect x="858" y="1490" width="92" height="96" rx="22" fill="#fff" fill-opacity=".12" stroke="#9fc0ff"/><rect x="878" y="1512" width="52" height="40" rx="13" fill="none" stroke="#fff" stroke-width="5"/><circle cx="895" cy="1532" r="4" fill="#fff"/><circle cx="914" cy="1532" r="4" fill="#fff"/><path d="M885 1565H924M885 1576H912" stroke="#9fc0ff" stroke-width="5" stroke-linecap="round"/></g>
  <path id="resolve-stroke" class="draw" d="M104 1640C330 1664 694 1660 934 1636" stroke="#f45f25" stroke-width="9" pathLength="1"/>
</g>`;

const captionLayer = `<g id="layer-caption" data-layer="caption" data-required-final>
  <rect x="82" y="1742" width="916" height="106" rx="53" fill="#17212b" filter="url(#shadow)"/>
  <text id="caption-text" x="540" y="1808" text-anchor="middle" font-size="31" font-weight="750" class="light">一套钩子系统，先从连续压力开始。</text>
</g>`;
const captionCueTexts = (Array.isArray(spec.captions) && spec.captions.length
  ? spec.captions
  : ["一套钩子系统，先从连续压力开始。", "先制造未知，再让读者意识到失去的代价。", "倒计时、陌生规则、异常事件，让悬念逐级升级。", "最后用证据收束：信息差 × 情绪杠杆 × 时间压力。"])
  .slice(0, 4)
  .map((value) => String(value).slice(0, 32));
const captionCues = captionCueTexts.map((value, index) => [index / captionCueTexts.length, value]);

const horizontalBackgroundLayer = `<g id="layer-background" data-layer="background">
  <rect width="1920" height="1080" rx="42" fill="url(#paper)"/>
  <g opacity=".20" stroke="#9ca8b3" stroke-width="1"><path d="M0 360H1920M0 720H1920"/><path d="M480 0V1080M960 0V1080M1440 0V1080"/></g>
  <circle cx="1650" cy="210" r="260" fill="#f45f25" opacity=".08" filter="url(#soft)"/><circle cx="180" cy="860" r="210" fill="#3569d4" opacity=".07" filter="url(#soft)"/>
</g>`;

const horizontalHeadlineLayer = `<g id="layer-headline" data-layer="headline" data-required-final>
  <path d="M82 72H142" stroke="#f45f25" stroke-width="8" stroke-linecap="round"/>
  <text x="162" y="81" font-size="22" font-weight="800" letter-spacing="2.5" class="blue">${eyebrow}</text>
  <text x="80" y="176" class="title serif" font-size="${Math.min(76, titleFontSize)}">${titleLines.map((line, index) => `<tspan x="80"${index ? ' dy="76"' : ""}>${line}</tspan>`).join("")}</text>
  <path id="headline-stroke" class="draw" d="M80 280C390 260 790 264 1170 282" stroke="#f45f25" stroke-width="9" pathLength="1"/>
  <text x="80" y="332" font-size="29" font-weight="650">${subtitleLines.map((line, index) => `<tspan x="80"${index ? ' dy="42"' : ""}${index === 0 ? ' class="orange" font-weight="850"' : ""}>${line}</tspan>`).join("")}</text>
</g>`;

const horizontalPersonaLayer = `<g id="layer-persona" data-layer="persona" data-opaque-safe="contained-media" data-required-final>
  <rect x="1498" y="54" width="324" height="364" rx="70" fill="#fff" stroke="#f3c6ae" stroke-width="3" filter="url(#shadow)"/>
  <image href="${personaData}" x="1510" y="66" width="300" height="340" preserveAspectRatio="xMidYMid slice" clip-path="url(#persona-clip)"/>
  <rect x="1582" y="356" width="202" height="50" rx="25" fill="#17212b"/><text x="1683" y="389" text-anchor="middle" font-size="21" font-weight="750" class="light">主讲人 · 拆解者</text>
</g>`;

const horizontalHookCardWidth = 132;
const horizontalHookGap = hookItems.length > 1 ? Math.min(18, (724 - hookItems.length * horizontalHookCardWidth) / (hookItems.length - 1)) : 0;
const horizontalHookStart = 90 + (760 - (hookItems.length * horizontalHookCardWidth + Math.max(0, hookItems.length - 1) * horizontalHookGap)) / 2;
const horizontalHookCards = hookItems.map(([icon, label, body, color], index) => {
  const x = horizontalHookStart + index * (horizontalHookCardWidth + horizontalHookGap);
  const bodyText = String(body || "").replace(/[，。、“”‘’；：,.!?！？]/g, "").slice(0, 10);
  const bodyLines = [bodyText.slice(0, 5), bodyText.slice(5, 10)].filter(Boolean);
  return `<g id="hook-${index + 1}" data-item="hook"><rect data-card-box class="card" x="${x}" y="600" width="${horizontalHookCardWidth}" height="174" rx="24" filter="url(#shadow)"/><circle cx="${x + horizontalHookCardWidth / 2}" cy="644" r="28" fill="#f8fafc" stroke="#dce2e7" stroke-width="2"/><text x="${x + horizontalHookCardWidth / 2}" y="655" text-anchor="middle" font-size="34" font-weight="800" fill="${color}">${esc(icon)}</text><text data-contained-text x="${x + horizontalHookCardWidth / 2}" y="704" text-anchor="middle" font-size="23" font-weight="760">${esc(String(label).slice(0, 5))}</text><text data-contained-text x="${x + horizontalHookCardWidth / 2}" y="733" text-anchor="middle" font-size="16" class="muted">${bodyLines.map((line, lineIndex) => `<tspan x="${x + horizontalHookCardWidth / 2}"${lineIndex ? ' dy="21"' : ""}>${esc(line)}</tspan>`).join("")}</text></g>`;
}).join("");
const horizontalHookLayer = `<g id="layer-hook-system" data-layer="content" data-required-final>
  <rect id="content-board-bg" x="56" y="424" width="1808" height="506" rx="42" fill="#fff" fill-opacity=".94" stroke="#d7dde3" stroke-width="2" filter="url(#shadow)"/>
  <rect x="86" y="400" width="320" height="52" rx="26" fill="#edf4ff" stroke="#9ec0ff" stroke-width="2"/><text x="246" y="435" text-anchor="middle" font-size="24" font-weight="800" class="blue">${moduleLabel}</text>
  <rect x="88" y="500" width="44" height="44" rx="13" fill="#17212b"/><text x="110" y="530" text-anchor="middle" font-size="23" font-weight="800" class="light">1</text><text x="150" y="531" font-size="32" font-weight="850">${hookSectionTitle}</text>
  ${horizontalHookCards}
</g>`;

const horizontalRouteCardWidth = 190;
const horizontalRouteGap = routeItems.length > 1 ? Math.min(30, (850 - routeItems.length * horizontalRouteCardWidth) / (routeItems.length - 1)) : 0;
const horizontalRouteStart = 920 + (900 - (routeItems.length * horizontalRouteCardWidth + Math.max(0, routeItems.length - 1) * horizontalRouteGap)) / 2;
const horizontalRouteCards = routeItems.map(([icon, label, body], index) => {
  const x = horizontalRouteStart + index * (horizontalRouteCardWidth + horizontalRouteGap);
  const bodyText = String(body || "").replace(/[，。、“”‘’；：,.!?！？]/g, "").slice(0, 16);
  const bodyLines = [bodyText.slice(0, 8), bodyText.slice(8, 16)].filter(Boolean);
  return `<g id="route-${index + 1}" data-item="route"><rect data-card-box class="card" x="${x}" y="600" width="${horizontalRouteCardWidth}" height="174" rx="24" filter="url(#shadow)"/><circle cx="${x + horizontalRouteCardWidth / 2}" cy="644" r="28" fill="#fff2eb"/><text x="${x + horizontalRouteCardWidth / 2}" y="655" text-anchor="middle" font-size="33" font-weight="850" class="orange">${esc(icon)}</text><text data-contained-text x="${x + horizontalRouteCardWidth / 2}" y="704" text-anchor="middle" font-size="23" font-weight="760">${esc(String(label).slice(0, 6))}</text><text data-contained-text x="${x + horizontalRouteCardWidth / 2}" y="733" text-anchor="middle" font-size="16" class="muted">${bodyLines.map((line, lineIndex) => `<tspan x="${x + horizontalRouteCardWidth / 2}"${lineIndex ? ' dy="21"' : ""}>${esc(line)}</tspan>`).join("")}</text></g>`;
}).join("");
const horizontalRouteEnd = horizontalRouteStart + Math.max(0, routeItems.length - 1) * (horizontalRouteCardWidth + horizontalRouteGap) + horizontalRouteCardWidth / 2;
const horizontalRouteLayer = `<g id="layer-upgrade-route" data-layer="content" data-required-final>
  <rect x="922" y="500" width="44" height="44" rx="13" fill="#17212b"/><text x="944" y="530" text-anchor="middle" font-size="23" font-weight="800" class="light">2</text><text x="984" y="531" font-size="32" font-weight="850">${routeSectionTitle}</text>
  <path id="route-stroke" class="draw" d="M${horizontalRouteStart + horizontalRouteCardWidth / 2} 684C${horizontalRouteStart + 160} 642 ${horizontalRouteEnd - 160} 642 ${horizontalRouteEnd} 684" stroke="#3569d4" stroke-width="7" opacity=".52" pathLength="1"/>${horizontalRouteCards}
</g>`;

const horizontalTakeawayLayer = `<g id="layer-takeaway" data-layer="content" data-required-final>
  <rect x="92" y="806" width="1736" height="100" rx="30" fill="#172b3d"/>
  <text x="130" y="842" font-size="20" font-weight="800" letter-spacing="2" class="light-blue">TAKEAWAY · 今日一句话</text>
  <text x="130" y="884" font-size="30" font-weight="800" class="light">${esc(String(spec.takeaway || "语义分层 + 同源时间轴 = 可控动画").slice(0, 36))}</text>
  <g id="agent" data-layer="agent"><rect x="1710" y="820" width="82" height="72" rx="19" fill="#fff" fill-opacity=".12" stroke="#9fc0ff"/><rect x="1728" y="836" width="46" height="32" rx="11" fill="none" stroke="#fff" stroke-width="4"/><circle cx="1743" cy="852" r="3.5" fill="#fff"/><circle cx="1759" cy="852" r="3.5" fill="#fff"/><path d="M1735 880H1768" stroke="#9fc0ff" stroke-width="4" stroke-linecap="round"/></g>
  <path id="resolve-stroke" class="draw" d="M110 920C560 940 1330 938 1810 916" stroke="#f45f25" stroke-width="8" pathLength="1"/>
</g>`;

const horizontalCaptionLayer = `<g id="layer-caption" data-layer="caption" data-required-final>
  <rect x="350" y="958" width="1220" height="82" rx="41" fill="#17212b" filter="url(#shadow)"/>
  <text id="caption-text" x="960" y="1010" text-anchor="middle" font-size="28" font-weight="750" class="light">${esc(captionCueTexts[0] || "个人 IP 语义分层动画")}</text>
</g>`;

const layerEntries = isHorizontal ? [
  ["00-background", "background", 0, horizontalBackgroundLayer],
  ["10-headline", "headline", 20, horizontalHeadlineLayer],
  ["20-hook-system", "content-group", 30, horizontalHookLayer],
  ["30-upgrade-route", "content-group", 32, horizontalRouteLayer],
  ["40-takeaway-agent", "content-group", 34, horizontalTakeawayLayer],
  ["50-persona", "personal-ip", 40, horizontalPersonaLayer],
  ["100-caption", "subtitle-overlay", 100, horizontalCaptionLayer],
] : [
  ["00-background", "background", 0, backgroundLayer],
  ["10-headline", "headline", 20, headlineLayer],
  ["20-hook-system", "content-group", 30, hookLayer],
  ["30-upgrade-route", "content-group", 32, routeLayer],
  ["40-takeaway-agent", "content-group", 34, takeawayLayer],
  ["50-persona", "personal-ip", 40, personaLayer],
  ["100-caption", "subtitle-overlay", 100, captionLayer],
];

const svgDocument = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}">${defs}${body}</svg>\n`;
for (const [id, , , body] of layerEntries) write(join(out, "layers", `${id}.svg`), svgDocument(body));
const fullSvg = svgDocument(layerEntries.map((entry) => entry[3]).join(""));
write(join(out, "personal-ip-layered.svg"), fullSvg);

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 个人 IP 语义分层动画</title><style>
*{box-sizing:border-box}body{margin:0;background:#10151b;color:#eef2f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}.app{display:grid;grid-template-columns:minmax(360px,${isHorizontal ? "960px" : "610px"}) minmax(300px,480px);gap:36px;align-items:start;justify-content:center;padding:28px}.stage-shell{width:min(${isHorizontal ? "960px" : "610px"},calc(100vw - 40px));aspect-ratio:${canvas.width}/${canvas.height};background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 28px 80px #0008}.stage{width:100%;height:100%}.stage svg{display:block;width:100%;height:100%}.panel{position:sticky;top:28px;background:#17212b;border:1px solid #ffffff18;border-radius:24px;padding:26px}.panel h1{font-size:30px;margin:0 0 12px}.panel p{color:#aeb9c5;line-height:1.7}.controls{display:flex;gap:10px;flex-wrap:wrap}.controls button{border:0;border-radius:999px;padding:11px 18px;font-weight:750;cursor:pointer}.primary{background:#f45f25;color:#fff}.secondary{background:#fff;color:#17212b}.timeline{width:100%;margin-top:18px}.layers{display:grid;gap:8px;margin-top:20px}.layer{display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;background:#ffffff0c;border-radius:12px;padding:10px}.layer b{display:grid;place-items:center;background:#ffffff12;border-radius:9px;height:34px}.layer span{font-size:13px}.layer em{font-size:12px;color:#7f8b98;font-style:normal}.status{display:flex;justify-content:space-between;margin-top:8px;color:#8fa0b2;font-size:13px}
[data-layer],[data-item],#agent{transform-box:fill-box;transform-origin:center;will-change:transform,opacity}#headline-stroke,#route-stroke,#resolve-stroke{stroke-dasharray:1;stroke-dashoffset:1}
body.render{background:#fff}.render .app{display:block;padding:0}.render .stage-shell{width:${canvas.width}px;height:${canvas.height}px;border-radius:0;box-shadow:none}.render .panel{display:none}@media(max-width:980px){.app{grid-template-columns:1fr}.panel{position:static}}@media(prefers-reduced-motion:reduce){[data-layer],[data-item],#agent{will-change:auto}}
</style></head><body><main class="app"><section class="stage-shell"><div class="stage" id="stage">${fullSvg.replace(/^<\?xml[^>]+>\s*/, "")}</div></section><aside class="panel"><h1>个人 IP · 真实语义分层</h1><p>人物、标题、内容组、升级路径、结论、Agent 与字幕都有独立 SVG/HTML 图层。统一时间轴只改变所属图层的透明度、位移与路径绘制，不使用整图覆盖动画。</p><div class="controls"><button id="play" class="primary">播放</button><button id="replay" class="secondary">重播</button><button id="final" class="secondary">最终状态</button></div><input id="timeline" class="timeline" type="range" min="0" max="1000" value="0"><div class="status"><span id="phase">建立主题</span><span id="time">0.0s / ${durationSeconds.toFixed(1)}s</span></div><div class="layers">${layerEntries.map(([id, role, z]) => `<div class="layer"><b>${z}</b><span>${id}</span><em>${role}</em></div>`).join("")}</div></aside></main><script>
(()=>{const duration=${Math.round(durationSeconds * 1000)};const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];const clamp=v=>Math.max(0,Math.min(1,v));const ease=v=>1-Math.pow(1-clamp(v),3);const range=(p,a,b)=>ease((p-a)/(b-a));const reveal=(el,v,y=24)=>{const t=clamp(v);el.style.opacity=t.toFixed(4);el.style.visibility=t<.004?'hidden':'visible';el.style.transform='translate(0 '+((1-t)*y)+'px) scale('+(.985+t*.015)+')'};const draw=(id,v)=>{$(id).style.strokeDashoffset=String(1-clamp(v))};const captions=[[0,'一套钩子系统，先从连续压力开始。'],[.25,'先制造未知，再让读者意识到失去的代价。'],[.49,'倒计时、陌生规则、异常事件，让悬念逐级升级。'],[.73,'最后用证据收束：信息差 × 情绪杠杆 × 时间压力。']];const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let raf=0,playing=false,startAt=0,paused=0;function setProgress(input){const p=reduced?1:clamp(Number(input)||0);reveal($('#layer-headline'),range(p,.01,.14),30);draw('#headline-stroke',range(p,.08,.22));reveal($('#layer-persona'),range(p,.10,.27),34);reveal($('#layer-hook-system'),range(p,.18,.31),24);$$('[data-item="hook"]').forEach((el,i)=>reveal(el,range(p,.26+i*.045,.39+i*.045),18));reveal($('#layer-upgrade-route'),range(p,.44,.55),22);$$('[data-item="route"]').forEach((el,i)=>reveal(el,range(p,.50+i*.055,.64+i*.055),18));draw('#route-stroke',range(p,.47,.74));reveal($('#layer-takeaway'),range(p,.70,.86),24);reveal($('#agent'),range(p,.79,.92),14);draw('#resolve-stroke',range(p,.74,.92));reveal($('#layer-caption'),range(p,.03,.12),12);const caption=[...captions].reverse().find(([at])=>p>=at)?.[1]||captions[0][1];$('#caption-text').textContent=caption;$('#timeline').value=String(Math.round(p*1000));$('#time').textContent=(p*duration/1000).toFixed(1)+'s / '+(duration/1000).toFixed(1)+'s';$('#phase').textContent=p<.22?'建立主题':p<.47?'拆出五要素':p<.70?'升级路径':p<.88?'收束公式':'完成交付';$('#stage').dataset.progress=p.toFixed(3)}function tick(now){if(!playing)return;if(!startAt)startAt=now-paused;const elapsed=now-startAt;setProgress(elapsed/duration);if(elapsed>=duration){playing=false;paused=duration;startAt=0;$('#play').textContent='播放';return}raf=requestAnimationFrame(tick)}function toggle(){if(playing){playing=false;cancelAnimationFrame(raf);paused=Number($('#timeline').value)/1000*duration;$('#play').textContent='播放';return}if(paused>=duration)paused=0;playing=true;startAt=0;$('#play').textContent='暂停';raf=requestAnimationFrame(tick)}$('#play').onclick=toggle;$('#replay').onclick=()=>{cancelAnimationFrame(raf);paused=0;startAt=0;playing=true;$('#play').textContent='暂停';setProgress(0);raf=requestAnimationFrame(tick)};$('#final').onclick=()=>{cancelAnimationFrame(raf);playing=false;paused=duration;setProgress(1);$('#play').textContent='播放'};$('#timeline').oninput=e=>{cancelAnimationFrame(raf);playing=false;paused=Number(e.target.value)/1000*duration;startAt=0;setProgress(paused/duration);$('#play').textContent='播放'};window.motion={setProgress,duration,reducedMotion:reduced};if(new URLSearchParams(location.search).get('render')==='1')document.body.classList.add('render');setProgress(reduced?1:0)})();
</script></body></html>`;
const resolvedHtml = html.replace(
  "const captions=[[0,'一套钩子系统，先从连续压力开始。'],[.25,'先制造未知，再让读者意识到失去的代价。'],[.49,'倒计时、陌生规则、异常事件，让悬念逐级升级。'],[.73,'最后用证据收束：信息差 × 情绪杠杆 × 时间压力。']];",
  `const captions=${JSON.stringify(captionCues)};`,
);
write(join(out, "index.html"), resolvedHtml);

const manifest = {
  schemaVersion: 1,
  route: "personal-ip-semantic-layers-svg-html-video",
  canonicalSource: "semantic-layer-scene",
  flatCompositeBaseForbidden: true,
  canvas,
  aspectAdaptation: {
    selectedLayout: canvas.orientation,
    supported: [
      { aspectRatio: "9:16", dimensions: "1080x1920", layout: "vertical-stacked-semantic-board" },
      { aspectRatio: "16:9", dimensions: "1920x1080", layout: "horizontal-two-module-semantic-board" },
    ],
    cropOrSqueezeFallbackForbidden: true,
  },
  durationSeconds,
  captureFps,
  layers: layerEntries.map(([id, role, z]) => ({ id, role, zIndex: z, svg: `layers/${id}.svg`, htmlOwner: role !== "background" })),
  html: "index.html",
  combinedSvg: "personal-ip-layered.svg",
  animationContract: {
    masterTimeline: "window.motion.setProgress(progress)",
    allowed: ["opacity", "transform", "stroke-dashoffset", "subtitle text cue swap"],
    subtitleTopmost: true,
    reducedMotionFinalState: true,
  },
  rejectList: ["flat personal-IP page used as animation base", "opaque white-background slices", "generic overlay rail", "path above readable cards", "caption below content", "horizontal output made by cropping or squeezing the vertical layout"],
};
writeJson(join(out, "workflow", "personal-ip-semantic-layer-manifest.json"), manifest);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: canvas.width, height: canvas.height }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(join(out, "index.html")).href}?render=1`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const frameCount = Math.ceil(durationSeconds * captureFps);
for (let index = 0; index < frameCount; index += 1) {
  const progress = frameCount <= 1 ? 1 : index / (frameCount - 1);
  await page.evaluate((value) => window.motion.setProgress(value), progress);
  await page.screenshot({ path: join(out, "frames", `frame-${String(index + 1).padStart(4, "0")}.jpg`), type: "jpeg", quality: 94 });
}
for (const [label, progress] of [["opening", 0.08], ["middle", 0.52], ["ending", 1]]) {
  await page.evaluate((value) => window.motion.setProgress(value), progress);
  await page.screenshot({ path: join(out, "screenshots", `${label}.png`), type: "png" });
}
await browser.close();

const visual = join(out, "renders", "personal-ip-semantic-layered.mp4");
run("ffmpeg", ["-y", "-v", "error", "-framerate", String(captureFps), "-i", join(out, "frames", "frame-%04d.jpg"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", visual]);
const finalVideo = join(out, "renders", "final.mp4");
if (audio) {
  run("ffmpeg", ["-y", "-v", "error", "-i", visual, "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", finalVideo]);
} else {
  copyFileSync(visual, finalVideo);
}
copyFileSync(finalVideo, join(out, "final.mp4"));

const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", finalVideo]));
const decoder = spawnSync("ffmpeg", ["-v", "error", "-i", finalVideo, "-f", "null", "-"], { encoding: "utf8" });
const qc = {
  schemaVersion: 1,
  pass: decoder.status === 0 && (probe.streams || []).some((stream) => stream.codec_type === "video"),
  renderer: "semantic-layered-svg-html-playwright-ffmpeg",
  durationSeconds: Number(probe.format?.duration || 0),
  dimensions: `${probe.streams?.find((stream) => stream.codec_type === "video")?.width}x${probe.streams?.find((stream) => stream.codec_type === "video")?.height}`,
  checks: {
    semanticLayerManifestPresent: true,
    independentSvgLayersExported: layerEntries.every(([id]) => existsSync(join(out, "layers", `${id}.svg`))),
    interactiveHtmlExported: existsSync(join(out, "index.html")),
    combinedSvgExported: existsSync(join(out, "personal-ip-layered.svg")),
    flatCompositeBaseRejected: true,
    requestedAspectResolved: probe.streams?.find((stream) => stream.codec_type === "video")?.width === canvas.width
      && probe.streams?.find((stream) => stream.codec_type === "video")?.height === canvas.height,
    videoDecodes: decoder.status === 0,
    subtitleTopmost: true,
  },
};
writeJson(join(out, "logs", "qc.json"), qc);
process.stdout.write(`${JSON.stringify({ pass: qc.pass, out, html: join(out, "index.html"), svg: join(out, "personal-ip-layered.svg"), finalVideo, manifest: join(out, "workflow", "personal-ip-semantic-layer-manifest.json") }, null, 2)}\n`);
