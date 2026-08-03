#!/usr/bin/env node

/**
 * Render the public Codex Video Workflow capability film.
 *
 * The film is deliberately product-facing: every scene demonstrates a shipped
 * capability with project-owned assets. Internal renderer names and QC labels
 * remain in manifests, never in viewer-facing frames.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumLaunchOptions, loadPlaywright } from "./lib/load-playwright.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

const SCENES = [
  { id: "hook", duration: 7.4, caption: "一份 Brief，不只是生成一个片段，而是一整套可以审阅、修改和交付的视频生产包。" },
  { id: "framework", duration: 6.4333333333, caption: "内容进入后，框架会完成拆页、视觉路由、语音字幕、封面适配和质量检查。" },
  { id: "motion", duration: 7, caption: "推进、对比、连线、聚焦，每一种动效都对应明确的信息含义。" },
  { id: "config", duration: 6.9666666667, caption: "半自动模式提供中英文配置页面；全自动模式则从内容直接推进到成片。" },
  { id: "personal", duration: 7.1, caption: "个人 IP 使用原生页面保持人物、构图与叙事风格一致，不是简单裁切同一张图。" },
  { id: "whiteboard", duration: 7.5, caption: "手绘白板支持横屏与竖屏，按描线、圈点、回填的顺序，让知识路径被看见。" },
  { id: "covers", duration: 6.6333333333, caption: "封面不是一张图套三个尺寸，而是为横版、竖版和方形分别重组信息。" },
  { id: "captions", duration: 18.7666666667, captions: [
    { until: 0.4262877442, text: "字幕系统当前包含六十八种样式，分为八类；这里每一格都在运行自己的进场与强调效果。" },
    { until: 0.7424511545, text: "例如节奏型字幕会突出关键词，而不是让整行文字一起抖动。" },
    { until: 1, text: "双语和玻璃字幕，则把层级、可读性与安全区放在第一位。" },
  ] },
  { id: "closing", duration: 5.3, caption: "从一份 Brief，到可审阅的视频、字幕、封面、配置和质量证据。" },
];

let timelineCursor = 0;
for (const scene of SCENES) {
  scene.start = timelineCursor;
  scene.end = timelineCursor + scene.duration;
  timelineCursor = scene.end;
}
const DURATION = timelineCursor;

const IMAGE_ASSETS = {
  configZh: "media/showcase/core-demo/config-base-zh.png",
  configEn: "media/showcase/core-demo/config-base-en.png",
  coverHorizontal: "media/showcase/covers/story-spine-horizontal-16x9.jpg",
  coverVertical: "media/showcase/covers/story-spine-vertical-9x16.jpg",
  coverSquare: "media/showcase/covers/story-spine-square-1x1.jpg",
  ipOpening: "media/showcase/personal-ip/story-spine-opening.png",
  ipMiddle: "media/showcase/personal-ip/story-spine-middle.png",
};

const VIDEO_ASSETS = {
  personal: "media/showcase/personal-ip/example-film/personal-ip-two-page-horizontal.mp4",
  whiteboardHorizontal: "media/showcase/personal-ip/demos/personal-ip-whiteboard-horizontal-6s.mp4",
  whiteboardVertical: "media/showcase/personal-ip/demos/personal-ip-whiteboard-vertical-6s.mp4",
};

const GROUP_ORDER = ["glass", "editorial", "kinetic", "ui", "bilingual", "audio", "minimal", "mobile"];
const GROUP_LABELS = {
  glass: ["玻璃质感", "轻信息层"],
  editorial: ["编辑叙事", "观点与证据"],
  kinetic: ["节奏强调", "钩子与重点"],
  ui: ["界面工具", "操作与状态"],
  bilingual: ["双语层级", "中英解释"],
  audio: ["声音响应", "访谈与播客"],
  minimal: ["极简字幕", "低干扰讲解"],
  mobile: ["移动端", "竖屏安全区"],
};
const GROUP_SAMPLES = {
  glass: "看见层次",
  editorial: "观点有出处",
  kinetic: "重点出现",
  ui: "状态已更新",
  bilingual: "双语清晰",
  audio: "声音正在发生",
  minimal: "少即是多",
  mobile: "竖屏也安全",
};

function parseArgs(argv) {
  const options = {
    out: join(ROOT, "media/showcase/workflow-film"),
    providedAudio: "",
    keepFrames: false,
    previewOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") options.out = resolve(argv[++index]);
    else if (arg === "--provided-audio") options.providedAudio = resolve(argv[++index]);
    else if (arg === "--keep-frames") options.keepFrames = true;
    else if (arg === "--preview-only") options.previewOnly = true;
    else if (arg === "--help") {
      console.log("Usage: node scripts/render-workflow-film.mjs [--out <dir>] [--provided-audio <wav>] [--preview-only] [--keep-frames]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function ensure(path) { mkdirSync(path, { recursive: true }); }
function write(path, value) { ensure(dirname(path)); writeFileSync(path, value, "utf8"); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stdout || ""}${result.stderr || ""}`);
  return `${result.stdout || ""}${result.stderr || ""}`;
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function srtTime(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const secs = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}
function captionCues() {
  const cues = [];
  for (const scene of SCENES) {
    if (!scene.captions) {
      cues.push({ scene: scene.id, start: scene.start, end: scene.end, text: scene.caption });
      continue;
    }
    let from = 0;
    for (const cue of scene.captions) {
      cues.push({ scene: scene.id, start: scene.start + from * scene.duration, end: scene.start + cue.until * scene.duration, text: cue.text });
      from = cue.until;
    }
  }
  return cues;
}
function captionFamilies(catalog) {
  return GROUP_ORDER.map((id) => ({
    id,
    name: GROUP_LABELS[id][0],
    job: GROUP_LABELS[id][1],
    styles: catalog.styles.filter((style) => style.group === id),
  }));
}
function captionFamilyHtml(family, familyIndex) {
  const tiles = family.styles.map((style, index) => {
    const variant = (index + familyIndex * 3) % 12;
    return `<article class="caption-tile group-${family.id} variant-${variant}" data-caption-tile data-tile-index="${style.order - 1}">
      <span class="tile-demo"><i>${esc(GROUP_SAMPLES[family.id])}</i></span>
      <small>${esc(style.labelZh)}</small>
    </article>`;
  }).join("");
  return `<section class="caption-family family-${family.id}">
    <header><b>${family.name}</b><span>${family.job}</span><em>${family.styles.length}</em></header>
    <div class="caption-tiles">${tiles}</div>
  </section>`;
}

function makeHtml(catalog) {
  const families = captionFamilies(catalog);
  const payload = JSON.stringify({ scenes: SCENES, families }).replace(/</g, "\\u003c");
  const familyHtml = families.map(captionFamilyHtml).join("");
  const flowItems = [
    ["01", "内容理解", "识别叙事目的"],
    ["02", "页面拆解", "一页一个重点"],
    ["03", "视觉路由", "匹配素材与动效"],
    ["04", "语音字幕", "统一时间轴"],
    ["05", "封面适配", "原生比例构图"],
    ["06", "质量检查", "交付可复核"],
  ];
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--paper:#f7f3ea;--ink:#111923;--muted:#66727e;--orange:#ff6b35;--gold:#f2bf5e;--teal:#20b7b5;--cyan:#79eef0;--navy:#07111f;--blue:#377dff;--p:0}
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--navy);font-family:Inter,"PingFang SC","Hiragino Sans GB",system-ui,sans-serif;color:var(--ink)}
  #stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:var(--paper)}
  .scene{position:absolute;inset:0;opacity:0;overflow:hidden;pointer-events:none;background:var(--paper)}.scene.active{opacity:1}
  .grid{position:absolute;inset:0;opacity:.14;background-image:linear-gradient(#2f53691e 1px,transparent 1px),linear-gradient(90deg,#2f53691e 1px,transparent 1px);background-size:48px 48px}
  .eyebrow{font-size:16px;font-weight:900;letter-spacing:.16em;color:var(--orange)}
  .scene-head{position:absolute;left:76px;right:76px;top:48px;display:flex;justify-content:space-between;align-items:flex-start;z-index:5}.scene-head h2{margin:10px 0 0;font-size:54px;line-height:1.04;letter-spacing:-.045em}.scene-head p{width:530px;margin:12px 0 0;padding-left:20px;border-left:4px solid var(--orange);font-size:23px;line-height:1.35;font-weight:700;color:#40505d}
  .narration{position:absolute;z-index:100;left:50%;bottom:24px;transform:translateX(-50%);width:max-content;max-width:1660px;min-width:880px;padding:15px 30px;border-radius:18px;background:#07111fed;color:#fff;text-align:center;font-size:28px;line-height:1.25;font-weight:760;white-space:nowrap;box-shadow:0 16px 45px #0005;border:1px solid #ffffff2a}
  .noise{position:absolute;inset:0;z-index:90;pointer-events:none;opacity:.07;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E")}

  /* Hook */
  #hook{background:radial-gradient(circle at 75% 22%,#163f50 0,#081827 28%,#06101d 62%,#030813 100%);color:#fff}
  .hook-brand{position:absolute;left:84px;top:60px;display:flex;align-items:center;gap:13px;font-size:18px;font-weight:850;letter-spacing:.13em}.hook-brand i{width:13px;height:13px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 7px #ff6b3522}
  .hook-copy{position:absolute;left:82px;top:225px;width:900px;z-index:8}.hook-copy h1{margin:0;font-size:104px;line-height:.96;letter-spacing:-.07em;font-weight:950}.hook-copy h1 span{display:block;color:var(--orange);transform:translateY(calc((1 - var(--p))*62px));opacity:calc(.1 + var(--p))}.hook-copy p{margin:34px 0 0;width:760px;color:#c7d4dd;font-size:30px;line-height:1.45}.hook-proof{position:absolute;left:84px;top:755px;display:flex;gap:12px}.hook-proof span{padding:10px 15px;border:1px solid #ffffff2d;border-radius:999px;color:#dbe9ee;background:#ffffff0c;font-size:17px}
  .output-orbit{position:absolute;right:68px;top:118px;width:780px;height:760px}.output-card{position:absolute;overflow:hidden;border:1px solid #ffffff3b;background:#132435;border-radius:24px;box-shadow:0 30px 70px #0008;transform:translateY(calc((1 - var(--p))*80px)) rotate(var(--r));opacity:calc(.18 + var(--p)*.82)}.output-card img{width:100%;height:100%;object-fit:cover}.output-card.a{left:10px;top:95px;width:505px;height:284px;--r:-4deg}.output-card.b{right:10px;top:0;width:235px;height:418px;--r:4deg}.output-card.c{left:220px;bottom:10px;width:310px;height:310px;--r:-2deg}.output-card.d{right:0;bottom:62px;width:255px;height:300px;--r:5deg}.output-card.d img{object-position:left center}.output-badge{position:absolute;right:500px;top:600px;padding:18px 23px;border-radius:20px;background:var(--orange);color:#111923;font-size:24px;font-weight:950;transform:rotate(-4deg) scale(calc(.72 + var(--p)*.28));box-shadow:0 20px 50px #0007}

  /* Framework */
  #framework{background:linear-gradient(145deg,#f7f3ea,#edf5f3)}.flow-board{position:absolute;left:76px;right:76px;top:270px;height:625px;padding:40px 40px 34px;border-radius:30px;background:#fff;box-shadow:0 24px 65px #2737461c;border:1px solid #d7ddd9}.flow-line{position:absolute;left:115px;right:115px;top:184px;height:9px;border-radius:99px;background:#d9dfdc;overflow:hidden}.flow-line i{display:block;width:100%;height:100%;transform-origin:left;transform:scaleX(var(--p));background:linear-gradient(90deg,var(--orange),var(--gold),var(--teal),var(--blue))}.flow-grid{position:relative;display:grid;grid-template-columns:repeat(6,1fr);gap:22px}.flow-item{position:relative;text-align:center;padding-top:72px}.flow-item .num{position:absolute;left:50%;top:102px;transform:translate(-50%,-50%);width:78px;height:78px;border:8px solid #d7ddd9;border-radius:50%;display:grid;place-items:center;background:#fff;font-size:20px;font-weight:950;z-index:3}.flow-item.active .num{border-color:var(--orange);background:var(--ink);color:#fff;box-shadow:0 0 0 14px #ff6b3518}.flow-item h3{margin:188px 0 8px;font-size:24px}.flow-item p{margin:0;color:var(--muted);font-size:18px;line-height:1.35}.flow-result{position:absolute;left:355px;right:355px;bottom:38px;display:flex;justify-content:center;gap:12px}.flow-result span{padding:13px 18px;border-radius:14px;background:#0d1a27;color:#fff;font-weight:800}.flow-result span:last-child{background:var(--orange);color:#111923}

  /* Motion examples */
  #motion{background:#0a1420;color:#fff}.motion-head p{color:#b7c7d1;border-color:var(--cyan)}.motion-head .eyebrow{color:var(--cyan)}.motion-grid{position:absolute;left:76px;right:76px;top:246px;bottom:142px;display:grid;grid-template-columns:1fr 1fr;gap:24px}.motion-card{position:relative;border-radius:26px;background:#111f2e;border:1px solid #31465b;overflow:hidden;padding:28px;box-shadow:0 22px 50px #0004}.motion-card header{display:flex;justify-content:space-between;align-items:center}.motion-card header b{font-size:27px}.motion-card header span{color:#8fa6b6;font-size:17px}.motion-card .meaning-chip{position:absolute;right:26px;bottom:22px;padding:9px 13px;border-radius:999px;background:#ffffff10;color:#dce7ed;font-weight:760}.sequence-demo{position:absolute;left:45px;right:45px;top:155px;height:100px}.sequence-demo .rail{position:absolute;left:10px;right:10px;top:40px;height:6px;background:#2b3d4c}.sequence-demo .rail i{display:block;height:100%;background:var(--orange);transform-origin:left;transform:scaleX(var(--p))}.sequence-demo span{position:absolute;top:15px;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:#203342;border:5px solid #40586b;font-weight:900}.sequence-demo span.on{background:var(--orange);border-color:#ffb394;color:#0b1420}.compare-demo{position:absolute;left:42px;right:42px;top:126px;height:175px;border-radius:17px;overflow:hidden;background:linear-gradient(90deg,#273645 0 50%,#f4ede2 50%)}.compare-demo:after{content:"";position:absolute;left:50%;top:0;bottom:0;width:6px;background:var(--orange);transform:translateX(calc((var(--p) - .5)*380px))}.compare-demo b{position:absolute;top:70px;font-size:28px}.compare-demo .before{left:75px;color:#9cabb7}.compare-demo .after{right:75px;color:#101a24}.relation-demo{position:absolute;left:45px;right:45px;top:118px;height:210px}.relation-demo svg{position:absolute;inset:0;width:100%;height:100%}.relation-demo path{fill:none;stroke:var(--cyan);stroke-width:7;stroke-linecap:round;stroke-dasharray:700;stroke-dashoffset:calc(700*(1 - var(--p)))}.relation-demo span{position:absolute;width:124px;height:70px;border-radius:16px;display:grid;place-items:center;background:#1c3042;border:1px solid #446277;font-weight:850}.relation-demo span:nth-of-type(1){left:0;top:80px}.relation-demo span:nth-of-type(2){left:315px;top:8px}.relation-demo span:nth-of-type(3){right:0;top:100px}.focus-demo{position:absolute;left:45px;right:45px;top:124px;height:200px}.focus-demo span{position:absolute;padding:12px 17px;border-radius:12px;background:#203140;color:#8295a3;font-weight:760;filter:blur(calc((1 - var(--p))*1.5px));opacity:calc(.38 + var(--p)*.4)}.focus-demo .hero{left:260px;top:58px;font-size:35px;background:var(--orange);color:#0b1420;opacity:1;filter:none;transform:scale(calc(.78 + var(--p)*.22));box-shadow:0 0 0 calc(var(--p)*16px) #ff6b351c}

  /* Config */
  #config{background:linear-gradient(145deg,#f4f7fb,#e8f2f1)}.config-stage{position:absolute;left:75px;right:75px;top:230px;bottom:145px;display:grid;grid-template-columns:1fr 1fr;gap:26px}.config-card{position:relative;padding:14px;border-radius:25px;background:#fff;border:1px solid #d7dde3;box-shadow:0 24px 55px #27374622;overflow:hidden}.config-card img{width:100%;height:100%;object-fit:cover;border-radius:16px;object-position:top center;filter:saturate(.94)}.config-card b{position:absolute;left:34px;top:31px;padding:10px 16px;border-radius:999px;background:#0a1624e8;color:#fff;font-size:19px}.config-card.en{transform:translateY(calc((1 - var(--p))*40px))}.mode-switch{position:absolute;left:50%;top:184px;z-index:8;transform:translateX(-50%);display:flex;padding:6px;border-radius:999px;background:#0c1724;box-shadow:0 12px 30px #0003}.mode-switch span{padding:9px 18px;color:#8fa3b5;font-weight:850}.mode-switch .active{border-radius:999px;background:var(--orange);color:#111923}

  /* Personal IP + whiteboard video slots */
  #personal,#whiteboard{background:linear-gradient(160deg,#faf7f1,#eef3ef)}.native-frame{position:absolute;border-radius:24px;border:2px solid #d4d8d2;background:#fff;box-shadow:0 24px 55px #24313d25;overflow:hidden}.personal-frame{left:226px;top:118px;width:1468px;height:826px}.personal-frame:before{content:"原生页面连续动画";position:absolute;left:24px;top:22px;padding:8px 13px;border-radius:999px;background:#111923;color:#fff;font-size:16px;font-weight:800;z-index:2}.personal-tags{position:absolute;left:76px;right:76px;top:54px;display:flex;justify-content:flex-end;gap:10px;z-index:4}.personal-tags span,.whiteboard-label{padding:9px 13px;border-radius:999px;background:#fff;border:1px solid #d8ddd8;color:#394852;font-weight:800;box-shadow:0 10px 25px #26333d15}.whiteboard-horizontal-frame{left:76px;top:218px;width:1210px;height:681px}.whiteboard-vertical-frame{right:75px;top:218px;width:392px;height:696px}.whiteboard-label{position:absolute;top:167px}.whiteboard-label.h{left:76px}.whiteboard-label.v{right:75px}.draw-path{position:absolute;inset:0;pointer-events:none}.draw-path path{fill:none;stroke:var(--orange);stroke-width:7;stroke-linecap:round;stroke-dasharray:720;stroke-dashoffset:calc(720*(1 - var(--p)))}

  /* Covers */
  #covers{background:#0b1521;color:#fff}.covers-head p{color:#b8c7d2}.cover-stage{position:absolute;left:75px;right:75px;top:235px;bottom:145px;display:grid;grid-template-columns:1.45fr .72fr .82fr;gap:28px;align-items:center}.cover-card{position:relative;padding:12px;border-radius:26px;background:#152536;border:1px solid #3a5166;box-shadow:0 25px 60px #0007;overflow:hidden;transform:translateY(calc((1 - var(--p))*45px))}.cover-card img{width:100%;height:100%;display:block;object-fit:cover;border-radius:17px}.cover-card.horizontal{height:520px}.cover-card.vertical{height:620px}.cover-card.square{height:490px}.cover-card b{position:absolute;left:28px;bottom:26px;padding:9px 13px;border-radius:999px;background:#07111fe8;color:#fff}.cover-principles{position:absolute;left:87px;top:182px;display:flex;gap:9px}.cover-principles span{padding:8px 12px;border-radius:999px;border:1px solid #ffffff2d;color:#cad8e1;background:#ffffff09}

  /* Captions */
  #captions{background:#07111f;color:#fff}.caption-title{position:absolute;left:70px;right:70px;top:42px;display:flex;justify-content:space-between;align-items:flex-end;z-index:6}.caption-title h2{margin:8px 0 0;font-size:55px;letter-spacing:-.045em}.caption-title h2 span{color:var(--orange)}.caption-title p{margin:0;color:#9ab0bf;font-size:22px}.caption-wall{position:absolute;left:65px;right:65px;top:150px;bottom:135px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:15px;opacity:1;transform:scale(1);transition:none}.caption-family{padding:16px;border-radius:20px;background:#101f2e;border:1px solid #2b4256;overflow:hidden}.caption-family header{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:baseline}.caption-family header b{font-size:20px}.caption-family header span{color:#7f96a7;font-size:14px}.caption-family header em{font-style:normal;font-size:18px;color:var(--orange);font-weight:900}.caption-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.caption-tile{min-height:55px;padding:6px 5px;border-radius:9px;background:#172b3d;border:1px solid #31506a;overflow:hidden;text-align:center}.caption-tile small{display:block;margin-top:3px;color:#7f96a7;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tile-demo{height:23px;display:flex;align-items:center;justify-content:center;overflow:hidden}.tile-demo i{display:inline-block;font-style:normal;font-size:12px;font-weight:900;white-space:nowrap;opacity:var(--a);transform:translateY(calc((1 - var(--a))*9px))}.group-glass .tile-demo i{padding:3px 7px;border:1px solid #ffffff38;border-radius:8px;background:linear-gradient(110deg,#ffffff12,#72e8ec35,#ffffff10);box-shadow:0 0 calc(var(--a)*12px) #71e4e84d}.group-editorial .tile-demo i{border-left:3px solid #ff7650;padding-left:6px;clip-path:inset(0 calc((1 - var(--a))*100%) 0 0)}.group-kinetic .tile-demo i{color:#111923;background:#ffb342;padding:3px 6px;transform:scale(calc(.72 + var(--a)*.28)) rotate(calc((1 - var(--a))*-3deg))}.group-ui .tile-demo i{font-family:ui-monospace,SFMono-Regular;color:#74edf0;border:1px solid #2f6970;padding:3px 6px;border-radius:5px;transform:translateX(calc((1 - var(--a))*14px))}.group-bilingual .tile-demo i{font-size:11px;border-bottom:1px solid #6da6bc;padding-bottom:2px}.group-audio .tile-demo i:before{content:"▂▆▃ ";color:#62e1e5;letter-spacing:1px}.group-minimal .tile-demo i{font-weight:650;border-bottom:1px solid #dde8ef;padding-bottom:2px}.group-mobile .tile-demo i{border-radius:999px;background:#eff5f7;color:#14202b;padding:3px 8px;transform:scale(calc(.86 + var(--a)*.14))}.variant-1{border-radius:999px}.variant-2{background:#251f38;border-color:#654b80}.variant-3{border-left:4px solid #ff6b35}.variant-4{background:#0b1723}.variant-5{background:#e8eff1}.variant-5 small{color:#53626c}.variant-6{border-style:dashed}.variant-7{box-shadow:inset 0 0 18px #2ad5d52a}.variant-8{background:linear-gradient(135deg,#192b3b,#3c2446)}.variant-9{border-radius:4px}.variant-10{border-color:#f2bf5e}.variant-11{background:#211e1c}
  .caption-hero{position:absolute;inset:0;display:none;place-items:center;z-index:10}.caption-hero.active{display:grid}.caption-hero:before{content:"";position:absolute;inset:120px 120px 135px;border-radius:36px;background:radial-gradient(circle at 50% 40%,#1b3549,#0a1724 62%);border:1px solid #315069}.hero-kicker{position:absolute;left:154px;top:165px;color:#91a8b7;font-weight:850;letter-spacing:.12em}.kinetic-caption{position:relative;font-size:76px;font-weight:950;letter-spacing:-.055em;color:#edf7f8}.kinetic-caption span{position:relative;color:#111923;display:inline-block;padding:6px 16px;margin:0 8px;background:var(--orange);transform:scale(calc(.7 + var(--hero)*.3)) rotate(calc((1 - var(--hero))*-4deg))}.kinetic-caption span:after{content:"";position:absolute;left:-8px;right:-8px;bottom:-7px;height:9px;background:var(--gold);transform-origin:left;transform:scaleX(var(--hero))}.glass-caption{position:relative;width:1180px;padding:34px 44px;border-radius:28px;border:1px solid #ffffff3b;background:linear-gradient(120deg,#ffffff15,#4bdae33b,#ffffff0e);box-shadow:0 26px 75px #0008, inset 0 1px #ffffff48;backdrop-filter:blur(16px);overflow:hidden}.glass-caption:after{content:"";position:absolute;top:-120px;bottom:-120px;width:180px;background:linear-gradient(90deg,transparent,#ffffff32,transparent);transform:translateX(calc(var(--hero)*1300px - 220px)) rotate(18deg)}.glass-caption b{display:block;font-size:64px;letter-spacing:-.04em}.glass-caption span{display:block;margin-top:10px;color:#a9d8df;font-size:30px;letter-spacing:.04em}.caption-count{position:absolute;right:78px;bottom:103px;z-index:8;font-size:18px;color:#8fa5b4}.caption-count b{font-size:38px;color:#fff}

  /* Closing */
  #closing{background:radial-gradient(circle at 60% 30%,#204450,#0a1724 44%,#050b14 100%);color:#fff}.closing-copy{position:absolute;left:82px;top:160px}.closing-copy h2{margin:0;font-size:86px;line-height:1;letter-spacing:-.06em}.closing-copy h2 span{color:var(--orange)}.closing-copy p{margin:28px 0 0;color:#b9cbd4;font-size:28px}.closing-output{position:absolute;left:82px;right:82px;top:570px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.closing-output article{padding:26px 20px;border-radius:20px;border:1px solid #ffffff2c;background:#ffffff0c;font-size:24px;font-weight:900;transform:translateY(calc((1 - var(--p))*45px))}.closing-output article b{display:block;margin-bottom:8px;color:var(--orange);font-size:15px;letter-spacing:.12em}.closing-line{position:absolute;left:84px;top:505px;width:980px;height:7px;border-radius:99px;background:linear-gradient(90deg,var(--orange),var(--gold),var(--teal));transform-origin:left;transform:scaleX(var(--p))}
</style></head><body><main id="stage">
  <section class="scene" id="hook"><div class="hook-brand"><i></i>CODEX VIDEO WORKFLOW</div><div class="hook-copy audit"><h1>一份 Brief<span>生成一整套视频</span></h1><p>从内容理解到动效、字幕、个人 IP、手绘白板、封面与质量证据。</p></div><div class="hook-proof"><span>可审阅</span><span>可修改</span><span>可追溯</span></div><div class="output-orbit"><article class="output-card a"><img src="assets/cover-horizontal.jpg"></article><article class="output-card b"><img src="assets/cover-vertical.jpg"></article><article class="output-card c"><img src="assets/cover-square.jpg"></article><article class="output-card d"><img src="assets/ip-opening.png"></article><div class="output-badge">一条完整生产线</div></div></section>

  <section class="scene" id="framework"><div class="grid"></div><div class="scene-head audit"><div><div class="eyebrow">HOW IT WORKS</div><h2>输入之后，能力自动路由</h2></div><p>每一步都不是黑盒跳转，而是产生一个可查看、可继续修改的中间结果。</p></div><div class="flow-board"><div class="flow-line"><i></i></div><div class="flow-grid">${flowItems.map(([num,title,body],index)=>`<article class="flow-item" data-flow="${index}"><span class="num">${num}</span><h3>${title}</h3><p>${body}</p></article>`).join("")}</div><div class="flow-result"><span>视频</span><span>字幕</span><span>封面</span><span>配置</span><span>质量证据</span></div></div></section>

  <section class="scene" id="motion"><div class="scene-head motion-head audit"><div><div class="eyebrow">SEMANTIC MOTION</div><h2>动效必须解释内容</h2></div><p>不是让画面更忙，而是让顺序、差异、关系和结论更快被理解。</p></div><div class="motion-grid"><article class="motion-card"><header><b>推进</b><span>表示流程正在完成</span></header><div class="sequence-demo"><div class="rail"><i></i></div>${[0,1,2,3].map(i=>`<span data-sequence="${i}" style="left:${i*31}%">${i+1}</span>`).join("")}</div><span class="meaning-chip">含义：顺序与进度</span></article><article class="motion-card"><header><b>对比</b><span>表示结构发生变化</span></header><div class="compare-demo"><b class="before">之前</b><b class="after">之后</b></div><span class="meaning-chip">含义：差异与选择</span></article><article class="motion-card"><header><b>连线</b><span>表示对象产生关系</span></header><div class="relation-demo"><svg viewBox="0 0 730 210"><path d="M110 115 C250 115 240 48 375 48 S535 138 650 138"/></svg><span>内容</span><span>视觉</span><span>结论</span></div><span class="meaning-chip">含义：因果与关联</span></article><article class="motion-card"><header><b>聚焦</b><span>表示当前信息优先级</span></header><div class="focus-demo"><span style="left:20px;top:5px">背景信息</span><span style="right:20px;top:22px">补充信息</span><span style="left:60px;bottom:10px">次要数据</span><span style="right:55px;bottom:5px">延伸说明</span><span class="hero">核心结论</span></div><span class="meaning-chip">含义：注意力与重点</span></article></div></section>

  <section class="scene" id="config"><div class="scene-head audit"><div><div class="eyebrow">TWO MODES · BILINGUAL</div><h2>配置清楚，自动化才可信</h2></div><p>半自动模式可以逐项调整；全自动模式使用同一份生产合同直接执行。</p></div><div class="mode-switch"><span class="active">半自动配置</span><span>全自动执行</span></div><div class="config-stage"><article class="config-card"><img src="assets/config-zh.png"><b>简体中文</b></article><article class="config-card en"><img src="assets/config-en.png"><b>English</b></article></div></section>

  <section class="scene" id="personal"><div class="personal-tags audit"><span>原生页面</span><span>人物一致</span><span>叙事连续</span></div><div class="native-frame personal-frame"></div></section>

  <section class="scene" id="whiteboard"><div class="scene-head audit"><div><div class="eyebrow">PERSONAL IP · WHITEBOARD</div><h2>横屏与竖屏，都能原生手绘</h2></div><p>稳定背景之上依次描线、圈点、回填；人物与字幕始终保持清晰。</p></div><span class="whiteboard-label h">横屏 16:9</span><span class="whiteboard-label v">竖屏 9:16</span><div class="native-frame whiteboard-horizontal-frame"></div><div class="native-frame whiteboard-vertical-frame"></div><svg class="draw-path" viewBox="0 0 1920 1080"><path d="M123 817 C380 718 498 835 723 680 S1032 568 1223 454"/></svg></section>

  <section class="scene" id="covers"><div class="scene-head covers-head audit"><div><div class="eyebrow">NATIVE COVER DESIGN</div><h2>同一主题，三种原生构图</h2></div><p>比例变化时重新安排标题、人物与证据，而不是机械裁切。</p></div><div class="cover-principles"><span>内容承诺</span><span>视觉锚点</span><span>比例安全区</span></div><div class="cover-stage"><article class="cover-card horizontal"><img src="assets/cover-horizontal.jpg"><b>横版 16:9</b></article><article class="cover-card vertical"><img src="assets/cover-vertical.jpg"><b>竖版 9:16</b></article><article class="cover-card square"><img src="assets/cover-square.jpg"><b>方形 1:1</b></article></div></section>

  <section class="scene" id="captions"><div class="caption-title audit"><div><div class="eyebrow">CAPTION SYSTEM</div><h2><span>68</span> 种字幕 · 8 类语义任务</h2></div><p>先看全量动态，再看两个可读实例</p></div><div class="caption-wall" id="caption-wall">${familyHtml}</div><div class="caption-hero" id="hero-kinetic"><span class="hero-kicker">实例一 · 节奏强调</span><div class="kinetic-caption">真正重要的，是<span>这句话</span></div></div><div class="caption-hero" id="hero-glass"><span class="hero-kicker">实例二 · 双语玻璃</span><div class="glass-caption"><b>从内容到成片</b><span>FROM BRIEF TO DELIVERY</span></div></div><div class="caption-count"><b>68</b> 个动态缩略效果已在画面中运行</div></section>

  <section class="scene" id="closing"><div class="closing-copy audit"><div class="eyebrow">ONE BRIEF · COMPLETE DELIVERY</div><h2>从内容，<br>到<span>可审阅成片</span></h2><p>核心能力不止是生成，而是把整个生产过程组织起来。</p></div><div class="closing-line"></div><div class="closing-output">${[["01","视频"],["02","字幕"],["03","封面"],["04","配置"],["05","质量证据"]].map(([n,t])=>`<article><b>${n}</b>${t}</article>`).join("")}</div></section>

  <div class="narration" id="narration"></div><div class="noise"></div>
</main><script>
window.__film=${payload};
const scenes=window.__film.scenes;
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>1-Math.pow(1-clamp(v),3);
function sceneAt(time){return scenes.find(scene=>time>=scene.start&&time<scene.end)||scenes.at(-1)}
function renderCaptions(progress){
  const wall=document.getElementById('caption-wall');
  const kinetic=document.getElementById('hero-kinetic');
  const glass=document.getElementById('hero-glass');
  const title=document.querySelector('#captions .caption-title');
  const count=document.querySelector('#captions .caption-count');
  const captionScene=scenes.find(scene=>scene.id==='captions');
  const kineticStart=captionScene.captions[0].until;
  const glassStart=captionScene.captions[1].until;
  const wallActive=progress<kineticStart;
  const kineticActive=progress>=kineticStart&&progress<glassStart;
  wall.style.display=wallActive?'grid':'none';
  title.style.display=wallActive?'flex':'none';
  count.style.display=wallActive?'block':'none';
  kinetic.classList.toggle('active',kineticActive);
  glass.classList.toggle('active',progress>=glassStart);
  const heroProgress=kineticActive?(progress-kineticStart)/(glassStart-kineticStart):progress>=glassStart?(progress-glassStart)/(1-glassStart):0;
  document.getElementById('captions').style.setProperty('--hero',ease(heroProgress));
  document.querySelectorAll('[data-caption-tile]').forEach((node,index)=>{
    const wave=(Math.sin(progress*38-index*.64)+1)/2;
    const stagger=clamp(progress*5-(index%17)*.035);
    node.style.setProperty('--a',Math.max(.2,ease(stagger)*(.55+.45*wave)));
  });
}
function setScene(scene,progress){
  document.querySelectorAll('.scene').forEach(node=>node.classList.toggle('active',node.id===scene.id));
  const root=document.getElementById(scene.id);root.style.setProperty('--p',ease(progress));
  const activeCaption=scene.captions?.find(cue=>progress<=cue.until)?.text||scene.captions?.at(-1)?.text||scene.caption;
  document.getElementById('narration').textContent=activeCaption;
  if(scene.id==='framework')document.querySelectorAll('[data-flow]').forEach((node,index)=>node.classList.toggle('active',progress>(index+.35)/7));
  if(scene.id==='motion')document.querySelectorAll('[data-sequence]').forEach((node,index)=>node.classList.toggle('on',progress>(index+.35)/5));
  if(scene.id==='captions')renderCaptions(progress);
}
window.renderAt=function(time){const scene=sceneAt(clamp(time/${DURATION})*${DURATION - 0.001});setScene(scene,(time-scene.start)/scene.duration)};
window.auditAt=function(time){window.renderAt(time);return [...document.querySelectorAll('.scene.active .audit')].map(node=>{const r=node.getBoundingClientRect();return{text:node.textContent.trim().slice(0,90),left:r.left,top:r.top,right:r.right,bottom:r.bottom,inside:r.left>=0&&r.top>=0&&r.right<=1920&&r.bottom<=960}})};
window.renderAt(0);
</script></body></html>`;
}

async function renderPreview(page, out) {
  const time = (id, offset) => SCENES.find((scene) => scene.id === id).start + offset;
  const previews = {
    opening: time("hook", 2.5),
    framework: time("framework", 4.1),
    motion: time("motion", 5.4),
    config: time("config", 3.7),
    personal: time("personal", 3.2),
    whiteboard: time("whiteboard", 4.5),
    covers: time("covers", 4.3),
    captionsOverview: time("captions", 5.2),
    captionsKinetic: time("captions", 9.7),
    captionsGlass: time("captions", 14.2),
    closing: time("closing", 3.1),
  };
  const audit = [];
  for (const [name, at] of Object.entries(previews)) {
    const visible = await page.evaluate((value) => window.auditAt(value), at);
    audit.push({ time: at, scene: SCENES.find((scene) => at >= scene.start && at < scene.end)?.id, visible });
    await page.screenshot({ path: join(out, "screenshots", `${name}.png`) });
  }
  write(join(out, "logs", "layout-audit.json"), JSON.stringify(audit, null, 2));
  if (!audit.every((item) => item.visible.every((entry) => entry.inside))) throw new Error("Layout audit failed: a critical viewer-facing label is clipped");
}

function writeContracts(out, catalog, families) {
  const cues = captionCues();
  const narrationSegments = cues.map((cue, index) => ({ index, scene: cue.scene, duration: Number((cue.end - cue.start).toFixed(3)), text: cue.text }));
  const pronunciationPreflightPath = join(out, "workflow", "chinese-pronunciation-preflight.json");
  const effectivePronunciationPath = join(out, "workflow", "effective-pronunciation-plan.json");
  const pronunciationVerificationPath = join(out, "workflow", "pronunciation-application-verification.json");
  const pronunciationPreflight = existsSync(pronunciationPreflightPath) ? JSON.parse(readFileSync(pronunciationPreflightPath, "utf8")) : null;
  const effectivePronunciation = existsSync(effectivePronunciationPath) ? JSON.parse(readFileSync(effectivePronunciationPath, "utf8")) : null;
  const pronunciationVerification = existsSync(pronunciationVerificationPath) ? JSON.parse(readFileSync(pronunciationVerificationPath, "utf8")) : null;
  write(join(out, "workflow", "content-presentation-design.json"), JSON.stringify({ schemaVersion: 1, concept: "brief-to-delivery product reel", viewerPromise: "one brief becomes a reviewable video production package", openingRule: "show finished capability outcomes before process", sceneRule: "one capability, one concrete meaning, one reason to continue" }, null, 2));
  write(join(out, "workflow", "motion-template-selection.json"), JSON.stringify({ schemaVersion: 1, examples: ["progress=sequence", "compare=difference", "connect=relationship", "focus=priority"], selectionRule: "motion must explain content" }, null, 2));
  write(join(out, "workflow", "caption-style-plan.json"), JSON.stringify({ schemaVersion: 1, totalStyles: catalog.styles.length, groupCount: families.length, presentation: "68 live mini-previews followed by two readable hero examples", groups: families.map((family) => ({ id: family.id, label: family.name, count: family.styles.length, styleIds: family.styles.map((style) => style.id) })) }, null, 2));
  write(join(out, "workflow", "whiteboard-layered-reveal-plan.json"), JSON.stringify({ schemaVersion: 1, formats: ["16:9", "9:16"], layers: ["stable background", "hand-drawn semantic path", "colored emphasis", "subtitle topmost"], sourceVideos: [VIDEO_ASSETS.whiteboardHorizontal, VIDEO_ASSETS.whiteboardVertical] }, null, 2));
  write(join(out, "workflow", "visual-asset-manifest.json"), JSON.stringify({ schemaVersion: 1, ownership: "project-owned generated showcase assets", images: IMAGE_ASSETS, videos: VIDEO_ASSETS, personalIp: { persona: "generic fixed host", likenessClaim: false, nativePageSource: true } }, null, 2));
  write(join(out, "workflow", "quality-consistency-contract.json"), JSON.stringify({ schemaVersion: 1, requiredChecks: ["1920x1080", "30fps", "H.264", "AAC audio", "no black segment", "critical labels in canvas", "68 caption styles shown", "Personal IP native clip", "horizontal and vertical whiteboard clips"] }, null, 2));
  write(join(out, "workflow", "sync-timecode-plan.json"), JSON.stringify({ schemaVersion: 1, fps: FPS, durationSeconds: DURATION, cues }, null, 2));
  write(join(out, "workflow", "voice-subtitle-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    backend: "melotts_local",
    language: "ZH",
    device: "cpu",
    synthesisSpeed: 0.95,
    playbackSpeed: 1,
    pronunciationControlled: pronunciationVerification?.status === "passed",
    pronunciationNarrationHash: pronunciationPreflight?.narrationHash || null,
    pronunciationPlanHash: effectivePronunciation?.effectivePronunciationHash || null,
    pronunciationLoaderActive: pronunciationVerification?.pronunciationLoaderActive === true,
    loadedPronunciationEntries: Number(pronunciationVerification?.loadedPronunciationEntries || 0),
    loadedPronunciationHash: pronunciationVerification?.loadedPronunciationHash || null,
    normalization: "measured per-segment gain before concat; restrained compression, loudnorm and limiting at final mux",
    displayMode: "single-line-sequential",
    safeArea: "bottom-caption-band",
    cues,
  }, null, 2));
  write(join(out, "script", "narration.txt"), cues.map((cue) => cue.text).join("\n"));
  write(join(out, "script", "subtitles.srt"), cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}`).join("\n\n") + "\n");
  write(join(ROOT, "media/oral-materials/workflow-film-narration-segments.json"), JSON.stringify(narrationSegments, null, 2) + "\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const directory of ["assets", "frames", "screenshots", "workflow", "logs", "script"]) ensure(join(options.out, directory));
  const catalog = JSON.parse(readFileSync(join(ROOT, "assets/caption-style-catalog.json"), "utf8"));
  if (catalog.styles?.length !== 68 || Object.keys(catalog.groups || {}).length !== 8) throw new Error("Caption catalog must contain 68 styles in 8 groups");
  const families = captionFamilies(catalog);
  for (const [name, assetPath] of Object.entries(IMAGE_ASSETS)) {
    const source = join(ROOT, assetPath);
    if (!existsSync(source)) throw new Error(`Missing showcase image: ${assetPath}`);
    const extension = source.endsWith(".jpg") ? ".jpg" : ".png";
    const target = `${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}${extension}`;
    copyFileSync(source, join(options.out, "assets", target));
  }
  for (const assetPath of Object.values(VIDEO_ASSETS)) if (!existsSync(join(ROOT, assetPath))) throw new Error(`Missing showcase video: ${assetPath}`);

  const htmlPath = join(options.out, "codex-video-workflow.html");
  write(htmlPath, makeHtml(catalog));
  writeContracts(options.out, catalog, families);

  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch(chromiumLaunchOptions(playwright.chromium));
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  await renderPreview(page, options.out);
  if (options.previewOnly) {
    await browser.close();
    console.log(JSON.stringify({ out: options.out, html: htmlPath, durationSeconds: DURATION, previewOnly: true }, null, 2));
    return;
  }

  for (let frame = 0; frame < Math.ceil(DURATION * FPS); frame += 1) {
    await page.evaluate((time) => window.renderAt(time), frame / FPS);
    await page.screenshot({ path: join(options.out, "frames", `frame-${String(frame).padStart(5, "0")}.png`) });
  }
  await browser.close();

  const htmlVideo = join(options.out, "codex-video-workflow-html.mp4");
  run("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS), "-i", join(options.out, "frames", "frame-%05d.png"), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", htmlVideo]);

  const personal = SCENES.find((scene) => scene.id === "personal");
  const whiteboard = SCENES.find((scene) => scene.id === "whiteboard");
  const silentVideo = join(options.out, "codex-video-workflow-silent.mp4");
  const filter = [
    `[1:v]trim=duration=${personal.duration},setpts=PTS-STARTPTS+${personal.start}/TB,scale=1440:810[ip]`,
    `[0:v][ip]overlay=240:130:eof_action=pass:shortest=0[v1]`,
    `[2:v]trim=duration=${whiteboard.duration},setpts=PTS-STARTPTS+${whiteboard.start}/TB,scale=1180:664[wh]`,
    `[v1][wh]overlay=91:230:eof_action=pass:shortest=0[v2]`,
    `[3:v]trim=duration=${whiteboard.duration},setpts=PTS-STARTPTS+${whiteboard.start}/TB,scale=360:640[wv]`,
    `[v2][wv]overlay=1486:246:eof_action=pass:shortest=0[v]`,
  ].join(";");
  run("ffmpeg", ["-y", "-v", "error", "-i", htmlVideo, "-i", join(ROOT, VIDEO_ASSETS.personal), "-i", join(ROOT, VIDEO_ASSETS.whiteboardHorizontal), "-i", join(ROOT, VIDEO_ASSETS.whiteboardVertical), "-filter_complex", filter, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silentVideo]);

  let finalVideo = silentVideo;
  if (options.providedAudio) {
    if (!existsSync(options.providedAudio)) throw new Error(`Provided audio not found: ${options.providedAudio}`);
    const packagedAudio = join(options.out, "assets", "narration.wav");
    if (resolve(options.providedAudio) !== resolve(packagedAudio)) copyFileSync(options.providedAudio, packagedAudio);
    finalVideo = join(options.out, "codex-video-workflow.mp4");
    const finalAudioFilter = `aresample=48000,acompressor=threshold=0.125:ratio=1.5:attack=20:release=180,loudnorm=I=-19:TP=-2:LRA=5,alimiter=limit=0.891:attack=5:release=50,apad=pad_dur=${DURATION}`;
    run("ffmpeg", ["-y", "-v", "error", "-i", silentVideo, "-i", options.providedAudio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-af", finalAudioFilter, "-t", String(DURATION), "-movflags", "+faststart", finalVideo]);
    write(join(options.out, "workflow", "final-audio-filter-chain.json"), JSON.stringify({ schemaVersion: 1, filterChain: finalAudioFilter, purpose: ["restrained compression", "program loudness normalization", "true-peak limiting", "48 kHz stereo delivery"] }, null, 2));
  }

  run("ffmpeg", ["-y", "-v", "error", "-ss", "1.4", "-i", finalVideo, "-frames:v", "1", "-q:v", "2", join(options.out, "poster.jpg")]);
  for (const [name, sceneId, offset] of [["personal", "personal", 3.2], ["whiteboard", "whiteboard", 4.5]]) {
    const scene = SCENES.find((item) => item.id === sceneId);
    run("ffmpeg", ["-y", "-v", "error", "-ss", String(scene.start + offset), "-i", finalVideo, "-frames:v", "1", join(options.out, "screenshots", `${name}.png`)]);
  }
  const contactTimes = [
    2.5,
    SCENES.find((scene) => scene.id === "motion").start + 5.4,
    SCENES.find((scene) => scene.id === "config").start + 3.7,
    SCENES.find((scene) => scene.id === "personal").start + 3.2,
    SCENES.find((scene) => scene.id === "whiteboard").start + 4.5,
    SCENES.find((scene) => scene.id === "covers").start + 4.3,
    SCENES.find((scene) => scene.id === "captions").start + 5.2,
    SCENES.find((scene) => scene.id === "captions").start + 9.7,
    SCENES.find((scene) => scene.id === "captions").start + 14.2,
  ];
  const contactInputs = contactTimes.flatMap((time) => ["-ss", String(time), "-i", finalVideo]);
  const contactScale = contactTimes.map((_, index) => `[${index}:v]scale=640:360[v${index}]`).join(";");
  const contactLabels = contactTimes.map((_, index) => `[v${index}]`).join("");
  run("ffmpeg", ["-y", "-v", "error", ...contactInputs, "-filter_complex", `${contactScale};${contactLabels}xstack=inputs=9:layout=0_0|640_0|1280_0|0_360|640_360|1280_360|0_720|640_720|1280_720`, "-frames:v", "1", join(options.out, "final-contact-sheet.png")]);

  const black = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-vf", "blackdetect=d=0.2:pix_th=0.05", "-an", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
  write(join(options.out, "logs", "blackdetect.log"), black);
  let volume = "";
  if (options.providedAudio) {
    volume = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-af", "volumedetect", "-vn", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
    write(join(options.out, "logs", "volumedetect.log"), volume);
  }
  const meanVolume = Number(volume.match(/mean_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
  const maxVolume = Number(volume.match(/max_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
  let loudnessDynamics = null;
  if (options.providedAudio) {
    const loudnessOutput = run("ffmpeg", ["-hide_banner", "-nostats", "-i", finalVideo, "-af", "loudnorm=I=-19:TP=-2:LRA=5:print_format=json", "-vn", "-f", "null", "-"]);
    const blocks = loudnessOutput.match(/\{\s*"input_i"[\s\S]*?\}/g) || [];
    const measured = JSON.parse(blocks.at(-1));
    loudnessDynamics = {
      schemaVersion: 1,
      measurementFilter: "loudnorm=I=-19:TP=-2:LRA=5:print_format=json",
      integratedLoudnessLufs: Number(measured.input_i),
      loudnessRangeLu: Number(measured.input_lra),
      truePeakDbtp: Number(measured.input_tp),
      maximumAllowedLoudnessRangeLu: 5.5,
      passed: Number(measured.input_lra) <= 5.5,
    };
    write(join(options.out, "workflow", "loudness-dynamics-audit.json"), JSON.stringify(loudnessDynamics, null, 2));
  }
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,channel_layout", "-of", "json", finalVideo]));
  write(join(options.out, "logs", "ffprobe.json"), JSON.stringify(probe, null, 2));
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");
  const finalFileSizeBytes = statSync(finalVideo).size;
  const segmentLoudnessAuditPath = join(options.out, "workflow", "speech-segment-loudness.json");
  const segmentLoudnessAudit = options.providedAudio && existsSync(segmentLoudnessAuditPath) ? JSON.parse(readFileSync(segmentLoudnessAuditPath, "utf8")) : null;
  const pronunciationPreflightPath = join(options.out, "workflow", "chinese-pronunciation-preflight.json");
  const effectivePronunciationPath = join(options.out, "workflow", "effective-pronunciation-plan.json");
  const pronunciationVerificationPath = join(options.out, "workflow", "pronunciation-application-verification.json");
  const voiceManifestPath = join(options.out, "workflow", "voice-subtitle-manifest.json");
  const pronunciationPreflight = options.providedAudio && existsSync(pronunciationPreflightPath) ? JSON.parse(readFileSync(pronunciationPreflightPath, "utf8")) : null;
  const effectivePronunciation = options.providedAudio && existsSync(effectivePronunciationPath) ? JSON.parse(readFileSync(effectivePronunciationPath, "utf8")) : null;
  const pronunciationVerification = options.providedAudio && existsSync(pronunciationVerificationPath) ? JSON.parse(readFileSync(pronunciationVerificationPath, "utf8")) : null;
  const voiceManifest = options.providedAudio && existsSync(voiceManifestPath) ? JSON.parse(readFileSync(voiceManifestPath, "utf8")) : null;
  let finalSegmentLoudness = null;
  if (options.providedAudio) {
    const segments = captionCues().map((cue, index) => {
      const output = run("ffmpeg", ["-hide_banner", "-nostats", "-ss", String(cue.start), "-t", String(cue.end - cue.start), "-i", finalVideo, "-vn", "-af", "volumedetect", "-f", "null", "-"]);
      return {
        index,
        scene: cue.scene,
        startSeconds: Number(cue.start.toFixed(3)),
        durationSeconds: Number((cue.end - cue.start).toFixed(3)),
        meanVolumeDb: Number(output.match(/mean_volume:\s*([\-\d.]+)\s*dB/)?.[1]),
        maxVolumeDb: Number(output.match(/max_volume:\s*([\-\d.]+)\s*dB/)?.[1]),
      };
    });
    const means = segments.map((segment) => segment.meanVolumeDb);
    const meanVolumeSpreadDb = Number((Math.max(...means) - Math.min(...means)).toFixed(2));
    finalSegmentLoudness = { schemaVersion: 1, source: "final MP4 AAC stream", maximumAllowedMeanVolumeSpreadDb: 2.5, meanVolumeSpreadDb, passed: meanVolumeSpreadDb <= 2.5, segments };
    write(join(options.out, "workflow", "final-segment-loudness.json"), JSON.stringify(finalSegmentLoudness, null, 2));
  }
  const checks = {
    duration: Math.abs(Number(probe.format?.duration) - DURATION) <= 0.18,
    resolution: videoStream?.width === WIDTH && videoStream?.height === HEIGHT,
    frameRate: videoStream?.r_frame_rate === "30/1",
    videoCodec: videoStream?.codec_name === "h264",
    audioStream: options.providedAudio ? Boolean(audioStream) : true,
    audioDeliveryFormat: options.providedAudio ? audioStream?.sample_rate === "48000" && audioStream?.channels === 2 : true,
    naturalPlaybackSpeed: options.providedAudio ? segmentLoudnessAudit?.segments?.every((entry) => entry.playbackSpeed === 1) === true : true,
    segmentLoudnessConsistency: options.providedAudio ? segmentLoudnessAudit?.passed === true && segmentLoudnessAudit.postNormalizationSpreadDb <= 2.5 : true,
    finalSegmentLoudnessConsistency: options.providedAudio ? finalSegmentLoudness?.passed === true : true,
    controlledLoudnessRange: options.providedAudio ? loudnessDynamics?.passed === true : true,
    pronunciationArtifactsPresent: options.providedAudio ? Boolean(pronunciationPreflight && effectivePronunciation && pronunciationVerification) : true,
    pronunciationStrictPreflightPassed: options.providedAudio ? pronunciationPreflight?.ok === true && Number(pronunciationPreflight?.counts?.unresolved || 0) === 0 && effectivePronunciation?.narrationHash === pronunciationPreflight?.narrationHash : true,
    pronunciationApplicationVerified: options.providedAudio ? pronunciationVerification?.status === "passed" && pronunciationVerification?.pronunciationLoaderActive === true && Number(pronunciationVerification?.loadedPronunciationEntries || 0) > 0 && pronunciationVerification?.loadedPronunciationHash === pronunciationVerification?.pronunciationPlanHash && pronunciationVerification?.pronunciationPlanHash === effectivePronunciation?.effectivePronunciationHash && pronunciationVerification?.narrationHash === pronunciationPreflight?.narrationHash && pronunciationVerification?.segmentBoundaryAuditPassed === true : true,
    voiceManifestPronunciationBound: options.providedAudio ? voiceManifest?.pronunciationControlled === true && voiceManifest?.pronunciationNarrationHash === pronunciationPreflight?.narrationHash && voiceManifest?.pronunciationPlanHash === effectivePronunciation?.effectivePronunciationHash && voiceManifest?.loadedPronunciationHash === effectivePronunciation?.effectivePronunciationHash : true,
    cdnCompatibleFileSize: finalFileSizeBytes <= 20_000_000,
    noDetectedBlackSegments: !black.includes("black_start:"),
    audibleMeanLevel: options.providedAudio ? meanVolume >= -35 && meanVolume <= -6 : true,
    unclippedPeak: options.providedAudio ? maxVolume <= 0 && maxVolume >= -12 : true,
    captionCoverage: catalog.styles.length === 68 && families.reduce((sum, family) => sum + family.styles.length, 0) === 68,
    personalIpNativeClip: existsSync(join(ROOT, VIDEO_ASSETS.personal)),
    whiteboardHorizontalClip: existsSync(join(ROOT, VIDEO_ASSETS.whiteboardHorizontal)),
    whiteboardVerticalClip: existsSync(join(ROOT, VIDEO_ASSETS.whiteboardVertical)),
    contactSheetPresent: existsSync(join(options.out, "final-contact-sheet.png")),
  };
  const passed = Object.values(checks).every(Boolean);
  write(join(options.out, "logs", "qc.json"), JSON.stringify({ schemaVersion: 1, finalVideo: relative(options.out, finalVideo).split("\\").join("/"), durationSeconds: DURATION, finalFileSizeBytes, cdnFileSizeLimitBytes: 20_000_000, audioBearing: Boolean(options.providedAudio), audioMetrics: options.providedAudio ? { meanVolumeDb: meanVolume, maxVolumeDb: maxVolume } : null, checks, passed }, null, 2));
  write(join(options.out, "delivery-manifest.json"), JSON.stringify({ schemaVersion: 1, status: passed ? "qc-passed-demo" : "failed", video: relative(options.out, finalVideo).split("\\").join("/"), durationSeconds: DURATION, canvas: { width: WIDTH, height: HEIGHT, fps: FPS }, poster: "poster.jpg", contactSheet: "final-contact-sheet.png", evidence: ["logs/qc.json", "logs/ffprobe.json", "logs/layout-audit.json", "workflow/chinese-pronunciation-preflight.json", "workflow/effective-pronunciation-plan.json", "workflow/pronunciation-application-verification.json", "workflow/audio-repair-plan.json", "workflow/speech-segment-loudness.json", "workflow/final-segment-loudness.json", "workflow/loudness-dynamics-audit.json", "workflow/visual-asset-manifest.json", "workflow/caption-style-plan.json", "workflow/whiteboard-layered-reveal-plan.json", "workflow/sync-timecode-plan.json"], note: "Public capability reel with project-owned assets and local narration." }, null, 2));
  if (!passed) throw new Error(`Workflow film QC failed: ${Object.entries(checks).filter(([, value]) => !value).map(([name]) => name).join(", ")}`);
  if (!options.keepFrames) rmSync(join(options.out, "frames"), { recursive: true, force: true });
  console.log(JSON.stringify({ out: options.out, finalVideo, durationSeconds: DURATION, passed }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
