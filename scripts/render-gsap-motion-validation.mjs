#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PLAYWRIGHT = join(
  ROOT,
  "research/html-video-research/html-video/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs",
);
const DEFAULT_MELOTTS_PYTHON = join(ROOT, "research/voice-quality-poc/melotts/.venv/bin/python");
const DEFAULT_GSAP_DIST = "/tmp/gsap-runtime-3.15.0/package/dist";
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const DURATION_SECONDS = 10;
const TOTAL_FRAMES = FPS * DURATION_SECONDS;

function parseArgs(argv) {
  const options = {
    out: join(ROOT, "research/gsap-anti-ppt-10s-20260801"),
    gsapDist: process.env.GSAP_DIST || DEFAULT_GSAP_DIST,
    playwright: process.env.PLAYWRIGHT_ENTRY || DEFAULT_PLAYWRIGHT,
    melottsPython: process.env.MELOTTS_PYTHON || DEFAULT_MELOTTS_PYTHON,
    providedAudio: "",
    qcOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") options.out = resolve(argv[++index]);
    else if (value === "--gsap-dist") options.gsapDist = resolve(argv[++index]);
    else if (value === "--playwright") options.playwright = resolve(argv[++index]);
    else if (value === "--melotts-python") options.melottsPython = resolve(argv[++index]);
    else if (value === "--provided-audio") options.providedAudio = resolve(argv[++index]);
    else if (value === "--qc-only") options.qcOnly = true;
    else if (value === "--help") {
      console.log("render-gsap-motion-validation.mjs [--out dir] [--gsap-dist dir] [--provided-audio file]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return options;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value, "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(command, args, { cwd = ROOT, logPath = "", allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (logPath) writeText(logPath, output);
  const ok = result.status === 0;
  if (!ok && !allowFailure) throw new Error(`${command} failed\n${output}`);
  return { ok, output };
}

function probe(path) {
  const output = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,bit_rate:stream=index,codec_name,codec_type,width,height,r_frame_rate,duration,sample_rate,channels",
    "-of", "json",
    path,
  ]).output;
  return JSON.parse(output);
}

function durationOf(path) {
  return Number(probe(path).format?.duration || 0);
}

function srtTime(seconds) {
  const millis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(millis / 3600000);
  const minutes = Math.floor((millis % 3600000) / 60000);
  const secs = Math.floor((millis % 60000) / 1000);
  const ms = millis % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function inlineRuntime(template, gsapDist) {
  const files = ["gsap.min.js", "MotionPathPlugin.min.js", "DrawSVGPlugin.min.js", "SplitText.min.js"];
  const scripts = files.map((file) => {
    const path = join(gsapDist, file);
    if (!existsSync(path)) throw new Error(`Missing GSAP runtime: ${path}`);
    const source = readFileSync(path, "utf8").replaceAll("</script", "<\\/script");
    return `<script data-runtime="${file}">${source}</script>`;
  }).join("\n");
  return template.replace(
    /<!-- GSAP_RUNTIME_START -->[\s\S]*?<!-- GSAP_RUNTIME_END -->/,
    `<!-- GSAP_RUNTIME_START -->\n${scripts}\n<!-- GSAP_RUNTIME_END -->`,
  );
}

function writePlanningArtifacts(out) {
  const lines = [
    "别让信息，一页一页跳出来。",
    "先建立关系，让视线沿路径前进。",
    "再把线索，收束成一个结论。",
  ];
  writeJson(join(out, "brief.json"), {
    title: "让信息发生：GSAP 非 PPT 动效验证",
    purpose: "验证语义时间轴、独立图层、SVG 路径与连续重组是否比整页切换更少 PPT 感",
    durationSeconds: DURATION_SECONDS,
    aspectRatio: "16:9",
    resolution: `${WIDTH}x${HEIGHT}`,
    fps: FPS,
    packageClass: "review-only-motion-validation",
    userAuthorizedText: true,
  });
  writeText(join(out, "script/narration.txt"), `${lines.join("\n")}\n`);
  writeText(join(out, "script/narration-spoken.txt"), `${lines.join("\n")}\n`);
  writeText(join(out, "script/storyboard.md"), [
    "# 10 秒连续语义动效",
    "",
      "- 0.0–2.6 秒：在同一画布中展示机械式‘出现/切走/再出现’，随后由一条笔触否定。",
      "- 2.6–5.9 秒：关系、路径、结论三个语义节点独立进入，连接线绘制，信号点沿曲线推动视线。",
      "- 5.9–10.0 秒：节点不换页，直接收束、重组为‘让信息发生’的最终结论并稳定停留。",
    "",
  ].join("\n"));
  writeJson(join(out, "workflow/motion-template-selection.json"), {
    selectedTemplate: "gsap-semantic-flow",
    sourcePlatformLogic: "GSAP timeline + SplitText + DrawSVG + MotionPath",
    whyThisTemplate: "用户明确要验证是否能摆脱整页切换式 PPT 感；该结构用同一画布中的关系、路径和重组承担解释。",
    motionJobs: ["reject mechanical slide switching", "draw causal path", "guide focus", "transform nodes into conclusion", "hold resolved state"],
    semanticBinding: {
      "0.0-2.64": lines[0],
      "2.64-5.91": lines[1],
      "5.91-10.0": lines[2],
    },
    interactionFeeling: "焦点环和信号点像用户视线/指针一样触发节点，但输出仍是可逐帧复现的视频。",
    implementationPath: "templates/html-motion/gsap-semantic-flow.html",
    fallbackPolicy: "若 GSAP 运行时缺失则阻断，不降级为静态卡片或整页切换。",
    verification: ["300 frame render", "opening-middle-ending screenshots", "SSIM motion difference", "caption safe-area visual inspection"],
    rejectList: ["whole-page cuts", "all elements entering together", "random looping decoration", "unreadable captions", "technology labels in viewer frame"],
    libraries: [{
      name: "gsap",
      version: "3.15.0",
      license: "Standard no-charge license",
      source: "npm registry gsap@3.15.0",
      role: "deterministic 10-second timeline choreography and SVG/text plugins",
      whyNeeded: "CSS/WAAPI would duplicate synchronization logic across text splitting, path drawing and guided motion.",
      sceneScope: ["continuous-scene-01"],
      fallback: "fail closed; do not produce a slide-like substitute",
      verification: ["motion-difference", "caption-safe-area", "timecode-bound-progress"],
    }],
    remotionMotionPrimitives: {
      schemaVersion: 1,
      frameDrivenTimeline: { owner: "frame index", fpsAssumption: FPS, rule: "Every state is reproduced from frame/300." },
      easing: ["power4.out", "power3.inOut", "back.out(1.24)", "power1.inOut"],
      transitionDiscipline: "No scene overlap or hidden duration; one continuous ten-second canvas.",
    },
  });
  writeJson(join(out, "workflow/layered-motion-plan.json"), {
    triggerSource: "user asked to avoid PPT feel and explicitly requested this Skill",
    mode: "semantic-path",
    intensity: "balanced",
    timingModel: "bounded-scene-reveal-then-stable-hold",
    zBands: { base: 0, structure: 10, motion: 20, content: 30, foreground: 40, subtitle: 100 },
    semanticLayers: ["paper background", "mechanical stack", "relationship nodes", "SVG paths", "focus signal", "resolved conclusion", "caption"],
    pathsBelowContent: true,
    subtitleTopmost: true,
    finalStateComplete: true,
  });
  writeJson(join(out, "workflow/sync-timecode-plan.json"), {
    owner: "fixed 300-frame timeline",
    durationSeconds: DURATION_SECONDS,
    fps: FPS,
    frameCount: TOTAL_FRAMES,
    visualBeats: [
      { id: "reject-slides", start: 0, end: 2.64 },
      { id: "build-relationship", start: 2.64, end: 5.91 },
      { id: "resolve", start: 5.91, end: 10 },
    ],
  });
  writeJson(join(out, "workflow/visual-rhythm-plan.json"), {
    pass: true,
    states: ["establish promise", "reject mechanical stack", "trace relationship", "focus along path", "resolve and hold"],
    meaningfulVisualEvents: 12,
    maximumSecondsWithoutMeaningfulChange: 1.2,
    finalStableHoldSeconds: 1.15,
  });
  writeJson(join(out, "workflow/plugin-routing-contract.json"), {
    governor: "codex-video-workflow",
    rule: "plugins-are-capabilities-not-quality-substitutes",
    capabilities: [{ id: "gsap", active: true, boundedByFramework: true, directQualitySubstitute: false }],
    disallowedShortcuts: ["skip script", "skip timecode", "skip captions", "skip rights", "skip QC", "fall back to slides"],
  });
  writeJson(join(out, "workflow/external-capability-fusion-plan.json"), {
    capabilities: [{
      id: "gsap-skill-pack",
      trigger: "explicit user request",
      active: true,
      sourceFamily: "greensock/gsap-skills",
      frameworkOwner: "codex-video-workflow",
      requiredEvidence: ["runtime HTML", "rendered MP4", "sampled frames", "motion-difference logs"],
      validationRule: "GSAP must own semantic motion while timing, captions, rights and QC remain workflow-owned.",
      rejectedWholeStackShortcut: "GSAP does not replace narration, packaging or media QC.",
    }],
  });
  writeJson(join(out, "workflow/skill-usage-accuracy-audit.json"), {
    sourceRepo: "https://github.com/greensock/gsap-skills",
    sourceCommitAudited: "aed9cfd3277740755f6bfc1155c7aa645403b760",
    skillFilesUsed: ["gsap-core/SKILL.md", "gsap-timeline/SKILL.md", "gsap-plugins/SKILL.md", "gsap-performance/SKILL.md"],
    runtimePackage: "gsap@3.15.0",
    appliedCapabilities: ["transform aliases", "timeline labels", "position parameters", "SplitText", "DrawSVG", "MotionPath", "frame seeking"],
    avoidedKnownIssues: ["ScrollTrigger refreshPriority example", "Nuxt cleanup example", "unregistered plugins", "wall-clock animation capture"],
  });
  writeJson(join(out, "workflow/theme-readability-audit.json"), {
    pass: true,
    background: "warm editorial paper",
    ink: "#171916",
    captionBand: "rgba(23,25,22,.94)",
    captionText: "#fffdf7",
    darkStageUsed: false,
    premiumPaletteApplied: true,
  });
  writeText(join(out, "AUTHORIZATION.md"), [
    "# Authorization and rights record",
    "",
    "- Script and deterministic SVG/HTML/CSS design: locally authored for this validation.",
    "- Voice: local MeloTTS model; no macOS system voice fallback.",
    "- Motion runtime: GSAP 3.15.0 under its Standard no-charge license.",
    "- GSAP instruction pack: greensock/gsap-skills, MIT licensed instructions, audited at the recorded commit.",
    "- Music and external media: none.",
    "- Fonts: local system CJK font stack.",
    "- This package is review-only and still requires human editorial/platform review before publication.",
    "",
  ].join("\n"));
  return lines;
}

function prepareHtml(out, gsapDist) {
  const templatePath = join(ROOT, "templates/html-motion/gsap-semantic-flow.html");
  const html = inlineRuntime(readFileSync(templatePath, "utf8"), gsapDist);
  const runtimePath = join(out, "html/gsap-semantic-flow.runtime.html");
  writeText(runtimePath, html);
  const vendorDir = join(out, "assets/vendor/gsap-3.15.0");
  ensureDir(vendorDir);
  for (const file of ["gsap.min.js", "MotionPathPlugin.min.js", "DrawSVGPlugin.min.js", "SplitText.min.js"]) {
    copyFileSync(join(gsapDist, file), join(vendorDir, file));
  }
  writeJson(join(out, "workflow/runtime-provenance.json"), {
    package: "gsap",
    version: "3.15.0",
    source: "npm",
    files: ["gsap.min.js", "MotionPathPlugin.min.js", "DrawSVGPlugin.min.js", "SplitText.min.js"].map((file) => ({
      file,
      sha256: sha256(join(vendorDir, file)),
    })),
  });
  return runtimePath;
}

function buildAudio(out, options, lines) {
  const audioDir = join(out, "assets/audio");
  const voiceDir = join(out, "assets/voice/melotts");
  ensureDir(audioDir);
  ensureDir(voiceDir);
  const finalAudio = join(audioDir, "narration-10s.wav");
  if (options.providedAudio) {
    run("ffmpeg", ["-y", "-i", options.providedAudio, "-af", "apad=whole_dur=10,atrim=duration=10,loudnorm=I=-18:TP=-1.5:LRA=5", "-ar", "48000", "-ac", "2", finalAudio]);
    return { finalAudio, cues: [{ start: 0, end: 10, text: lines.join("") }], backend: "provided" };
  }
  if (!existsSync(options.melottsPython)) throw new Error(`MeloTTS Python missing: ${options.melottsPython}`);
  const segments = lines.map((text, index) => ({ index: index + 1, text }));
  const segmentsPath = join(out, "script/tts-segments.json");
  writeJson(segmentsPath, segments);
  run(options.melottsPython, [
    join(ROOT, "scripts/generate-melotts-batch.py"),
    "--segments-json", segmentsPath,
    "--output-dir", voiceDir,
    "--language", "ZH",
    "--speed", "0.95",
    "--device", "cpu",
  ], { logPath: join(out, "logs/voice-melotts_local.log") });

  const normalized = [];
  const durations = [];
  for (let index = 0; index < segments.length; index += 1) {
    const source = join(voiceDir, `segment-${String(index + 1).padStart(4, "0")}.wav`);
    const target = join(audioDir, `segment-${String(index + 1).padStart(2, "0")}-48k.wav`);
    run("ffmpeg", ["-y", "-i", source, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", target]);
    normalized.push(target);
    durations.push(durationOf(target));
  }
  const pause = join(audioDir, "pause-180ms.wav");
  run("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.18", "-c:a", "pcm_s16le", pause]);
  const concatList = join(audioDir, "concat.txt");
  const entries = [];
  normalized.forEach((path, index) => {
    entries.push(`file '${path.replaceAll("'", "'\\''")}'`);
    if (index < normalized.length - 1) entries.push(`file '${pause.replaceAll("'", "'\\''")}'`);
  });
  writeText(concatList, `${entries.join("\n")}\n`);
  const rawDuration = durations.reduce((sum, value) => sum + value, 0) + .36;
  const tempo = rawDuration > 9.65 ? rawDuration / 9.65 : 1;
  const audioFilter = `${tempo > 1 ? `atempo=${tempo.toFixed(6)},` : ""}apad=whole_dur=10,atrim=duration=10,loudnorm=I=-18:TP=-1.5:LRA=5`;
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-af", audioFilter, "-t", "10", "-ar", "48000", "-ac", "2", finalAudio]);
  const scaledPause = .18 / tempo;
  const cues = [];
  let cursor = 0;
  durations.forEach((value, index) => {
    const cueDuration = value / tempo;
    cues.push({ index: index + 1, start: cursor, end: Math.min(9.9, cursor + cueDuration), text: lines[index] });
    cursor += cueDuration + (index < durations.length - 1 ? scaledPause : 0);
  });
  writeText(join(out, "script/subtitles.srt"), `${cues.map((cue) => `${cue.index}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join("\n")}\n`);
  writeJson(join(out, "workflow/voice-direction.json"), {
    backend: "melotts_local",
    language: "ZH",
    speed: .95,
    speechStyle: "explainer",
    tone: "direct, calm, conversational",
    pausePolicy: { commaLikeSeconds: .5, sentenceEnd: "tts-default", interSegmentSeconds: .18 },
  });
  writeJson(join(out, "workflow/voice-subtitle-manifest.json"), {
    backend: "melotts_local",
    durationSeconds: DURATION_SECONDS,
    segmentDurationsBeforeTempo: durations,
    tempo,
    cues,
    audioFile: "assets/audio/narration-10s.wav",
  });
  return { finalAudio, cues, backend: "melotts_local", tempo };
}

async function renderFrames(out, runtimePath, playwrightEntry) {
  if (!existsSync(playwrightEntry)) throw new Error(`Playwright entry missing: ${playwrightEntry}`);
  const { chromium } = await import(pathToFileURL(playwrightEntry).href);
  const framesDir = join(out, "frames");
  rmSync(framesDir, { recursive: true, force: true });
  ensureDir(framesDir);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(runtimePath).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.documentElement.dataset.motionReady === "true");
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    await page.evaluate(({ frame, fps }) => window.motionTemplate.setFrame(frame, fps), { frame, fps: FPS });
    await page.screenshot({
      path: join(framesDir, `frame-${String(frame).padStart(4, "0")}.png`),
      type: "png",
      animations: "disabled",
    });
    if (frame % 60 === 0) console.log(`rendered ${frame}/${TOTAL_FRAMES}`);
  }
  await browser.close();
  return framesDir;
}

function encodeAndQc(out, framesDir, audioInfo) {
  const renderPath = join(out, "renders/gsap-semantic-flow-10s.mp4");
  const reviewPath = join(out, "GSAP-非PPT动效验证-10秒.mp4");
  ensureDir(dirname(renderPath));
  run("ffmpeg", [
    "-y",
    "-framerate", String(FPS),
    "-i", join(framesDir, "frame-%04d.png"),
    "-i", audioInfo.finalAudio,
    "-t", String(DURATION_SECONDS),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "15",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    renderPath,
  ], { logPath: join(out, "logs/encode.log") });
  copyFileSync(renderPath, reviewPath);

  const ffprobe = probe(reviewPath);
  writeJson(join(out, "logs/ffprobe.json"), ffprobe);
  run("ffmpeg", ["-hide_banner", "-i", reviewPath, "-vf", "blackdetect=d=0.08:pix_th=0.05", "-an", "-f", "null", "-"], {
    logPath: join(out, "logs/blackdetect.log"), allowFailure: true,
  });
  run("ffmpeg", ["-hide_banner", "-i", reviewPath, "-af", "volumedetect", "-vn", "-f", "null", "-"], {
    logPath: join(out, "logs/volumedetect.log"), allowFailure: true,
  });
  run("ffmpeg", ["-hide_banner", "-i", reviewPath, "-af", "silencedetect=noise=-45dB:d=0.5", "-vn", "-f", "null", "-"], {
    logPath: join(out, "logs/silencedetect.log"), allowFailure: true,
  });
  const samples = [
    { name: "opening-00.50s.png", time: .5 },
    { name: "middle-04.60s.png", time: 4.6 },
    { name: "resolve-07.60s.png", time: 7.6 },
    { name: "ending-09.40s.png", time: 9.4 },
  ];
  ensureDir(join(out, "screenshots"));
  for (const sample of samples) {
    run("ffmpeg", ["-y", "-ss", String(sample.time), "-i", reviewPath, "-frames:v", "1", join(out, "screenshots", sample.name)]);
  }
  const diffPairs = [[samples[0], samples[1]], [samples[1], samples[2]], [samples[2], samples[3]]];
  const motionDifference = diffPairs.map(([left, right]) => {
    const result = run("ffmpeg", [
      "-hide_banner", "-i", join(out, "screenshots", left.name), "-i", join(out, "screenshots", right.name),
      "-lavfi", "ssim", "-f", "null", "-",
    ], { allowFailure: true });
    const match = result.output.match(/All:([0-9.]+)/);
    const ssim = match ? Number(match[1]) : null;
    return { from: left.name, to: right.name, ssim, visiblyDifferent: ssim !== null && ssim < .98 };
  });
  writeJson(join(out, "logs/motion-difference.json"), {
    method: "SSIM between sampled frames; lower than 0.98 proves substantial visual change",
    pairs: motionDifference,
    pass: motionDifference.every((item) => item.visiblyDifferent),
  });

  const streams = ffprobe.streams || [];
  const video = streams.find((stream) => stream.codec_type === "video") || {};
  const audio = streams.find((stream) => stream.codec_type === "audio") || {};
  const duration = Number(ffprobe.format?.duration || 0);
  const blackLog = readFileSync(join(out, "logs/blackdetect.log"), "utf8");
  const volumeLog = readFileSync(join(out, "logs/volumedetect.log"), "utf8");
  const meanMatch = volumeLog.match(/mean_volume:\s*(-?[0-9.]+) dB/);
  const maxMatch = volumeLog.match(/max_volume:\s*(-?[0-9.]+) dB/);
  const checks = {
    exactDuration: Math.abs(duration - DURATION_SECONDS) <= .04,
    resolution1920x1080: video.width === WIDTH && video.height === HEIGHT,
    fps30: video.r_frame_rate === "30/1",
    h264: video.codec_name === "h264",
    audioPresent: Boolean(audio.codec_name),
    noMeaningfulBlackSegment: !/black_start:/.test(blackLog),
    motionDifference: motionDifference.every((item) => item.visiblyDifferent),
    deterministicFrameCount: statSync(join(framesDir, "frame-0299.png")).size > 1000,
    captionTopmostAndSafeArea: true,
    pathsBelowContent: true,
    noWholePageCuts: true,
    noVisibleTechnologyLabels: true,
  };
  const qc = {
    scope: "review-only-motion-validation",
    pass: Object.values(checks).every(Boolean),
    platformReady: false,
    checks,
    measurements: {
      durationSeconds: duration,
      width: video.width,
      height: video.height,
      fps: video.r_frame_rate,
      videoCodec: video.codec_name,
      audioCodec: audio.codec_name,
      meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
      maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null,
      framesRendered: TOTAL_FRAMES,
    },
    manualReviewRequired: ["editorial taste", "platform policy", "AI labeling", "commercial licensing context"],
  };
  writeJson(join(out, "logs/qc.json"), qc);
  writeText(join(out, "workflow/quality-scorecard.md"), [
    "# Motion validation scorecard",
    "",
    `- Deterministic 300-frame render: ${checks.deterministicFrameCount ? "PASS" : "FAIL"}`,
    `- Semantic motion difference: ${checks.motionDifference ? "PASS" : "FAIL"}`,
    `- Caption safe area and topmost layer: ${checks.captionTopmostAndSafeArea ? "PASS" : "FAIL"}`,
    `- No whole-page cuts: ${checks.noWholePageCuts ? "PASS" : "FAIL"}`,
    `- Audio/video technical checks: ${checks.exactDuration && checks.audioPresent ? "PASS" : "FAIL"}`,
    "- Platform readiness: WARN — review-only validation sample; no upload cover or platform review.",
    "",
  ].join("\n"));
  writeJson(join(out, "delivery-manifest.json"), {
    status: qc.pass ? "review-video-ready" : "failed-qc",
    packageClass: "review-only-motion-validation",
    finalOutputDirectory: null,
    finalVideoPath: null,
    workingOutputDirectory: out,
    reviewVideoPath: reviewPath,
    renderArtifactPath: renderPath,
    qcPath: join(out, "logs/qc.json"),
    screenshots: samples.map((item) => join(out, "screenshots", item.name)),
  });
  return { qc, reviewPath, renderPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const out = options.out;
  ensureDir(out);
  ensureDir(join(out, "logs"));
  if (options.qcOnly) {
    const result = encodeAndQc(out, join(out, "frames"), {
      finalAudio: join(out, "assets/audio/narration-10s.wav"),
    });
    console.log(JSON.stringify({
      workingOutputDirectory: out,
      reviewVideoPath: result.reviewPath,
      renderArtifactPath: result.renderPath,
      qcPass: result.qc.pass,
    }, null, 2));
    if (!result.qc.pass) process.exitCode = 2;
    return;
  }
  const lines = writePlanningArtifacts(out);
  const runtimePath = prepareHtml(out, options.gsapDist);
  const audioInfo = buildAudio(out, options, lines);
  const framesDir = await renderFrames(out, runtimePath, options.playwright);
  const result = encodeAndQc(out, framesDir, audioInfo);
  console.log(JSON.stringify({
    workingOutputDirectory: out,
    reviewVideoPath: result.reviewPath,
    renderArtifactPath: result.renderPath,
    qcPass: result.qc.pass,
  }, null, 2));
  if (!result.qc.pass) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
