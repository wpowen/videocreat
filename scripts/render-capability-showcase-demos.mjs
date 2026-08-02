#!/usr/bin/env node

/**
 * Render the motion/caption catalog as one deterministic capability reel.
 * The 160 combinations are represented by 32 family scenes, each scene
 * displaying five variants as simultaneous cards (not 160 independent jobs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumLaunchOptions, loadPlaywright } from "./lib/load-playwright.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const SCENE_SECONDS = 1.2;
const DURATION = 32 * SCENE_SECONDS;

function extractColorSystems(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  const rows = [];
  const pattern = /<label class="palette-row[^\"]*"[^>]*data-palette-mode="([^"]+)"[\s\S]*?<div class="swatches">([\s\S]*?)<\/div>\s*<strong>([^<]+)<\/strong>/g;
  for (const match of html.matchAll(pattern)) {
    const colors = [...match[2].matchAll(/background:(#[0-9a-f]{6})/gi)].map((item) => item[1]);
    rows.push({ mode: match[1], name: match[3].trim(), colors });
  }
  if (rows.length !== 44) throw new Error(`Expected 44 configuration color systems, found ${rows.length}`);
  return rows;
}

function help() {
  console.log(`Usage: node scripts/render-capability-showcase-demos.mjs [options]

Options:
  --out <dir>             Output directory (default: research/capability-showcase-reel)
  --provided-audio <file> Optional narration/music; muxed into the reel
  --keep-frames           Preserve intermediate PNG frames
  --help                  Show this help

The default output is a review-only silent visual reel. A supplied audio file is
required for a final-quality audio-bearing deliverable.`);
}
function parseArgs(argv) {
  const out = { out: join(ROOT, "research/capability-showcase-reel"), providedAudio: "", keepFrames: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out.out = resolve(argv[++i]);
    else if (argv[i] === "--provided-audio") out.providedAudio = resolve(argv[++i]);
    else if (argv[i] === "--keep-frames") out.keepFrames = true;
    else if (argv[i] === "--help") { help(); process.exit(0); }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return out;
}
function ensure(path) { mkdirSync(path, { recursive: true }); }
function write(path, value) { ensure(dirname(path)); writeFileSync(path, value, "utf8"); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stdout || ""}${result.stderr || ""}`);
  return `${result.stdout || ""}${result.stderr || ""}`;
}
function esc(value) { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function makeHtml(motion, captions, colorSystems) {
  const families = [];
  for (let i = 0; i < motion.coverage.familyCount; i += 1) {
    const group = motion.templates.slice(i * 5, i * 5 + 5);
    families.push({ familyId: group[0]?.familyId || `family-${i + 1}`, label: group[0]?.familyLabelZh || `Family ${i + 1}`, variants: group });
  }
  const payload = JSON.stringify({
    families,
    captions: captions.styles.map((s) => ({ id: s.id, label: s.labelZh || s.name, group: s.group })),
    captionGroups: captions.groups,
    colorSystems,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#f6f1e8;color:#20242a;font-family:Inter,"PingFang SC",system-ui,sans-serif}#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:radial-gradient(circle at 80% 10%,#f5d9a6 0,#f6f1e8 33%,#e8edf0 100%)}
  #grid{position:absolute;inset:0;opacity:.16;background-image:linear-gradient(#9b6b4030 1px,transparent 1px),linear-gradient(90deg,#9b6b4030 1px,transparent 1px);background-size:48px 48px}#wash{position:absolute;width:900px;height:900px;right:-160px;top:-280px;border-radius:50%;background:#ca5b3a30;filter:blur(2px)}
  #whiteboard{position:absolute;inset:0;opacity:.5}#ip-sample{position:absolute;right:86px;top:126px;width:420px;height:236px;object-fit:cover;border-radius:18px;opacity:0;mix-blend-mode:multiply;filter:saturate(.75) contrast(1.05)}#content{position:absolute;left:92px;right:92px;top:68px;bottom:122px;display:flex;flex-direction:column;gap:16px}.eyebrow{font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:#8c4f36}.title{font-size:52px;line-height:1.04;font-weight:820;letter-spacing:-.04em}.subtitle{font-size:22px;color:#5f6770}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:4px}.card{height:360px;padding:17px;border:1px solid #ffffffc9;border-radius:22px;background:var(--surface,#ffffffa8);color:var(--ink,#20242a);box-shadow:0 16px 30px #35404b18;transform:translateY(24px);opacity:.18}.card.active{opacity:1;transform:translateY(0)}.index{font:700 15px ui-monospace;color:var(--accent,#9c5f3b)}.variant{font-size:20px;font-weight:760;margin-top:8px}.kind{font-size:14px;color:color-mix(in srgb,var(--ink,#20242a) 66%,transparent);margin-top:5px}.visual{height:180px;margin-top:12px;border-radius:15px;overflow:hidden;background:color-mix(in srgb,var(--surface,#fff) 78%,var(--accent,#c55f3e));border:1px solid color-mix(in srgb,var(--accent,#c55f3e) 28%,transparent)}.visual svg{width:100%;height:100%;display:block}.bars{display:flex;gap:4px;margin-top:10px}.bars i{display:block;height:7px;flex:1;border-radius:5px}.catalog-rails{display:grid;grid-template-columns:1fr 1.35fr;gap:14px}.rail{min-height:68px;border-radius:16px;padding:10px 14px;background:#fff9;border:1px solid #fff;overflow:hidden}.rail b{display:block;font-size:13px;letter-spacing:.08em;color:#6c737a;margin-bottom:7px}.chips{display:flex;gap:8px;align-items:center;white-space:nowrap}.palette-chip,.caption-chip{border-radius:999px;padding:6px 10px;background:#fff;color:#27313a;font-size:13px;font-weight:680;border:1px solid #d7dce0}.palette-chip{display:flex;align-items:center;gap:8px}.swatch{display:flex;gap:2px}.swatch i{width:14px;height:14px;border-radius:50%}.caption-chip.active{background:#20242a;color:#fff;transform:scale(1.05)}.footer{position:absolute;bottom:34px;left:92px;right:92px;display:flex;justify-content:space-between;font-size:16px;color:#68717a}.caption{position:absolute;bottom:48px;left:50%;transform:translateX(-50%);max-width:1500px;padding:14px 30px;border-radius:14px;background:#20242ade;color:#fff;font-size:27px;white-space:nowrap;box-shadow:0 8px 24px #20242a42;z-index:100}.caption[data-group="glass"]{background:#ffffffb8;color:#17212b;backdrop-filter:blur(18px);border:1px solid #fff}.caption[data-group="editorial"]{border-left:9px solid #c55f3e;border-radius:4px;background:#f8f1e8;color:#20242a}.caption[data-group="kinetic"]{background:#c95539;transform:translateX(-50%) rotate(-1deg) scale(1.04);font-weight:900}.caption[data-group="ui"]{background:#182a38;border:1px solid #6e93a8;border-radius:10px;font-family:ui-monospace}.caption[data-group="bilingual"]{background:#20242a;border-bottom:5px solid #d9a441}.caption[data-group="mobile"]{background:#fff;color:#111;border:3px solid #111;border-radius:999px;font-weight:900}.caption[data-group="minimal"]{background:#f7f3e9;color:#222;box-shadow:none;border-bottom:2px solid #222;border-radius:0}.caption[data-group="audio"]{background:#24343d;padding-left:72px}.caption[data-group="audio"]:before{content:'▂▆▃▇▅';position:absolute;left:22px;color:#d9a441;letter-spacing:2px}.counter{font-variant-numeric:tabular-nums}
  @keyframes float{from{transform:translateY(0)}to{transform:translateY(-14px)}}.float{animation:float 3s ease-in-out infinite alternate}
  </style></head><body><main id="stage"><div id="grid"></div><div id="wash"></div><img id="ip-sample" src="personal-ip/story-spine-opening.png" alt="personal IP sample"><svg id="whiteboard" viewBox="0 0 1920 1080" aria-hidden="true"><path d="M120 820 C330 640 470 900 650 700 S980 600 1120 760 S1450 850 1770 610" fill="none" stroke="#b46b46" stroke-width="8" stroke-linecap="round" stroke-dasharray="20 18"/><path d="M1380 180 l120 100 -80 110 160 80" fill="none" stroke="#5d8a8c" stroke-width="7"/><circle cx="260" cy="260" r="76" fill="none" stroke="#d9a441" stroke-width="8"/><text x="190" y="275" font-size="30" fill="#8c4f36">IP</text></svg><section id="content"><div class="eyebrow" id="eyebrow"></div><div class="title" id="title"></div><div class="subtitle" id="sub"></div><div class="cards" id="cards"></div><div class="catalog-rails"><div class="rail"><b>CONFIG COLOR SYSTEMS · 44</b><div class="chips" id="colors"></div></div><div class="rail"><b>ROUTABLE CAPTION STYLES · 68 / 8 GROUPS</b><div class="chips" id="captions"></div></div></div></section><div class="caption" id="caption"></div><div class="footer"><span>6 EXECUTABLE HTML CORES · 9 VISUAL ARCHETYPES · 32×5 STYLE CONTRACTS</span><span class="counter" id="counter"></span></div></main><script>window.__catalog=${payload};
  const q=(id)=>document.getElementById(id),data=window.__catalog,families=data.families;const fallback=['#c55f3e','#d9a441','#5d8a8c','#293a4a','#b28d6e'];
  const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-Math.pow(1-clamp(v),3);
  function visual(family,p,accent,ink){const id=family.familyId||'',d=Math.round(ease(p)*250),o=Math.max(.18,ease(p));if(/timeline|calendar|journey|checkpoint/.test(id))return '<svg viewBox="0 0 300 170"><path d="M24 90H276" stroke="'+ink+'" stroke-width="5" stroke-dasharray="'+d+' 300"/><circle cx="62" cy="90" r="14" fill="'+accent+'"/><circle cx="150" cy="90" r="14" fill="'+accent+'" opacity="'+o+'"/><circle cx="238" cy="90" r="14" fill="'+accent+'" opacity="'+o+'"/></svg>';if(/curve|funnel|ranking|dashboard|geo-data/.test(id))return '<svg viewBox="0 0 300 170"><path d="M30 142H276M30 142V28" stroke="'+ink+'" stroke-width="3"/><path d="M38 132C88 126 98 90 142 96S210 34 268 40" fill="none" stroke="'+accent+'" stroke-width="8" stroke-dasharray="'+d+' 340"/><circle cx="208" cy="55" r="10" fill="'+accent+'" opacity="'+o+'"/></svg>';if(/map|network|tree|orbit|relationship/.test(id))return '<svg viewBox="0 0 300 170"><g stroke="'+ink+'" stroke-width="3" opacity="'+o+'"><path d="M56 92L144 42L246 86L164 138Z"/><path d="M144 42L164 138"/></g><g fill="'+accent+'"><circle cx="56" cy="92" r="15"/><circle cx="144" cy="42" r="15"/><circle cx="246" cy="86" r="15"/><circle cx="164" cy="138" r="15"/></g></svg>';if(/whiteboard|formula/.test(id))return '<svg viewBox="0 0 300 170"><path d="M38 42C86 20 112 58 154 46S222 22 260 42M44 90H126M154 90H258M76 130C128 108 178 112 230 132" fill="none" stroke="'+accent+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+d+' 360"/><path d="M132 76l18 15-18 15" fill="none" stroke="'+ink+'" stroke-width="4"/></svg>';if(/ip-presenter/.test(id))return '<svg viewBox="0 0 300 170"><circle cx="82" cy="61" r="27" fill="none" stroke="'+ink+'" stroke-width="5"/><path d="M46 142C50 96 114 94 120 142M130 50H266V136H130Z" fill="none" stroke="'+ink+'" stroke-width="5"/><path d="M148 76H242M148 102H220" stroke="'+accent+'" stroke-width="7" stroke-dasharray="'+d+' 260"/></svg>';if(/product|screenflow|agent-simulation/.test(id))return '<svg viewBox="0 0 300 170"><rect x="32" y="28" width="236" height="116" rx="16" fill="none" stroke="'+ink+'" stroke-width="5"/><circle cx="52" cy="48" r="5" fill="'+accent+'"/><rect x="54" y="72" width="78" height="48" rx="9" fill="'+accent+'" opacity="'+o+'"/><path d="M150 79H244M150 101H222" stroke="'+ink+'" stroke-width="6"/></svg>';if(/quote|typed|claim|story-pressure/.test(id))return '<svg viewBox="0 0 300 170"><text x="34" y="80" font-size="78" fill="'+accent+'">“</text><path d="M90 55H264M90 88H236M54 126H250" stroke="'+ink+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+d+' 300"/></svg>';return '<svg viewBox="0 0 300 170"><rect x="32" y="35" width="92" height="98" rx="16" fill="none" stroke="'+ink+'" stroke-width="5"/><rect x="176" y="35" width="92" height="98" rx="16" fill="none" stroke="'+ink+'" stroke-width="5" opacity="'+o+'"/><path d="M130 83H168" stroke="'+accent+'" stroke-width="8"/><path d="M154 69l16 14-16 14" fill="none" stroke="'+accent+'" stroke-width="6"/></svg>'}
  function render(t){const idx=Math.min(families.length-1,Math.floor(t/${SCENE_SECONDS})),f=families[idx],local=(t%${SCENE_SECONDS})/${SCENE_SECONDS},colors=[data.colorSystems[(idx*2)%44],data.colorSystems[(idx*2+1)%44]],captionSet=[data.captions[(idx*3)%68],data.captions[(idx*3+1)%68],data.captions[(idx*3+2)%68]],current=captionSet[Math.min(2,Math.floor(local*3))];q('eyebrow').textContent='MOTION FAMILY '+String(idx+1).padStart(2,'0')+' · '+f.variants[0].baseTemplate;q('title').textContent=f.label;q('sub').textContent='五种风格变体同屏运行：语义结构保持一致，色彩、材质、密度与镜头节奏分别变化';q('counter').textContent=String(idx+1).padStart(2,'0')+' / 32';q('caption').textContent=current.label+' · '+current.group;q('caption').dataset.group=current.group;q('cards').innerHTML=f.variants.map((v,i)=>{const palette=data.colorSystems[(idx*5+i)%44]||{colors:fallback},c=palette.colors.length?palette.colors:fallback,accent=c[2]||c[0],ink=c[1]||'#20242a',surface=c[0]||'#fff';return '<article class="card '+(local>(i/7)?'active':'')+'" style="--accent:'+accent+';--ink:'+ink+';--surface:'+surface+'"><div class="index">VARIANT '+(i+1)+' · '+v.baseTemplate+'</div><div class="variant">'+(v.variantLabelZh||v.variantId)+'</div><div class="kind">'+(v.contentKind||'semantic scene')+' · '+(v.motionVerbs||[]).join(' / ')+'</div><div class="visual">'+visual(f,Math.max(0,(local-i*.08)/.72),accent,ink)+'</div><div class="bars">'+c.slice(0,5).map(x=>'<i style="background:'+x+'"></i>').join('')+'</div></article>'}).join('');q('colors').innerHTML=colors.map(x=>'<span class="palette-chip"><span class="swatch">'+x.colors.slice(0,5).map(c=>'<i style="background:'+c+'"></i>').join('')+'</span>'+x.name+'</span>').join('');q('captions').innerHTML=captionSet.map((x,i)=>'<span class="caption-chip '+(x.id===current.id?'active':'')+'">'+x.label+'</span>').join('');q('whiteboard').style.transform='translateX('+(local*18-9)+'px) rotate('+(local*.8-.4)+'deg)';q('ip-sample').style.opacity=(/ip-presenter|whiteboard/.test(f.familyId)?0.58:0)}render(0);window.renderAt=render;
  </script></body></html>`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2)); ensure(options.out); ensure(join(options.out, "frames"));
  const motion = JSON.parse(readFileSync(join(ROOT, "assets/motion-style-template-library.json"), "utf8"));
  const captions = JSON.parse(readFileSync(join(ROOT, "assets/caption-style-catalog.json"), "utf8"));
  const colorSystems = extractColorSystems(join(ROOT, "media/showcase/core-demo/semi-auto-config.html"));
  if (motion.coverage.familyCount !== 32 || motion.coverage.variantCount !== 5 || motion.templates.length !== 160) throw new Error("Unexpected motion catalog coverage");
  if (captions.styles.length !== 68 || Object.keys(captions.groups).length !== 8) throw new Error("Unexpected caption catalog coverage");
  const htmlPath = join(options.out, "capability-showcase.html");
  ensure(join(options.out, "personal-ip"));
  const ipSample = join(ROOT, "media/showcase/personal-ip/story-spine-opening.png");
  if (existsSync(ipSample)) copyFileSync(ipSample, join(options.out, "personal-ip/story-spine-opening.png"));
  write(htmlPath, makeHtml(motion, captions, colorSystems));
  let packagedAudio = "";
  if (options.providedAudio) {
    if (!existsSync(options.providedAudio)) throw new Error(`--provided-audio not found: ${options.providedAudio}`);
    ensure(join(options.out, "assets"));
    packagedAudio = join(options.out, "assets", "narration.wav");
    copyFileSync(options.providedAudio, packagedAudio);
  }
  const coverage = { generatedAt: new Date().toISOString(), renderer: "single-html-scene-playwright-ffmpeg", canvas: { width: WIDTH, height: HEIGHT, fps: FPS, durationSeconds: DURATION }, executableHtmlCores: [...new Set(motion.templates.map((item) => item.baseTemplate))], motion: { families: 32, variantsPerFamily: 5, combinations: 160, independentRenderers: false, visibleFamilyIds: [...new Set(motion.templates.map((item) => item.familyId))] }, colors: { configurationSystems: colorSystems.length, source: "media/showcase/core-demo/semi-auto-config.html", visibleNames: colorSystems.map((item) => item.name), note: "44 are configuration catalog systems; runtime has 10 named palettes and 10 visual themes." }, captions: { styles: 68, groups: 8, visibleStyleIds: captions.styles.map((item) => item.id), note: "68 routable catalog styles; bespoke per-style CSS is not claimed for every entry." }, personalIp: { horizontal: { status: "catalog-reel-reference", source: "media/showcase/personal-ip/story-spine-opening.png" }, vertical: { status: "separate-native-demo-required", reason: "Never crop horizontal into vertical." } }, audio: packagedAudio ? { status: "provided-local-melotts", path: "assets/narration.wav" } : { status: "review-only-silent", note: "No --provided-audio supplied; this is not final-quality audio." } };
  write(join(options.out, "coverage.json"), JSON.stringify(coverage, null, 2));
  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch(chromiumLaunchOptions(playwright.chromium));
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 }); await page.goto(pathToFileURL(htmlPath).href);
  for (let frame = 0; frame < Math.ceil(DURATION * FPS); frame += 1) { await page.evaluate((t) => window.renderAt(t), frame / FPS); await page.screenshot({ path: join(options.out, "frames", `frame-${String(frame).padStart(5, "0")}.png`) }); }
  await browser.close();
  const silent = join(options.out, "capability-showcase-silent.mp4"); run("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS), "-i", join(options.out, "frames", "frame-%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", silent]);
  const finalVideo = options.providedAudio ? join(options.out, "capability-showcase.mp4") : silent;
  if (packagedAudio) run("ffmpeg", ["-y", "-v", "error", "-i", silent, "-i", packagedAudio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(DURATION), finalVideo]);
  const shots = { opening: 0, middle: Math.floor(DURATION / 2), ending: DURATION - 0.2 }; for (const [name, at] of Object.entries(shots)) run("ffmpeg", ["-y", "-v", "error", "-ss", String(at), "-i", finalVideo, "-frames:v", "1", join(options.out, `${name}.png`)]);
  run("ffmpeg", ["-y", "-v", "error", "-i", join(options.out, "opening.png"), "-i", join(options.out, "middle.png"), "-i", join(options.out, "ending.png"), "-filter_complex", "[0:v][1:v][2:v]hstack=inputs=3,scale=960:-1", join(options.out, "contact-sheet.png")]);
  const black = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-vf", "blackdetect=d=0.2:pix_th=0.05", "-an", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] }); write(join(options.out, "blackdetect.log"), black);
  let volume = "";
  let silence = "";
  if (packagedAudio) {
    volume = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-af", "volumedetect", "-vn", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] }); write(join(options.out, "volumedetect.log"), volume);
    silence = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-af", "silencedetect=n=-45dB:d=1.2", "-vn", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] }); write(join(options.out, "silencedetect.log"), silence);
  }
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", finalVideo]));
  write(join(options.out, "ffprobe.json"), JSON.stringify(probe, null, 2));
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");
  const checks = {
    duration: Math.abs(Number(probe.format?.duration) - DURATION) <= 0.15,
    resolution: videoStream?.width === WIDTH && videoStream?.height === HEIGHT,
    videoStream: Boolean(videoStream),
    audioStream: packagedAudio ? Boolean(audioStream) : true,
    noDetectedBlackSegments: !black.includes("black_start:"),
    audioMeasured: packagedAudio ? /mean_volume:\s*[-\d.]+\s*dB/.test(volume) : true,
    noLongSilence: packagedAudio ? !silence.includes("silence_start:") : true,
  };
  const passed = Object.values(checks).every(Boolean);
  write(join(options.out, "qc.json"), JSON.stringify({ video: finalVideo, blackdetect: "blackdetect.log", ffprobe: "ffprobe.json", silentReviewOnly: !options.providedAudio, checks, passed }, null, 2));
  if (!passed) throw new Error(`Capability showcase QC failed: ${Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`);
  if (!options.keepFrames) rmSync(join(options.out, "frames"), { recursive: true, force: true });
  console.log(JSON.stringify({ out: options.out, video: finalVideo, durationSeconds: DURATION, coverage: "coverage.json", qc: "qc.json" }, null, 2));
}
main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
