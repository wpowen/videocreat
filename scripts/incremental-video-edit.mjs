#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function run(command, args, { cwd, check = true } = {}) {
  const startedAt = new Date();
  const start = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - start;
  const record = {
    command: [command, ...args].join(" "),
    cwd,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs,
    durationSeconds: Number((durationMs / 1000).toFixed(3)),
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
  if (check && result.status !== 0) {
    const tail = String(record.stderr || record.stdout || "").slice(-4000);
    throw new Error(`${command} failed with status ${result.status}\n${tail}`);
  }
  return record;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findFinalMp4(root) {
  const candidates = [
    join(root, "renders", "final.mp4"),
    join(root, "final.mp4"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) fail(`No final MP4 found under ${root}`);
  return found;
}

function ffprobe(path, cwd) {
  const result = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,duration,bit_rate",
    "-of", "json",
    path,
  ], { cwd });
  return JSON.parse(result.stdout);
}

function durationOf(metadata) {
  return Number(metadata?.format?.duration || 0);
}

function findStream(metadata, type) {
  return (metadata?.streams || []).find((stream) => stream.codec_type === type);
}

function parseBlackdetect(text) {
  const hits = [];
  const pattern = /black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:([0-9.]+)/g;
  for (const match of text.matchAll(pattern)) {
    hits.push({
      start: Number(match[1]),
      end: Number(match[2]),
      duration: Number(match[3]),
    });
  }
  return hits;
}

function parseVolumeDetect(text) {
  const mean = text.match(/mean_volume:\s*(-?[0-9.]+)\s*dB/);
  const max = text.match(/max_volume:\s*(-?[0-9.]+)\s*dB/);
  return {
    meanVolumeDb: mean ? Number(mean[1]) : null,
    maxVolumeDb: max ? Number(max[1]) : null,
  };
}

