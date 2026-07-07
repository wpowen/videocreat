#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_FPS = 30;
const DEFAULT_JPEG_QUALITY = 96;
const DEFAULT_VIDEO_BITRATE = "12000k";
const DEFAULT_MAXRATE = "16000k";
const DEFAULT_BUFSIZE = "24000k";
const DEFAULT_MIN_BITRATE = 6_000_000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed with code ${result.status}\n${result.stderr || ""}`);
  }
  return result;
}

function secondsToNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseNumericBitrate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function ffprobe(file) {
  const result = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,bit_rate,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,duration,bit_rate",
    "-of", "json",
    file,
  ], { capture: true });
  return JSON.parse(result.stdout);
}

function updateQc({ out, finalMp4, minimumVideoBitrate }) {
  const metadata = ffprobe(finalMp4);
  writeJson(join(out, "logs", "ffprobe.json"), metadata);
  const qcPath = join(out, "logs", "qc.json");
  const qc = existsSync(qcPath) ? readJson(qcPath) : { checks: {} };
  const video = (metadata.streams || []).find((stream) => stream.codec_type === "video") || {};
  const formatBitrate = parseNumericBitrate(metadata.format?.bit_rate);
  const videoBitrate = parseNumericBitrate(video.bit_rate) || formatBitrate;
  qc.finalMp4 = finalMp4;
  qc.duration = secondsToNumber(metadata.format?.duration, qc.duration);
  qc.width = video.width;
  qc.height = video.height;
  qc.videoCodec = video.codec_name;
  qc.videoBitrate = videoBitrate;
  qc.minimumVideoBitrate = minimumVideoBitrate;
  qc.checks = { ...(qc.checks || {}), videoBitrateHealthy: videoBitrate >= minimumVideoBitrate };
  qc.pass = Object.values(qc.checks).every(Boolean);
  writeJson(qcPath, qc);

  const scorecardPath = join(out, "workflow", "quality-scorecard.md");
  if (existsSync(scorecardPath)) {
    const status = qc.checks.videoBitrateHealthy ? "PASS" : "FAIL";
    const row = `| Video sharpness bitrate | ${status} | Final video bitrate ${(videoBitrate / 1_000_000).toFixed(2)} Mbps; required at least ${(minimumVideoBitrate / 1_000_000).toFixed(1)} Mbps for crisp 1080p text/motion. |`;
    const current = readFileSync(scorecardPath, "utf8");
    const next = /\| Video sharpness bitrate \|/.test(current)
      ? current.replace(/\| Video sharpness bitrate \|[^\n]+\n/, `${row}\n`)
      : current.replace(/\| Visual readability \|[^\n]+\n/, (match) => `${match}${row}\n`);
    writeFileSync(scorecardPath, next, "utf8");
  }
  return qc;
}

async function captureProjectFrames({ out, fps, jpegQuality, keepFrames }) {
  const renderManifest = readJson(join(out, "workflow", "html-video-render.json"));
  const projectStore = renderManifest.projectStore;
  const project = readJson(join(projectStore, "project.json"));
  const frames = [...(project.frames || [])].sort((a, b) => a.order - b.order);
  if (!frames.length) throw new Error(`No frames found in ${join(projectStore, "project.json")}`);

  const htmlVideoRoot = resolve(ROOT, "research/html-video-research/html-video");
  const requireFromHtmlVideo = createRequire(join(htmlVideoRoot, "packages", "adapter-hyperframes", "package.json"));
  const playwright = requireFromHtmlVideo("playwright");

  const tempDir = join(out, "renders", "sharp-frame-sequence");
  if (!keepFrames) rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  let globalFrame = 1;
  const captured = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const frame of frames) {
      if (!frame.htmlPath || !existsSync(frame.htmlPath)) {
        throw new Error(`Missing frame HTML for ${frame.graphNodeId || frame.order}: ${frame.htmlPath}`);
      }
      const duration = Math.max(1 / fps, secondsToNumber(frame.durationSec, 1));
      const frameCount = Math.max(1, Math.round(duration * fps));
      await page.goto(pathToFileURL(frame.htmlPath).href, { waitUntil: "load" });
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      await page.evaluate(() => {
        for (const animation of document.getAnimations({ subtree: true })) {
          try {
            animation.pause();
          } catch {}
        }
      });
      for (let i = 0; i < frameCount; i += 1) {
        const timeMs = (i / fps) * 1000;
        await page.evaluate((ms) => {
          for (const animation of document.getAnimations({ subtree: true })) {
            try {
              animation.pause();
              animation.currentTime = ms;
            } catch {}
          }
        }, timeMs);
        const file = join(tempDir, `frame-${String(globalFrame).padStart(6, "0")}.jpg`);
        await page.screenshot({
          path: file,
          type: "jpeg",
          quality: jpegQuality,
          animations: "allow",
          caret: "hide",
        });
        globalFrame += 1;
      }
      captured.push({
        id: frame.graphNodeId,
        htmlPath: frame.htmlPath,
        durationSec: duration,
        frameCount,
      });
      process.stdout.write(`[sharp-render] ${frame.order + 1}/${frames.length} ${frame.graphNodeId || "frame"} ${frameCount} frames\n`);
    }
    await context.close();
  } finally {
    await browser.close().catch(() => {});
  }
  return { tempDir, frameCount: globalFrame - 1, captured };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = args.out ? resolve(ROOT, String(args.out)) : null;
  if (!out) throw new Error("Usage: sharp-render-html-video-project.mjs --out <output-dir>");
  const fps = Number(args.fps || DEFAULT_FPS);
  const jpegQuality = Number(args["jpeg-quality"] || DEFAULT_JPEG_QUALITY);
  const videoBitrate = String(args["video-bitrate"] || DEFAULT_VIDEO_BITRATE);
  const maxrate = String(args.maxrate || DEFAULT_MAXRATE);
  const bufsize = String(args.bufsize || DEFAULT_BUFSIZE);
  const minimumVideoBitrate = Number(args["min-video-bitrate"] || DEFAULT_MIN_BITRATE);
  const keepFrames = Boolean(args["keep-frames"]);

  mkdirSync(join(out, "renders"), { recursive: true });
  const originalFinal = join(out, "renders", "final.mp4");
  if (!existsSync(originalFinal)) throw new Error(`Missing rendered MP4 for audio source: ${originalFinal}`);

  const { tempDir, frameCount, captured } = await captureProjectFrames({ out, fps, jpegQuality, keepFrames });
  const silent = join(out, "renders", "final.sharp-silent.mp4");
  const sharp = join(out, "renders", "final.sharp.mp4");
  run("ffmpeg", [
    "-y",
    "-framerate", String(fps),
    "-i", join(tempDir, "frame-%06d.jpg"),
    "-c:v", "libx264",
    "-vf", "format=yuv420p",
    "-pix_fmt", "yuv420p",
    "-preset", "slow",
    "-b:v", videoBitrate,
    "-minrate", videoBitrate,
    "-maxrate", maxrate,
    "-bufsize", bufsize,
    "-x264-params", "nal-hrd=cbr:force-cfr=1:filler=1",
    "-movflags", "+faststart",
    silent,
  ]);
  run("ffmpeg", [
    "-y",
    "-i", silent,
    "-i", originalFinal,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "copy",
    "-shortest",
    sharp,
  ]);
  copyFileSync(sharp, originalFinal);
  copyFileSync(sharp, join(out, "final.mp4"));
  if (!keepFrames) rmSync(tempDir, { recursive: true, force: true });

  const qc = updateQc({ out, finalMp4: originalFinal, minimumVideoBitrate });
  writeJson(join(out, "workflow", "sharp-render.json"), {
    renderer: "html-video-sharp-frame-sequence",
    source: "per-scene HTML captured through Playwright screenshots and encoded with ffmpeg",
    fps,
    jpegQuality,
    frameCount,
    captured,
    videoBitrate,
    maxrate,
    bufsize,
    minimumVideoBitrate,
    output: "renders/final.mp4",
    qcPass: qc.pass,
    actualVideoBitrate: qc.videoBitrate,
  });
  process.stdout.write(JSON.stringify({
    ok: qc.pass,
    finalMp4: originalFinal,
    frameCount,
    videoBitrate: qc.videoBitrate,
    minimumVideoBitrate,
    qc: join(out, "logs", "qc.json"),
  }, null, 2));
  process.stdout.write("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
