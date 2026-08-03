#!/usr/bin/env node

/**
 * Render the public workflow film as concrete semantic examples.
 *
 * Every scene uses project-owned images, readable example data, named motion
 * verbs, and an explicit conclusion. The caption catalog is presented as one
 * navigable plane rather than a versioned template inventory.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumLaunchOptions, loadPlaywright } from "./lib/load-playwright.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

const SCENES = [
  { id: "opening", duration: 5.0, caption: "动效的价值，不是让画面更忙，而是让信息变得更清楚。" },
  { id: "process", duration: 5.0, caption: "输入、拆页、选模板、生成素材、逐页质检，再合成成片。" },
  { id: "data", duration: 5.0, caption: "数据先交代口径，再让曲线解释趋势和拐点。" },
  { id: "proof", duration: 5.0, caption: "真实图片进入证据板，连线只在因果关系出现时绘制。" },
  { id: "product", duration: 5.0, caption: "配置平台把输入、处理中和输出放在同一条路径里。" },
  { id: "compare", duration: 5.0, caption: "设计升级必须看得见结构差异，而不是只换一组颜色。" },
  { id: "matrix", duration: 5.0, caption: "模板按语义匹配和素材可得性选择，不靠随机抽取。" },
  { id: "lanes", duration: 5.0, caption: "多个角色并行工作，交接点和最终产物都清晰可见。" },
  { id: "covers", duration: 5.0, caption: "封面先比较承诺和构图，再选择横版、竖版或方形。" },
  { id: "personal", duration: 5.0, caption: "个人 IP 使用两张原生页面，保持人物与视觉语言一致。" },
  { id: "whiteboard", duration: 4.5, caption: "白板只描绘关键路径，圈出节点，再用颜色回填结论。" },
  { id: "captions", duration: 12.0, captions: [
    { until: 0.45, text: "同一句话可以按八种语义任务，路由到六十八种字幕样式。" },
    { until: 0.78, text: "所有样式都在同一张大画布上，镜头只聚焦当前分组。" },
    { until: 1, text: "当前组被放大，其余样式自动降噪。" },
  ] },
  { id: "closing", duration: 5.0, caption: "从内容到动效、字幕、图片和质检，这就是完整框架。" },
];

let cursor = 0;
for (const scene of SCENES) {
  scene.start = cursor;
  scene.end = cursor + scene.duration;
  cursor = scene.end;
}
const DURATION = cursor;

const IMAGE_ASSETS = {
  relationship: "media/showcase/visual-series/relationship-map.png",
  strategy: "media/showcase/visual-series/strategy-guide.png",
  interface: "media/showcase/visual-series/interface-plate.png",
  config: "media/showcase/core-demo/config-base-zh.png",
  coverHorizontal: "media/showcase/covers/story-spine-horizontal-16x9.jpg",
  coverVertical: "media/showcase/covers/story-spine-vertical-9x16.jpg",
  coverSquare: "media/showcase/covers/story-spine-square-1x1.jpg",
  ipOpening: "media/showcase/personal-ip/story-spine-opening.png",
  ipMiddle: "media/showcase/personal-ip/story-spine-middle.png",
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
      console.log(`Usage: node scripts/render-workflow-film.mjs [options]\n\n` +
        `  --out <dir>             Output directory\n` +
        `  --provided-audio <wav>  Optional narration mix\n` +
        `  --preview-only          Render audit screenshots, not the full MP4\n` +
        `  --keep-frames           Preserve frame sequence\n`);
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

function captionDistricts(catalog) {
  const order = ["glass", "editorial", "kinetic", "ui", "bilingual", "audio", "minimal", "mobile"];
  const labels = {
    glass: ["GLASS", "轻信息层"],
    editorial: ["EDITORIAL", "观点与证据"],
    kinetic: ["KINETIC", "钩子与强调"],
    ui: ["UI", "操作与状态"],
    bilingual: ["BILINGUAL", "双语解释"],
    audio: ["AUDIO", "声音同步"],
    minimal: ["MINIMAL", "低干扰讲解"],
    mobile: ["MOBILE", "竖屏安全区"],
  };
  return order.map((id, index) => ({
    id,
    index,
    label: labels[id][0],
    job: labels[id][1],
    styles: catalog.styles.filter((style) => style.group === id),
  }));
}

function makeHtml(captions) {
  const districts = captionDistricts(captions);
  const payload = JSON.stringify({ scenes: SCENES, districts }).replace(/</g, "\\u003c");
  const districtsHtml = districts.map((district) => `
    <section class="caption-district district-${district.id}" data-caption-district="${district.id}">
      <header><span>${district.label}</span><b>${district.styles.length}</b><em>${district.job}</em></header>
      <div class="style-cloud">${district.styles.map((style, styleIndex) =>
        `<span class="style-token token-${styleIndex % 7}" data-style-id="${esc(style.id)}">${esc(style.labelZh || style.name || style.id)}</span>`).join("")}</div>
      <div class="district-sample sample-${district.id}"><small>同一句话 · 当前任务</small><strong>让信息一眼被读懂</strong></div>
    </section>`).join("");

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--paper:#f5f0e6;--ink:#15191f;--muted:#66717c;--coral:#c6563c;--copper:#c9973e;--teal:#2d6f78;--navy:#0c1320;--cyan:#58d3d8;--p:0}
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--ink);font-family:Inter,"PingFang SC","Hiragino Sans GB",system-ui,sans-serif;color:var(--ink)}
  #stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:var(--paper)}
  #grain{position:absolute;inset:0;z-index:90;pointer-events:none;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.2'/%3E%3C/svg%3E")}
  .scene{position:absolute;inset:0;opacity:0;pointer-events:none;overflow:hidden;background:var(--paper)}.scene.active{opacity:1}
  .paper-grid{position:absolute;inset:0;opacity:.14;background-image:linear-gradient(#48616c25 1px,transparent 1px),linear-gradient(90deg,#48616c25 1px,transparent 1px);background-size:48px 48px}
  .scene-kicker{position:absolute;left:74px;top:58px;font-size:17px;letter-spacing:.14em;font-weight:800;color:var(--coral)}
  .scene-title{position:absolute;left:74px;top:88px;max-width:940px;font-size:53px;line-height:1.05;letter-spacing:-.045em;font-weight:900}
  .meaning{position:absolute;right:68px;top:58px;width:560px;padding:16px 20px;border-left:5px solid var(--coral);background:#fff9;box-shadow:0 18px 40px #303c4620}
  .meaning b{display:block;font-size:14px;letter-spacing:.12em;color:var(--coral);margin-bottom:6px}.meaning span{font-size:22px;font-weight:740;line-height:1.25}
  .verb{position:absolute;right:70px;top:184px;display:flex;gap:8px}.verb span{padding:7px 12px;border-radius:999px;background:#17222c;color:#fff;font-size:14px;letter-spacing:.07em}
  .narration{position:absolute;z-index:100;left:50%;bottom:34px;transform:translateX(-50%);max-width:1620px;min-width:860px;padding:16px 34px;border-radius:16px;background:#101820ec;color:#fff;text-align:center;font-size:29px;line-height:1.2;font-weight:760;white-space:nowrap;box-shadow:0 14px 40px #0004;border:1px solid #ffffff2c}
  .provenance{position:absolute;left:74px;bottom:108px;font:600 13px/1.2 ui-monospace,SFMono-Regular;color:#68727b;letter-spacing:.03em}
  .rule{height:4px;background:var(--coral);border-radius:4px;transform-origin:left center;transform:scaleX(var(--p))}

  /* Opening */
  #opening{background:#f7f2e9}#opening .opener-word{position:absolute;left:88px;top:220px;font-size:132px;line-height:.82;letter-spacing:-.08em;font-weight:950;text-transform:uppercase}
  #opening .opener-word span{display:block;transform:translateY(calc((1 - var(--p))*80px));opacity:calc(.18 + var(--p))}#opening .opener-word .accent{color:var(--coral);margin-left:280px}
  #opening .opener-sub{position:absolute;left:94px;top:610px;width:980px;font-size:34px;line-height:1.35}#opening .semantic-stack{position:absolute;right:110px;top:220px;width:520px;display:grid;gap:16px}
  #opening .semantic-stack div{padding:22px 26px;background:#fff;border:1px solid #d8d1c5;border-radius:18px;font-size:23px;font-weight:750;transform:translateX(calc((1 - var(--p))*120px));box-shadow:0 18px 35px #2f373d18}
  #opening .semantic-stack div:nth-child(2){margin-left:60px;border-color:#d3a34a}#opening .semantic-stack div:nth-child(3){margin-left:120px;border-color:#4f8588}

  /* Process */
  .process-track{position:absolute;left:106px;right:108px;top:410px;height:250px}.process-track .rail{position:absolute;left:50px;right:50px;top:110px;height:8px;border-radius:8px;background:#d2cdc4;overflow:hidden}.process-track .rail i{display:block;width:100%;height:100%;background:linear-gradient(90deg,var(--coral),var(--copper),var(--teal));transform-origin:left;transform:scaleX(var(--p))}
  .process-node{position:absolute;top:55px;width:178px;margin-left:-89px;text-align:center}.process-node .dot{width:62px;height:62px;margin:auto;border-radius:50%;display:grid;place-items:center;background:#fff;border:7px solid #c8c2b8;font-weight:950;font-size:20px;transition:none}.process-node b{display:block;margin-top:14px;font-size:19px}.process-node small{display:block;margin-top:4px;color:#68717a}.process-node.done .dot{background:var(--ink);border-color:var(--copper);color:#fff;box-shadow:0 0 0 12px #c9973e24}
  .process-result{position:absolute;right:100px;top:705px;width:520px;padding:22px 26px;background:#17222c;color:#fff;border-radius:20px;transform:translateY(calc((1 - var(--p))*38px));opacity:var(--p)}.process-result b{font-size:25px}.process-result span{display:block;color:#d7e5e5;margin-top:6px}

  /* Data */
  .chart{position:absolute;left:120px;top:330px;width:1160px;height:500px;border-left:4px solid #26333d;border-bottom:4px solid #26333d}.chart .gridline{position:absolute;left:0;right:0;height:1px;background:#41536026}.chart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.chart .curve{fill:none;stroke:#2d6f78;stroke-width:14;stroke-linecap:round;stroke-dasharray:1500;stroke-dashoffset:calc(1500 * (1 - var(--p)))}
  .chart .area{fill:url(#chart-fill);opacity:calc(var(--p)*.45)}.chart-label{position:absolute;transform:translate(-50%,16px);font:700 16px ui-monospace}.chart-point{position:absolute;width:22px;height:22px;border-radius:50%;background:var(--coral);transform:translate(-50%,-50%) scale(calc(.3 + var(--p)*.7));box-shadow:0 0 0 10px #c6563c24}.chart-callout{position:absolute;left:760px;top:42px;width:310px;padding:18px;background:#fff;border:1px solid #d8d1c6;border-radius:16px;box-shadow:0 18px 40px #1c29331c;opacity:var(--p)}.chart-callout b{font-size:23px}.chart-callout span{display:block;margin-top:4px;color:#5e6973}
  .data-footnote{position:absolute;right:70px;top:340px;width:440px;padding:24px;background:#17222c;color:#fff;border-radius:20px}.data-footnote b{display:block;color:#f0c665;margin-bottom:10px}.data-footnote code{font-size:18px;line-height:1.7;color:#cce3e4}

  /* Proof board */
  #proof .asset-frame{position:absolute;left:90px;top:270px;width:1120px;height:620px;padding:18px;background:#fff;border:1px solid #d6d0c5;border-radius:24px;box-shadow:0 24px 48px #25313a25;overflow:hidden}#proof .asset-frame img{width:100%;height:100%;object-fit:cover;border-radius:15px;transform:scale(calc(1.07 - var(--p)*.07))}
  #proof .proof-overlay{position:absolute;inset:0;pointer-events:none}#proof .proof-overlay path{fill:none;stroke:var(--coral);stroke-width:8;stroke-linecap:round;stroke-dasharray:520;stroke-dashoffset:calc(520*(1 - var(--p)))}
  .proof-note{position:absolute;right:72px;top:330px;width:520px;display:grid;gap:16px}.proof-note article{padding:18px 20px;background:#fff;border-radius:16px;border:1px solid #d4cec3;box-shadow:0 12px 30px #25313a18;transform:translateX(calc((1 - var(--p))*80px))}.proof-note b{display:block;font-size:20px}.proof-note span{color:#5f6a74}.proof-conclusion{border-left:7px solid var(--coral)!important;background:#fff7f0!important}

  /* Product */
  #product{background:#0d1522;color:#eef8f8}#product .scene-title{color:#fff}#product .scene-kicker{color:#65dce0}#product .meaning{background:#18283ee8;color:#fff;border-color:#65dce0}.product-shell{position:absolute;left:84px;top:250px;width:1230px;height:650px;padding:15px;border:1px solid #ffffff22;border-radius:25px;background:#111d2e;box-shadow:0 28px 70px #0008;overflow:hidden}.product-shell img{width:100%;height:100%;object-fit:cover;border-radius:15px;opacity:.82;filter:saturate(.85) brightness(.75)}
  .product-state{position:absolute;right:76px;top:310px;width:460px;display:grid;gap:15px}.product-state article{padding:18px 20px;border-radius:15px;background:#142238;border:1px solid #344b65;color:#b7c8d9;transform:translateX(calc((1 - var(--p))*90px))}.product-state article.active{color:#fff;border-color:#58d3d8;box-shadow:0 0 0 5px #58d3d81c}.product-state b{display:flex;justify-content:space-between;font-size:21px}.product-state small{display:block;margin-top:5px;color:#8ba2b7}.scan-window{position:absolute;left:100px;top:355px;width:1090px;height:180px;border:4px solid #58d3d8;border-radius:14px;box-shadow:0 0 0 999px #08101b8c;transform:translateY(calc(var(--p)*215px))}

  /* Compare */
  .compare-wall{position:absolute;left:80px;right:80px;top:250px;bottom:150px;display:grid;grid-template-columns:1fr 1fr;gap:34px}.compare-panel{position:relative;padding:16px;border-radius:25px;background:#fff;border:1px solid #d6d0c4;overflow:hidden;box-shadow:0 24px 50px #24303a1e}.compare-panel img{width:100%;height:100%;object-fit:cover;border-radius:15px}.compare-panel.before img{filter:grayscale(1) contrast(.78) brightness(.9)}.compare-panel .panel-label{position:absolute;left:34px;top:34px;padding:9px 14px;border-radius:999px;background:#17222ce8;color:#fff;font-weight:800;letter-spacing:.06em}.compare-panel.after{border:5px solid #2d6f78}.compare-panel.after .panel-label{background:#2d6f78}.delta-list{position:absolute;right:30px;bottom:28px;width:360px;display:grid;gap:8px}.delta-list span{padding:10px 14px;background:#fffef2e8;border-left:5px solid var(--coral);font-weight:750;transform:translateX(calc((1 - var(--p))*70px))}.qc-stamp{position:absolute;right:60px;top:70px;border:8px double var(--coral);padding:12px 20px;color:var(--coral);font-weight:950;font-size:30px;transform:rotate(-8deg) scale(var(--p));background:#fff9}

  /* Matrix */
  .matrix-board{position:absolute;left:150px;top:270px;width:1120px;height:600px;border-left:5px solid var(--ink);border-bottom:5px solid var(--ink);background:linear-gradient(90deg,transparent 49.8%,#24303a1c 50%,transparent 50.2%),linear-gradient(transparent 49.8%,#24303a1c 50%,transparent 50.2%)}.matrix-board:after{content:"高匹配 · 高可实现";position:absolute;right:26px;top:24px;padding:10px 16px;border-radius:999px;background:#2d6f78;color:#fff;font-weight:850}.axis-x{position:absolute;right:0;bottom:-44px;font-weight:850}.axis-y{position:absolute;left:-98px;top:245px;transform:rotate(-90deg);font-weight:850}.matrix-point{position:absolute;width:150px;padding:12px 14px;border-radius:16px;background:#fff;border:2px solid #79858d;box-shadow:0 12px 24px #26323c1a;font-size:16px;font-weight:780;transform:translate(-50%,-50%) scale(calc(.65 + var(--p)*.35))}.matrix-point.target{background:#17222c;color:#fff;border-color:#c9973e;box-shadow:0 0 0 12px #c9973e2e}.matrix-reason{position:absolute;right:80px;top:350px;width:470px;padding:24px;border-radius:20px;background:#fff;border:1px solid #d5cfc4;box-shadow:0 20px 44px #26333d21}.matrix-reason b{display:block;font-size:24px}.matrix-reason span{display:block;margin-top:9px;color:#5c6871;font-size:18px}.matrix-reason .rule{margin-top:15px}

  /* Lanes */
  .lane-board{position:absolute;left:85px;right:85px;top:265px;bottom:160px;padding:28px 30px;background:#fff;border:1px solid #d4cec2;border-radius:24px;box-shadow:0 24px 48px #25313a1f}.lane{height:116px;border-bottom:1px solid #d8d2c8;position:relative}.lane:last-child{border-bottom:0}.lane-name{position:absolute;left:0;top:42px;width:210px;font-weight:900;font-size:18px;color:#28343d}.lane-track{position:absolute;left:225px;right:170px;top:57px;height:3px;background:#cfc9be}.lane-card{position:absolute;top:25px;width:190px;padding:12px 14px;border-radius:13px;background:#17222c;color:#fff;font-weight:760;box-shadow:0 10px 24px #17222c32;transform:translateX(calc(var(--p)*650px))}.lane:nth-child(2) .lane-card{background:#2d6f78;transform:translateX(calc(var(--p)*500px))}.lane:nth-child(3) .lane-card{background:#a86a2e;transform:translateX(calc(var(--p)*360px))}.lane:nth-child(4) .lane-card{background:#963f33;transform:translateX(calc(var(--p)*760px))}.lane-merge{position:absolute;right:28px;top:202px;width:150px;height:150px;border-radius:50%;display:grid;place-items:center;text-align:center;background:#f4e6c7;border:8px solid #c9973e;font-size:20px;font-weight:950;transform:scale(calc(.4 + var(--p)*.6))}

  /* Covers */
  .cover-gallery{position:absolute;left:78px;right:78px;top:245px;bottom:150px;display:grid;grid-template-columns:1.5fr .82fr .88fr;align-items:center;gap:26px}.cover-card{position:relative;padding:12px;border-radius:22px;background:#fff;border:1px solid #d7d0c5;box-shadow:0 20px 46px #1d293222;overflow:hidden}.cover-card img{display:block;width:100%;height:100%;object-fit:cover;border-radius:13px}.cover-card.horizontal{height:520px;border:6px solid #c6563c;transform:scale(calc(.93 + var(--p)*.07))}.cover-card.vertical{height:610px}.cover-card.square{height:470px}.cover-card b{position:absolute;left:26px;bottom:25px;padding:8px 13px;border-radius:999px;background:#111b24e8;color:#fff}.selection-rationale{position:absolute;left:110px;bottom:126px;width:690px;padding:15px 20px;background:#fff;border-left:6px solid var(--coral);font-weight:800;box-shadow:0 12px 26px #26323b22;opacity:var(--p)}

  /* Personal */
  #personal{background:#eee3d1}.ip-spread{position:absolute;left:74px;right:74px;top:205px;bottom:145px;display:grid;grid-template-columns:1fr 1fr;gap:26px}.ip-page{position:relative;padding:14px;background:#fff8eb;border:1px solid #cfc3b3;border-radius:24px;box-shadow:0 24px 50px #503f2a2a;overflow:hidden}.ip-page img{width:100%;height:100%;object-fit:cover;border-radius:14px;transform:scale(calc(1.04 - var(--p)*.04))}.ip-page b{position:absolute;left:32px;top:32px;padding:9px 15px;border-radius:999px;background:#17222ce8;color:#fff}.ip-consistency{position:absolute;left:50%;bottom:132px;transform:translateX(-50%);padding:13px 22px;background:#fff;border:2px solid #c9973e;border-radius:999px;font-weight:850;box-shadow:0 12px 28px #40301e2b}

  /* Whiteboard */
  #whiteboard{background:#edf1ea}.whiteboard-base{position:absolute;left:135px;top:225px;width:1180px;height:650px;padding:14px;background:#fff;border-radius:24px;box-shadow:0 24px 50px #24303a24;overflow:hidden}.whiteboard-base img{width:100%;height:100%;object-fit:cover;border-radius:14px;filter:saturate(.85) brightness(.98)}.whiteboard-svg{position:absolute;left:135px;top:225px;width:1180px;height:650px;overflow:visible}.whiteboard-svg .draw{fill:none;stroke:#c6563c;stroke-width:10;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:850;stroke-dashoffset:calc(850*(1 - var(--p)))}.whiteboard-svg .circle{fill:none;stroke:#2d6f78;stroke-width:9;stroke-dasharray:420;stroke-dashoffset:calc(420*(1 - var(--p)))}.whiteboard-svg .fill{fill:#f2c861a8;opacity:var(--p)}.whiteboard-steps{position:absolute;right:74px;top:310px;width:430px;display:grid;gap:15px}.whiteboard-steps span{padding:16px 20px;border-radius:15px;background:#fff;border-left:6px solid #c6563c;font-size:20px;font-weight:800;transform:translateX(calc((1 - var(--p))*70px))}

  /* Caption museum */
  #captions{background:#0d1420;color:#eef7f7}.museum-title{position:absolute;left:60px;top:35px;z-index:12}.museum-title b{font-size:38px}.museum-title span{display:block;color:#8fa8b9;margin-top:4px}.museum-nav{position:absolute;right:55px;top:42px;z-index:12;display:flex;gap:7px}.museum-nav span{padding:7px 10px;border-radius:999px;background:#1d2a3b;color:#93a9b9;font-size:12px}.museum-nav span.active{background:#58d3d8;color:#0b1721;font-weight:900}.museum-viewport{position:absolute;left:0;top:0;width:1920px;height:970px;overflow:hidden}.museum-plane{position:absolute;left:0;top:0;width:3600px;height:1800px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:34px;padding:120px 80px 90px;transform-origin:0 0;transition:none}.caption-district{position:relative;padding:28px 30px;border-radius:28px;background:#152235;border:2px solid #273a51;overflow:hidden;box-shadow:0 30px 70px #0005}.caption-district header{display:grid;grid-template-columns:auto auto 1fr;align-items:baseline;gap:13px}.caption-district header span{font-size:28px;font-weight:950;letter-spacing:.08em}.caption-district header b{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#58d3d8;color:#07131c}.caption-district header em{font-style:normal;color:#8fa7b8;font-size:18px}.style-cloud{display:flex;flex-wrap:wrap;align-content:flex-start;gap:10px;margin-top:23px}.style-token{padding:8px 12px;border-radius:9px;background:#203249;color:#dcecf3;font-size:16px;border:1px solid #39516a}.token-1{border-radius:999px;background:#192d35;border-color:#3c7778}.token-2{background:#33243d;border-color:#81598d}.token-3{border-left:5px solid #fb6b72;border-radius:3px}.token-4{font-family:ui-monospace;background:#0e1927;color:#79dde0}.token-5{background:#e9eef1;color:#15202b}.token-6{border-style:dashed}.district-sample{position:absolute;left:30px;right:30px;bottom:28px;padding:19px 22px;border-radius:16px;background:#eef4f5;color:#121b24}.district-sample small{display:block;color:#51616d;margin-bottom:4px}.district-sample strong{font-size:28px}.sample-editorial{border-left:8px solid #fb6b72;border-radius:4px}.sample-kinetic{background:#fb6b72;color:#101822;transform:rotate(-1deg)}.sample-ui{font-family:ui-monospace;background:#091421;color:#72e1e5;border:1px solid #72e1e5}.sample-bilingual strong:after{content:" · Make meaning visible";font-size:18px;color:#48616f}.sample-audio:before{content:"▂▆▃▇▅";margin-right:14px;color:#58d3d8;letter-spacing:5px}.sample-minimal{background:transparent;color:#eef6f7;border-bottom:2px solid #eef6f7;border-radius:0}.sample-mobile{border-radius:999px;border:4px solid #15191f}.caption-district.focus{border-color:#58d3d8;box-shadow:0 0 0 8px #58d3d830,0 35px 80px #0007}.museum-legend{position:absolute;right:55px;bottom:115px;z-index:15;width:460px;padding:18px 20px;border-radius:17px;background:#eef7f7;color:#111c25;box-shadow:0 16px 40px #0006}.museum-legend b{display:block;font-size:18px}.museum-legend span{display:block;margin-top:6px;color:#50616d}.museum-count{position:absolute;left:60px;bottom:120px;z-index:15;font-size:46px;font-weight:950;color:#fff}.museum-count small{font-size:18px;color:#8fa7b8}

  /* Closing */
  #closing{background:#f4ede2}.closing-flow{position:absolute;left:110px;right:110px;top:330px;display:grid;grid-template-columns:repeat(6,1fr);gap:24px}.closing-flow article{position:relative;padding:30px 15px;text-align:center;background:#fff;border:1px solid #d4cdc1;border-radius:20px;font-size:24px;font-weight:900;box-shadow:0 18px 38px #25313a1c;transform:translateY(calc((1 - var(--p))*60px))}.closing-flow article:not(:last-child):after{content:"→";position:absolute;right:-31px;top:28px;color:#c6563c;font-size:34px}.closing-final{position:absolute;left:110px;top:160px;font-size:66px;line-height:1.08;font-weight:950;letter-spacing:-.05em}.closing-final span{color:#c6563c}
</style></head><body><main id="stage">
  <section class="scene" id="opening"><div class="paper-grid"></div><div class="opener-word"><span>不是样式列表</span><span class="accent">是语义镜头</span></div><div class="opener-sub">每个动作都绑定具体内容、对象变化与一个可解释的结论。</div><div class="semantic-stack"><div>CONTENT · 真实内容</div><div>MOTION · 对象变化</div><div>MEANING · 代表含义</div></div></section>

  <section class="scene" id="process"><div class="paper-grid"></div><div class="scene-kicker">EXAMPLE 01 · TRACE / ACCUMULATE / RESOLVE</div><h2 class="scene-title">六步生成一条可审片视频</h2><div class="meaning"><b>这代表</b><span>节点推进 = 阶段完成；每一步都有可验收产物。</span></div><div class="verb"><span>TRACE</span><span>STEP</span><span>RESOLVE</span></div><div class="process-track"><div class="rail"><i></i></div>${["输入","拆页","选模板","生成素材","逐页 QC","合成"].map((label,index)=>`<div class="process-node" data-process-node="${index}" style="left:${8+index*18.4}%"><div class="dot">${index+1}</div><b>${label}</b><small>${index<5?"结构化产物":"审片视频"}</small></div>`).join("")}</div><div class="process-result"><b>✓ DELIVERY PACKAGE READY</b><span>视频、字幕、封面、日志与来源记录一起交付</span></div><div class="provenance">PROJECT WORKFLOW · SEMANTIC TIMELINE</div></section>

  <section class="scene" id="data"><div class="paper-grid"></div><div class="scene-kicker">EXAMPLE 02 · TRACE / HIGHLIGHT / COMPARE</div><h2 class="scene-title">数据先交代口径，再让曲线说话</h2><div class="meaning"><b>这代表</b><span>曲线不是装饰：它必须显示趋势、量级、拐点与来源。</span></div><div class="verb"><span>TRACE</span><span>CALLOUT</span><span>HOLD</span></div><div class="chart"><div class="gridline" style="top:25%"></div><div class="gridline" style="top:50%"></div><div class="gridline" style="top:75%"></div><svg viewBox="0 0 1160 500"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#2d6f78"/><stop offset="1" stop-color="#2d6f78" stop-opacity="0"/></linearGradient></defs><path class="area" d="M40 420 C210 390 250 320 400 342 S650 228 770 250 S930 105 1100 88 L1100 500 L40 500Z"/><path class="curve" d="M40 420 C210 390 250 320 400 342 S650 228 770 250 S930 105 1100 88"/></svg><span class="chart-point" style="left:4%;top:84%"></span><span class="chart-point" style="left:35%;top:68%"></span><span class="chart-point" style="left:67%;top:50%"></span><span class="chart-point" style="left:95%;top:18%"></span><span class="chart-label" style="left:4%;top:90%">W1 · 4</span><span class="chart-label" style="left:35%;top:90%">W2 · 7</span><span class="chart-label" style="left:67%;top:90%">W3 · 11</span><span class="chart-label" style="left:95%;top:90%">W4 · 16</span><div class="chart-callout"><b>+45% · 关键拐点</b><span>放大原因，而不是只放大数字</span></div></div><div class="data-footnote"><b>DEMO DATA CONTRACT</b><code>metric: weekly_output<br>unit: review videos<br>period: W1–W4<br>source: replace with project source</code></div><div class="provenance">DEMO VALUES · SOURCE FIELD REQUIRED</div></section>

  <section class="scene" id="proof"><div class="scene-kicker">EXAMPLE 03 · CONNECT / INSPECT / PRESSURE</div><h2 class="scene-title">一杯咖啡，价值如何流向消费者？</h2><div class="meaning"><b>这代表</b><span>真实图片提供对象；连线让供应与反馈关系被看见。</span></div><div class="verb"><span>CONNECT</span><span>FOCUS</span><span>CONCLUDE</span></div><div class="asset-frame"><img src="assets/relationship.png" alt="咖啡价值链关系图"><svg class="proof-overlay" viewBox="0 0 1120 620"><path d="M180 455 C330 520 590 505 780 410 S980 270 1020 185"/><circle cx="1018" cy="184" r="46" fill="none" stroke="#c6563c" stroke-width="8"/></svg></div><div class="proof-note"><article><b>01 · 供应链</b><span>产地 → 处理站 → 烘焙商 → 咖啡店</span></article><article><b>02 · 消费体验</b><span>消费者反馈不是终点，而是下一轮输入</span></article><article class="proof-conclusion"><b>结论 · 连线让关系可见</b><span>只在因果成立时绘制连接</span></article></div><div class="provenance">PROJECT-OWNED ASSET · visual-series/relationship-map.png</div></section>

  <section class="scene" id="product"><div class="scene-kicker">EXAMPLE 04 · TAP / SWITCH / COMPLETE</div><h2 class="scene-title">把工作流召唤出来</h2><div class="meaning"><b>这代表</b><span>输入改变状态，经过处理，最终输出才构成能力。</span></div><div class="product-shell"><img src="assets/config.png" alt="中英文半自动配置平台"><div class="scan-window"></div></div><div class="product-state"><article data-product-state="0"><b><span>INPUT</span><span>01</span></b><small>画幅、类型、语言、素材</small></article><article data-product-state="1"><b><span>PROCESSING</span><span>02</span></b><small>模板、色系、字幕与封面路由</small></article><article data-product-state="2"><b><span>OUTPUT</span><span>03</span></b><small>逐页预览、配置合同与继续条件</small></article></div><div class="provenance" style="color:#8299ad">REAL GENERATED UI · bilingual semi-auto console</div></section>

  <section class="scene" id="compare"><div class="paper-grid"></div><div class="scene-kicker">EXAMPLE 05 · COMPARE / TRANSFORM / RESOLVE</div><h2 class="scene-title">设计升级，不是换颜色</h2><div class="meaning"><b>这代表</b><span>安全区、证据卡与信息层级的差异必须被看见。</span></div><div class="compare-wall"><article class="compare-panel before"><img src="assets/cover-horizontal.jpg" alt="旧态封面示意"><span class="panel-label">BEFORE · 信息被压平</span></article><article class="compare-panel after"><img src="assets/cover-horizontal.jpg" alt="结构升级后的封面"><span class="panel-label">AFTER · 结构被锁定</span><div class="delta-list"><span>✓ 标题进入安全区</span><span>✓ 证明对象独立成层</span><span>✓ 开场承诺与正文一致</span></div><div class="qc-stamp">QC PASS</div></article></div><div class="provenance">PROJECT COVER ASSET · deterministic comparison overlay</div></section>

  <section class="scene" id="matrix"><div class="paper-grid"></div><div class="scene-kicker">EXAMPLE 06 · CHOOSE / INSPECT / LOCK</div><h2 class="scene-title">让模板选择有坐标</h2><div class="meaning"><b>这代表</b><span>Planner 根据内容和素材条件选择风格，不是随机抽签。</span></div><div class="matrix-board"><span class="axis-x">语义匹配 →</span><span class="axis-y">素材可得性 →</span><span class="matrix-point" style="left:24%;top:78%">Typed opener</span><span class="matrix-point" style="left:42%;top:38%">Data curve</span><span class="matrix-point" style="left:68%;top:64%">Proof board</span><span class="matrix-point target" style="left:82%;top:24%">Semantic timeline</span><span class="matrix-point" style="left:60%;top:82%">Dark product UI</span><span class="matrix-point" style="left:31%;top:20%">Whiteboard</span></div><div class="matrix-reason"><b>锁定：Semantic Timeline</b><span>高语义匹配 · 素材齐全 · 信息密度可控 · 适合逐步解释</span><div class="rule"></div></div><div class="provenance">DETERMINISTIC ROUTING EXAMPLE · 6 EXECUTABLE CORES</div></section>

  <section class="scene" id="lanes"><div class="paper-grid"></div><div class="scene-kicker">EXAMPLE 07 · HANDOFF / PARALLELIZE / MERGE</div><h2 class="scene-title">职责互斥，产物合并</h2><div class="meaning"><b>这代表</b><span>协作流程必须看见负责人、交接点和最终验收结果。</span></div><div class="lane-board">${[["PLANNER","拆页与路由"],["TTS","真实语音 cue"],["TEMPLATE DIRECTOR","页面与动效"],["RENDERER + QC","合成与验证"]].map(([name,task])=>`<div class="lane"><span class="lane-name">${name}</span><div class="lane-track"></div><span class="lane-card">${task}</span></div>`).join("")}<div class="lane-merge">一页成品<br>+ QC</div></div><div class="provenance">AGENT-SIMULATION-LANE · OUTPUT BOUNDARIES VISIBLE</div></section>

  <section class="scene" id="covers"><div class="paper-grid"></div><div class="scene-kicker">EXAMPLE 08 · COMPARE / SELECT / MAGNIFY</div><h2 class="scene-title">候选样张要比较结构</h2><div class="meaning"><b>这代表</b><span>选风格先看内容承诺与构图，再看比例和色彩。</span></div><div class="cover-gallery"><article class="cover-card horizontal"><img src="assets/cover-horizontal.jpg" alt="16比9横版封面"><b>16:9 · SELECTED</b></article><article class="cover-card vertical"><img src="assets/cover-vertical.jpg" alt="9比16竖版封面"><b>9:16</b></article><article class="cover-card square"><img src="assets/cover-square.jpg" alt="1比1方形封面"><b>1:1</b></article></div><div class="selection-rationale">✓ 结构完整　✓ 信息密度合理　✓ 开场承诺匹配　✓ 平台安全区通过</div><div class="provenance">THREE NATIVE-RATIO PROJECT COVER EXAMPLES</div></section>

  <section class="scene" id="personal"><div class="scene-kicker">PERSONAL IP · TWO NATIVE PAGES</div><h2 class="scene-title">人物一致，页面逻辑继续推进</h2><div class="meaning"><b>这代表</b><span>不是一张人物图反复裁切，而是原生页面保持视觉 DNA。</span></div><div class="ip-spread"><article class="ip-page"><img src="assets/ip-opening.png" alt="Personal IP 第一页"><b>PAGE 01 · HOOK</b></article><article class="ip-page"><img src="assets/ip-middle.png" alt="Personal IP 第二页"><b>PAGE 02 · FRAMEWORK</b></article></div><div class="ip-consistency">GENERIC HOST · CONSISTENT PERSONA · NOT USER LIKENESS</div><div class="provenance">NATIVE PERSONAL-IP PAGE SOURCES · PROVENANCE RECORDED</div></section>

  <section class="scene" id="whiteboard"><div class="scene-kicker">WHITEBOARD · 4.5 SECONDS</div><h2 class="scene-title">底图稳定，只绘制关键路径</h2><div class="meaning"><b>这代表</b><span>描线 → 圈节点 → 彩色回填；字幕始终在最上层。</span></div><div class="whiteboard-base"><img src="assets/strategy.png" alt="手机采访布光步骤图"></div><svg class="whiteboard-svg" viewBox="0 0 1180 650"><path class="draw" d="M170 435 C280 320 390 420 510 300 S735 185 900 220 L1010 145"/><circle class="circle" cx="900" cy="220" r="74"/><path class="draw" d="M1000 145 l-40 -8 l18 36"/><rect class="fill" x="825" y="185" width="150" height="72" rx="18"/></svg><div class="whiteboard-steps"><span>01 · 描出主线</span><span>02 · 圈出关键节点</span><span>03 · 回填语义颜色</span></div><div class="provenance">PROJECT-OWNED ASSET · LAYERED FOREGROUND ONLY</div></section>

  <section class="scene" id="captions"><div class="museum-title"><b>CAPTION MUSEUM · 同一张大画布</b><span>68 styles · 8 semantic districts · one active narration line</span></div><nav class="museum-nav">${districts.map(district=>`<span data-caption-nav="${district.id}">${district.label}</span>`).join("")}</nav><div class="museum-viewport"><div class="museum-plane">${districtsHtml}</div></div><div class="museum-count">68 <small>ROUTABLE STYLES / 8 GROUPS</small></div><div class="museum-legend"><b>当前规则</b><span id="museum-rule">全景：所有样式在同一页面；镜头只聚焦当前语义组。</span></div><div class="provenance" style="color:#8098a8">CATALOG SOURCE · assets/caption-style-catalog.json</div></section>

  <section class="scene" id="closing"><div class="paper-grid"></div><div class="closing-final">内容不是塞进模板。<br><span>模板为内容服务。</span></div><div class="closing-flow">${["内容","页面","图片","动效","字幕","QC"].map(item=>`<article>${item}</article>`).join("")}</div></section>

  <div class="narration" id="narration"></div><div id="grain"></div>
</main><script>
window.__showcase=${payload};
const scenes=window.__showcase.scenes;
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>1-Math.pow(1-clamp(value),3);
function sceneAt(time){return scenes.find(scene=>time>=scene.start&&time<scene.end)||scenes[scenes.length-1]}
function setScene(scene,progress){
  document.querySelectorAll('.scene').forEach(node=>node.classList.toggle('active',node.id===scene.id));
  const root=document.getElementById(scene.id);root.style.setProperty('--p',ease(progress));
  const activeCaption=scene.captions?.find(cue=>progress<=cue.until)?.text||scene.captions?.at(-1)?.text||scene.caption;
  document.getElementById('narration').textContent=activeCaption;
  if(scene.id==='process')document.querySelectorAll('[data-process-node]').forEach((node,index)=>node.classList.toggle('done',progress>(index+1)/7));
  if(scene.id==='product')document.querySelectorAll('[data-product-state]').forEach((node,index)=>node.classList.toggle('active',index===Math.min(2,Math.floor(progress*3))));
  if(scene.id==='captions')renderMuseum(progress);
}
function renderMuseum(progress){
  const plane=document.querySelector('.museum-plane');
  const districts=[...document.querySelectorAll('[data-caption-district]')];
  const nav=[...document.querySelectorAll('[data-caption-nav]')];
  let focus=-1;
  if(progress>.08&&progress<.91)focus=Math.min(7,Math.floor((progress-.08)/.10375));
  districts.forEach((node,index)=>node.classList.toggle('focus',index===focus));
  nav.forEach((node,index)=>node.classList.toggle('active',index===focus));
  if(focus<0){plane.style.transform='translate(60px,65px) scale(.5)';document.getElementById('museum-rule').textContent='全景：所有 68 种样式同页存在；当前只保留一条主字幕。';return}
  const col=focus%4,row=Math.floor(focus/4),x=80+col*(880+34),y=120+row*(795+34);
  plane.style.transform='translate('+(140-x*1.02)+'px,'+(110-y*1.02)+'px) scale(1.02)';
  const district=window.__showcase.districts[focus];
  document.getElementById('museum-rule').textContent=district.label+' · '+district.job+' · '+district.styles.length+' styles · bottom safe band';
}
window.renderAt=function(time){const scene=sceneAt(Math.max(0,Math.min(${DURATION - 0.001},time)));setScene(scene,(time-scene.start)/scene.duration)};
window.auditAt=function(time){window.renderAt(time);const caption=document.getElementById('narration').getBoundingClientRect();const visible=[...document.querySelectorAll('.scene.active .scene-title,.scene.active .meaning,.scene.active .provenance')].map(node=>{const rect=node.getBoundingClientRect();return {text:node.textContent.trim().slice(0,80),left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,inside:rect.left>=0&&rect.top>=0&&rect.right<=1920&&rect.bottom<=1080,overlapsCaption:rect.bottom>caption.top&&rect.top<caption.bottom}});return {time,scene:sceneAt(time).id,caption:{top:caption.top,bottom:caption.bottom},visible}}
window.renderAt(0);
</script></body></html>`;
}

async function renderPreview(page, out) {
  const previews = {
    opening: 1.7,
    process: SCENES.find(scene => scene.id === "process").start + 4.2,
    proof: SCENES.find(scene => scene.id === "proof").start + 4.2,
    product: SCENES.find(scene => scene.id === "product").start + 3.8,
    covers: SCENES.find(scene => scene.id === "covers").start + 4.2,
    personal: SCENES.find(scene => scene.id === "personal").start + 2.8,
    whiteboard: SCENES.find(scene => scene.id === "whiteboard").start + 3.7,
    captionsOverview: SCENES.find(scene => scene.id === "captions").start + 0.5,
    captionsFocus: SCENES.find(scene => scene.id === "captions").start + 5.7,
    closing: DURATION - 0.5,
  };
  const audit = [];
  for (const [name, time] of Object.entries(previews)) {
    audit.push(await page.evaluate((at) => window.auditAt(at), time));
    await page.screenshot({ path: join(out, "screenshots", `${name}.png`) });
  }
  write(join(out, "logs", "layout-audit.json"), JSON.stringify(audit, null, 2));
  const layoutPassed = audit.every(item => item.visible.every(entry => entry.inside && !entry.overlapsCaption));
  if (!layoutPassed) throw new Error("Layout audit failed: a critical label is clipped or overlaps the narration band");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensure(options.out);
  ensure(join(options.out, "assets"));
  ensure(join(options.out, "frames"));
  ensure(join(options.out, "screenshots"));
  ensure(join(options.out, "workflow"));
  ensure(join(options.out, "logs"));
  ensure(join(options.out, "script"));

  const captions = JSON.parse(readFileSync(join(ROOT, "assets/caption-style-catalog.json"), "utf8"));
  if (captions.styles?.length !== 68 || Object.keys(captions.groups || {}).length !== 8) throw new Error("Caption catalog must contain 68 styles in 8 groups");
  for (const [name, relative] of Object.entries(IMAGE_ASSETS)) {
    const source = join(ROOT, relative);
    if (!existsSync(source)) throw new Error(`Missing showcase image: ${relative}`);
    const extension = source.endsWith(".jpg") ? ".jpg" : ".png";
    copyFileSync(source, join(options.out, "assets", `${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}${extension}`));
  }

  const htmlPath = join(options.out, "codex-video-workflow.html");
  write(htmlPath, makeHtml(captions));
  write(join(options.out, "workflow", "content-presentation-design.json"), JSON.stringify({
    schemaVersion: 1,
    strategy: "concrete-content-to-semantic-motion",
    rule: "Every motion example includes readable content, an object change, a named motion verb, a meaning statement, and provenance.",
    scenes: SCENES.map(scene => ({ id: scene.id, start: scene.start, end: scene.end, caption: scene.caption || null, captions: scene.captions || null })),
  }, null, 2));
  write(join(options.out, "workflow", "motion-template-selection.json"), JSON.stringify({
    schemaVersion: 1,
    examples: [
      { scene: "process", family: "checkpoint-timeline", core: "semantic-timeline-reveal", verbs: ["trace", "step", "resolve"], meaning: "node progression represents stage completion" },
      { scene: "data", family: "data-curve-proof", core: "data-curve-trace", verbs: ["trace", "highlight", "compare"], meaning: "trend and inflection explain the metric" },
      { scene: "proof", family: "proof-thread-board", core: "interactive-proof-board", verbs: ["connect", "inspect", "pressure"], meaning: "connections appear only when causality is stated" },
      { scene: "product", family: "screenflow-demo-path", core: "dark-saas-magic-ui", verbs: ["tap", "switch", "complete"], meaning: "input changes state before an output is claimed" },
      { scene: "compare", family: "before-after-craft", core: "kinetic-editorial-explainer", verbs: ["compare", "transform", "resolve"], meaning: "structural deltas remain visible" },
      { scene: "matrix", family: "matrix-choice-map", core: "interactive-proof-board", verbs: ["choose", "inspect", "lock"], meaning: "template routing uses explicit decision axes" },
      { scene: "lanes", family: "agent-simulation-lane", core: "semantic-timeline-reveal", verbs: ["handoff", "parallelize", "merge"], meaning: "responsibility and artifacts cross visible handoffs" },
      { scene: "covers", family: "comparison-gallery-wall", core: "kinetic-editorial-explainer", verbs: ["compare", "select", "magnify"], meaning: "cover structure is selected before cosmetic styling" },
      { scene: "whiteboard", family: "whiteboard-overlay-step", core: "semantic-timeline-reveal", verbs: ["trace", "circle", "fill"], meaning: "foreground marks explain one critical path" },
    ],
  }, null, 2));
  write(join(options.out, "workflow", "motion-style-template-selection.json"), JSON.stringify({
    schemaVersion: 1,
    route: "semantic-example-reel",
    selectionPolicy: "content job first; visual style and color second",
    selectedSceneFamilies: ["checkpoint-timeline", "data-curve-proof", "proof-thread-board", "screenflow-demo-path", "before-after-craft", "matrix-choice-map", "agent-simulation-lane", "comparison-gallery-wall", "whiteboard-overlay-step"],
    catalogBoundary: { families: 32, variantsPerFamily: 5, contracts: 160, claim: "reviewable contracts mapped onto executable cores; not 160 independent videos" },
  }, null, 2));
  write(join(options.out, "workflow", "page-decision-contract.json"), JSON.stringify({
    schemaVersion: 1,
    pages: SCENES.map(scene => ({ id: scene.id, durationSeconds: scene.duration, primaryIdea: scene.id === "captions" ? "all caption styles remain on one navigable plane" : scene.caption, oneMainIdea: true, audienceFacing: true })),
  }, null, 2));
  write(join(options.out, "workflow", "typography-motion-plan.json"), JSON.stringify({
    schemaVersion: 1,
    typography: { display: "system Chinese sans, black weight", body: "system Chinese sans", technicalEvidence: "system monospace", minimumCaptionPx: 29 },
    motionLimits: { permitted: ["opacity", "y-rise", "scale<=1.08", "mask", "underline", "trace", "scan", "progress fill"], forbidden: ["jitter", "rapid flashing", "caption rotation", "whole-page whiteboard redraw"] },
  }, null, 2));
  const districts = captionDistricts(captions);
  write(join(options.out, "workflow", "caption-style-plan.json"), JSON.stringify({
    schemaVersion: 1,
    globalSafeArea: "bottom-caption-band",
    displayMode: "single-line-sequential",
    museum: { onePage: true, styleCount: 68, groupCount: 8, groups: districts.map(district => ({ id: district.id, count: district.styles.length, styleIds: district.styles.map(style => style.id) })) },
    scenes: SCENES.map(scene => ({ sceneId: scene.id, selectedStyleId: scene.id === "captions" ? "museum-active-group" : "ink-capsule", fallbackStyleId: "film-subtitle", semanticCueType: "explanation", emphasisPlan: "one semantic clause", motion: "opacity+y-rise", safeArea: "bottom-caption-band", displayMode: "single-line-sequential" })),
  }, null, 2));
  write(join(options.out, "workflow", "whiteboard-layered-reveal-plan.json"), JSON.stringify({
    scene: "whiteboard",
    durationSeconds: 4.5,
    layers: ["stable project-owned base image", "hand-drawn path", "circled node and arrow", "semantic color fill", "topmost narration caption"],
    timing: [{ from: 0, to: 0.7, action: "hold base" }, { from: 0.7, to: 1.8, action: "trace path" }, { from: 1.8, to: 2.7, action: "circle node and arrow" }, { from: 2.7, to: 3.8, action: "color fill" }, { from: 3.8, to: 4.5, action: "reading hold" }],
  }, null, 2));
  write(join(options.out, "workflow", "visual-asset-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    assets: Object.entries(IMAGE_ASSETS).map(([id, path]) => ({ id, source: path, ownership: "project-showcase", use: "semantic scene object", embedded: `assets/${id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}${path.endsWith(".jpg") ? ".jpg" : ".png"}` })),
    personalIpClip: { source: "media/showcase/personal-ip/example-film/personal-ip-two-page-horizontal.mp4", policy: "generic host; do not claim user likeness" },
  }, null, 2));
  write(join(options.out, "workflow", "quality-consistency-contract.json"), JSON.stringify({
    schemaVersion: 1,
    requiredChecks: ["1920x1080", "30fps", "H.264 video", "AAC audio when final", "no detected black segment", "critical labels inside canvas", "critical labels outside caption band", "68 caption styles across 8 groups", "project-owned image manifest", "Personal-IP provenance"],
    statusLanguage: ["catalog", "review preview", "QC passed video", "publishing ready"],
  }, null, 2));
  const cues = captionCues();
  write(join(options.out, "workflow", "sync-timecode-plan.json"), JSON.stringify({ schemaVersion: 1, fps: FPS, durationSeconds: DURATION, cues }, null, 2));
  write(join(options.out, "workflow", "voice-subtitle-manifest.json"), JSON.stringify({ schemaVersion: 1, backend: "melotts_local", displayMode: "single-line-sequential", safeArea: "bottom-caption-band", cues }, null, 2));
  write(join(options.out, "script", "narration.txt"), SCENES.flatMap(scene => scene.captions?.map(cue => cue.text) || [scene.caption]).join("\n"));
  write(join(options.out, "script", "subtitles.srt"), cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}`).join("\n\n") + "\n");

  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch(chromiumLaunchOptions(playwright.chromium));
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await renderPreview(page, options.out);
  if (options.previewOnly) {
    await browser.close();
    console.log(JSON.stringify({ out: options.out, html: htmlPath, screenshots: join(options.out, "screenshots"), duration: DURATION }, null, 2));
    return;
  }
  for (let frame = 0; frame < Math.ceil(DURATION * FPS); frame += 1) {
    await page.evaluate((time) => window.renderAt(time), frame / FPS);
    await page.screenshot({ path: join(options.out, "frames", `frame-${String(frame).padStart(5, "0")}.png`) });
  }
  await browser.close();

  const htmlVideo = join(options.out, "codex-video-workflow-html.mp4");
  run("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS), "-i", join(options.out, "frames", "frame-%05d.png"), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", htmlVideo]);

  const ipScene = SCENES.find(scene => scene.id === "personal");
  const ipClip = join(ROOT, "media/showcase/personal-ip/example-film/personal-ip-two-page-horizontal.mp4");
  const silentVideo = join(options.out, "codex-video-workflow-silent.mp4");
  if (existsSync(ipClip)) {
    run("ffmpeg", ["-y", "-v", "error", "-i", htmlVideo, "-ss", "0", "-t", String(ipScene.duration), "-i", ipClip, "-filter_complex", `[1:v]setpts=PTS+${ipScene.start}/TB[ip];[0:v][ip]overlay=0:0:eof_action=pass:shortest=0[v]`, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silentVideo]);
  } else copyFileSync(htmlVideo, silentVideo);

  let finalVideo = silentVideo;
  if (options.providedAudio) {
    if (!existsSync(options.providedAudio)) throw new Error(`Provided audio not found: ${options.providedAudio}`);
    const packagedAudio = join(options.out, "assets", "narration.wav");
    if (resolve(options.providedAudio) !== resolve(packagedAudio)) copyFileSync(options.providedAudio, packagedAudio);
    finalVideo = join(options.out, "codex-video-workflow.mp4");
    run("ffmpeg", ["-y", "-v", "error", "-i", silentVideo, "-i", options.providedAudio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", `apad=pad_dur=${DURATION}`, "-t", String(DURATION), "-movflags", "+faststart", finalVideo]);
  }
  run("ffmpeg", ["-y", "-v", "error", "-ss", "0.8", "-i", finalVideo, "-frames:v", "1", "-q:v", "2", join(options.out, "poster.jpg")]);
  const contactInputs = ["process", "proof", "product", "covers", "whiteboard", "captionsOverview"].flatMap(name => ["-i", join(options.out, "screenshots", `${name}.png`)]);
  const contactSheet = join(options.out, "final-contact-sheet.png");
  run("ffmpeg", ["-y", "-v", "error", ...contactInputs, "-filter_complex", "xstack=inputs=6:layout=0_0|640_0|1280_0|0_360|640_360|1280_360,scale=1920:720", contactSheet]);
  const black = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-vf", "blackdetect=d=0.2:pix_th=0.05", "-an", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
  write(join(options.out, "logs", "blackdetect.log"), black);
  let volume = "";
  if (options.providedAudio) {
    volume = run("ffmpeg", ["-v", "info", "-i", finalVideo, "-af", "volumedetect", "-vn", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
    write(join(options.out, "logs", "volumedetect.log"), volume);
  }
  const meanVolume = Number(volume.match(/mean_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
  const maxVolume = Number(volume.match(/max_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", finalVideo]));
  write(join(options.out, "logs", "ffprobe.json"), JSON.stringify(probe, null, 2));
  const videoStream = probe.streams?.find(stream => stream.codec_type === "video");
  const audioStream = probe.streams?.find(stream => stream.codec_type === "audio");
  const checks = {
    duration: Math.abs(Number(probe.format?.duration) - DURATION) <= 0.18,
    resolution: videoStream?.width === WIDTH && videoStream?.height === HEIGHT,
    videoCodec: videoStream?.codec_name === "h264",
    audioStream: options.providedAudio ? Boolean(audioStream) : true,
    noDetectedBlackSegments: !black.includes("black_start:"),
    audioMeasured: options.providedAudio ? Number.isFinite(meanVolume) && Number.isFinite(maxVolume) : true,
    audibleMeanLevel: options.providedAudio ? meanVolume >= -35 && meanVolume <= -6 : true,
    unclippedPeak: options.providedAudio ? maxVolume <= 0 && maxVolume >= -12 : true,
    captionCoverage: captions.styles.length === 68 && districts.reduce((sum, district) => sum + district.styles.length, 0) === 68,
    realImageCount: Object.keys(IMAGE_ASSETS).length >= 9,
    contactSheetPresent: existsSync(contactSheet),
  };
  const passed = Object.values(checks).every(Boolean);
  write(join(options.out, "logs", "qc.json"), JSON.stringify({ schemaVersion: 1, finalVideo: relative(options.out, finalVideo).split("\\").join("/"), durationSeconds: DURATION, previewOnly: false, audioBearing: Boolean(options.providedAudio), audioMetrics: options.providedAudio ? { meanVolumeDb: meanVolume, maxVolumeDb: maxVolume } : null, checks, passed }, null, 2));
  write(join(options.out, "delivery-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    status: passed ? "qc-passed-demo" : "failed",
    video: relative(options.out, finalVideo).split("\\").join("/"),
    poster: "poster.jpg",
    contactSheet: relative(options.out, contactSheet).split("\\").join("/"),
    personalIpDemo: "../personal-ip/example-film/personal-ip-two-page-horizontal.mp4",
    evidence: ["logs/qc.json", "logs/ffprobe.json", "logs/layout-audit.json", "workflow/visual-asset-manifest.json", "workflow/caption-style-plan.json", "workflow/whiteboard-layered-reveal-plan.json"],
    publishingReadyClaim: false,
    note: "This is a QC-passed public capability demo. It does not claim that every catalog contract is an independently published video.",
  }, null, 2));
  if (!passed) throw new Error(`Workflow film QC failed: ${Object.entries(checks).filter(([, value]) => !value).map(([name]) => name).join(", ")}`);
  if (!options.keepFrames) rmSync(join(options.out, "frames"), { recursive: true, force: true });
  console.log(JSON.stringify({ out: options.out, finalVideo, durationSeconds: DURATION, qc: join(options.out, "logs", "qc.json"), passed }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