function preserveBaseVideo(out) {
  const renderFinal = join(out, "renders", "final.mp4");
  const rootFinal = join(out, "final.mp4");
  const renderBase = join(out, "renders", "final.base.mp4");
  const rootBase = join(out, "final.base.mp4");
  if (!existsSync(renderFinal) && existsSync(rootFinal)) {
    ensureDir(dirname(renderFinal));
    copyFileSync(rootFinal, renderFinal);
  }
  if (!existsSync(renderBase)) copyFileSync(renderFinal, renderBase);
  if (existsSync(rootFinal) && !existsSync(rootBase)) copyFileSync(rootFinal, rootBase);
  return renderBase;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.base || !args.out) {
    fail("Usage: incremental-video-edit.mjs --base <existing-output-dir> --out <new-output-dir> [--scene-id <id>] [--label <text>] [--force]");
  }
  const base = resolve(args.base);
  const out = resolve(args.out);
  if (!existsSync(base)) fail(`Base directory does not exist: ${base}`);
  if (existsSync(out)) {
    if (!args.force) fail(`Output already exists: ${out}. Pass --force to replace it.`);
    rmSync(out, { recursive: true, force: true });
  }

  const wallStart = Date.now();
  cpSync(base, out, { recursive: true });
  ensureDir(join(out, "workflow"));
  ensureDir(join(out, "logs"));
  ensureDir(join(out, "screenshots"));
  ensureDir(join(out, "renders"));

  const syncPlanPath = join(out, "workflow", "sync-timecode-plan.json");
  if (!existsSync(syncPlanPath)) fail(`Missing sync-timecode-plan.json in ${out}`);
  const syncPlan = readJson(syncPlanPath);
  const scenes = Array.isArray(syncPlan.scenes) ? syncPlan.scenes : [];
  if (!scenes.length) fail("sync-timecode-plan.json has no scenes.");

  const scene = args["scene-id"]
    ? scenes.find((item) => item.id === args["scene-id"])
    : scenes[Math.min(2, scenes.length - 1)];
  if (!scene) fail(`Scene not found: ${args["scene-id"]}`);

  const start = Number(scene.start || 0);
  const end = Number(scene.end || 0);
  if (!(end > start)) fail(`Invalid scene timing for ${scene.id}: ${start}-${end}`);
  const mid = Number(((start + end) / 2).toFixed(3));
  const label = String(args.label || `INCREMENTAL PATCH ${scene.id}`).slice(0, 80);
  const labelPath = join(out, "workflow", "incremental-overlay-label.txt");
  writeFileSync(labelPath, label + "\n");

  const baseVideo = preserveBaseVideo(out);
  const outputVideo = join(out, "renders", "final.mp4");
  const baseMetadata = ffprobe(baseVideo, out);
  const commandLog = [];

  const enable = `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`;
  const filterBoxOnly = [
    `drawbox=x=70:y=70:w=690:h=145:color=yellow@0.82:t=fill:enable=${enable}`,
    `drawbox=x=70:y=70:w=690:h=145:color=black@0.95:t=5:enable=${enable}`,
  ].join(",");

  const render = run("ffmpeg", [
    "-y",
    "-i", baseVideo,
    "-vf", filterBoxOnly,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", "8M",
    "-maxrate", "10M",
    "-bufsize", "16M",
    "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    outputVideo,
  ], { cwd: out });
  commandLog.push({ ...render, category: "video-render" });
  copyFileSync(outputVideo, join(out, "final.mp4"));

  const outputMetadata = ffprobe(outputVideo, out);
  writeJson(join(out, "logs", "incremental-ffprobe.json"), outputMetadata);
  const baseVideoStream = findStream(baseMetadata, "video");
  const baseAudioStream = findStream(baseMetadata, "audio");
  const outputVideoStream = findStream(outputMetadata, "video");
  const outputAudioStream = findStream(outputMetadata, "audio");

  const baseShot = join(out, "screenshots", "incremental-base-target-scene.png");
  const patchedShot = join(out, "screenshots", "incremental-patched-target-scene.png");
  commandLog.push({
    ...run("ffmpeg", ["-y", "-ss", String(mid), "-i", baseVideo, "-frames:v", "1", baseShot], { cwd: out }),
    category: "screenshots",
  });
  commandLog.push({
    ...run("ffmpeg", ["-y", "-ss", String(mid), "-i", outputVideo, "-frames:v", "1", patchedShot], { cwd: out }),
    category: "screenshots",
  });

  const black = run("ffmpeg", [
    "-v", "info",
    "-i", outputVideo,
    "-vf", "blackdetect=d=0.2:pix_th=0.10",
    "-an",
    "-f", "null",
    "-",
  ], { cwd: out, check: false });
  const blackLog = `${black.stderr || ""}\n${black.stdout || ""}`;
  writeFileSync(join(out, "logs", "incremental-blackdetect.log"), blackLog);
  commandLog.push({ ...black, category: "qc" });

  const volume = run("ffmpeg", [
    "-i", outputVideo,
    "-af", "volumedetect",
    "-vn",
    "-sn",
    "-dn",
    "-f", "null",
    "-",
  ], { cwd: out, check: false });
  const volumeLog = `${volume.stderr || ""}\n${volume.stdout || ""}`;
  writeFileSync(join(out, "logs", "incremental-volumedetect.log"), volumeLog);
  commandLog.push({ ...volume, category: "qc" });

  const baseDuration = durationOf(baseMetadata);
  const outputDuration = durationOf(outputMetadata);
  const durationDeltaSeconds = Number(Math.abs(outputDuration - baseDuration).toFixed(3));
  const baseShotHash = sha256(baseShot);
  const patchedShotHash = sha256(patchedShot);
  const targetFrameChanged = baseShotHash !== patchedShotHash;
  const blackSegments = parseBlackdetect(blackLog);
  const volumeStats = parseVolumeDetect(volumeLog);
  const outputBitRate = Number(outputMetadata?.format?.bit_rate || outputVideoStream?.bit_rate || 0);
  const width = Number(outputVideoStream?.width || 0);
  const height = Number(outputVideoStream?.height || 0);
  const minimumBitRate = width >= 1280 || height >= 720 ? 6000000 : 0;
  const audioExpected = Boolean(baseAudioStream);
  const qcChecks = {
    finalMp4Present: existsSync(outputVideo),
    baseMp4Preserved: existsSync(baseVideo),
    durationBound: durationDeltaSeconds <= 0.2,
    targetFrameChanged,
    videoStreamPresent: Boolean(outputVideoStream),
    audioPreserved: !audioExpected || Boolean(outputAudioStream),
    blackdetectClean: blackSegments.length === 0,
    volumedetectPresent: !audioExpected || volumeStats.meanVolumeDb !== null || volumeStats.maxVolumeDb !== null,
    volumeAudible: !audioExpected
      || ((volumeStats.meanVolumeDb ?? -Infinity) >= -36 && (volumeStats.maxVolumeDb ?? -Infinity) >= -18),
    bitratePass: !minimumBitRate || outputBitRate >= minimumBitRate,
  };
  const qcPass = Object.values(qcChecks).every(Boolean);
  const totalDurationMs = Date.now() - wallStart;
  const commandDurationMs = commandLog.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
  const categories = {};
  for (const item of commandLog) {
    const key = item.category || "other";
    categories[key] ||= { commands: 0, durationMs: 0, failures: 0, cacheHits: 0 };
    categories[key].commands += 1;
    categories[key].durationMs += Number(item.durationMs || 0);
    if (item.status !== 0) categories[key].failures += 1;
  }
  for (const value of Object.values(categories)) {
    value.durationSeconds = Number((value.durationMs / 1000).toFixed(3));
  }

  const lineage = {
    schemaVersion: 1,
    mode: "incremental-scene-overlay",
    baseProject: base,
    outputProject: out,
    targetScene: {
      id: scene.id,
      order: scene.order,
      start,
      end,
      mid,
      previousSubtitle: scene.subtitle,
      visualHeadline: scene.visualHeadline,
    },
    edit: {
      type: "scene-element-overlay",
      label,
      operation: "add visible overlay only inside the target scene time window",
    },
    dirtyNodes: [
      `scene:${scene.id}:overlay-layer`,
      `render:fused-final-mp4`,
      "qc:incremental-media",
      "screenshot:target-scene",
    ],
    reusedNodes: [
      "planner",
      "script:narration",
      "script:subtitle-cue-segments",
      "tts:all-cached-existing-files",
      "audio:narration-mix",
      ...scenes.filter((item) => item.id !== scene.id).map((item) => `scene:${item.id}`),
    ],
    outputs: {
      finalMp4: relative(out, outputVideo),
      baseMp4: relative(out, baseVideo),
      baseScreenshot: relative(out, baseShot),
      patchedScreenshot: relative(out, patchedShot),
      ffprobe: "logs/incremental-ffprobe.json",
      blackdetect: "logs/incremental-blackdetect.log",
      volumedetect: "logs/incremental-volumedetect.log",
      incrementalQc: "logs/incremental-qc.json",
    },
    verification: {
      baseDurationSeconds: Number(baseDuration.toFixed(3)),
      outputDurationSeconds: Number(outputDuration.toFixed(3)),
      durationDeltaSeconds,
      targetFrameChanged,
      baseScreenshotSha256: baseShotHash,
      patchedScreenshotSha256: patchedShotHash,
      outputSizeBytes: statSync(outputVideo).size,
      outputBitRate,
      minimumBitRate,
      blackSegments,
      volumeStats,
      pass: qcPass,
    },
    timing: {
      totalDurationMs,
      totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(3)),
      commandDurationMs,
      commandDurationSeconds: Number((commandDurationMs / 1000).toFixed(3)),
      categories,
    },
  };

  writeJson(join(out, "workflow", "incremental-edit-lineage.json"), lineage);
  writeJson(join(out, "logs", "incremental-qc.json"), {
    generatedAt: new Date().toISOString(),
    mode: "incremental-scene-overlay",
    baseProject: base,
    outputProject: out,
    targetSceneId: scene.id,
    pass: qcPass,
    checks: qcChecks,
    media: {
      baseDurationSeconds: Number(baseDuration.toFixed(3)),
      outputDurationSeconds: Number(outputDuration.toFixed(3)),
      durationDeltaSeconds,
      width,
      height,
      videoCodec: outputVideoStream?.codec_name || null,
      audioCodec: outputAudioStream?.codec_name || null,
      outputBitRate,
      minimumBitRate,
      audioExpected,
    },
    blackdetect: {
      log: "logs/incremental-blackdetect.log",
      segments: blackSegments,
    },
    volumedetect: {
      log: "logs/incremental-volumedetect.log",
      ...volumeStats,
    },
    screenshots: {
      base: relative(out, baseShot),
      patched: relative(out, patchedShot),
      baseSha256: baseShotHash,
      patchedSha256: patchedShotHash,
    },
    lineage: "workflow/incremental-edit-lineage.json",
    timing: "workflow/incremental-timing-summary.json",
  });
  writeJson(join(out, "workflow", "incremental-timing-summary.json"), {
    generatedAt: new Date().toISOString(),
    totalCommands: commandLog.length,
    totalDurationMs,
    totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(3)),
    commandDurationMs,
    commandDurationSeconds: Number((commandDurationMs / 1000).toFixed(3)),
    categories,
    commands: commandLog.map((item) => ({
      category: item.category,
      durationMs: item.durationMs,
      durationSeconds: item.durationSeconds,
      status: item.status,
      command: item.command,
      fallback: item.fallback || undefined,
    })),
  });

  if (!lineage.verification.pass) {
    fail(`Incremental edit verification failed. See ${join(out, "workflow", "incremental-edit-lineage.json")}`);
  }
  console.log(JSON.stringify({
    ok: true,
    out,
    finalMp4: outputVideo,
    targetScene: scene.id,
    totalDurationSeconds: lineage.timing.totalDurationSeconds,
    durationDeltaSeconds,
    targetFrameChanged,
  }, null, 2));
}

main();
