#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEGMENTS_JSON = join(ROOT, "media/oral-materials/workflow-film-narration-segments.json");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stdout || ""}${result.stderr || ""}`);
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function parseArgs(argv) {
  const options = {
    segmentsDir: join(ROOT, "media/showcase/workflow-film/audio-segments"),
    out: join(ROOT, "media/showcase/workflow-film/assets/narration.wav"),
    auditDir: join(ROOT, "media/showcase/workflow-film/workflow"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--segments-dir") options.segmentsDir = resolve(argv[++index]);
    else if (argv[index] === "--out") options.out = resolve(argv[++index]);
    else if (argv[index] === "--audit-dir") options.auditDir = resolve(argv[++index]);
    else if (argv[index] === "--help") {
      console.log("Usage: node scripts/assemble-workflow-film-audio.mjs [--segments-dir <dir>] [--out <wav>] [--audit-dir <dir>]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[index]}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const segments = JSON.parse(readFileSync(SEGMENTS_JSON, "utf8"));
const normalizedDir = join(options.segmentsDir, "normalized");
mkdirSync(normalizedDir, { recursive: true });
mkdirSync(dirname(options.out), { recursive: true });
mkdirSync(options.auditDir, { recursive: true });

function measureVolume(path) {
  const output = run("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"]);
  const meanVolumeDb = Number(output.match(/mean_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
  const maxVolumeDb = Number(output.match(/max_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
  if (!Number.isFinite(meanVolumeDb) || !Number.isFinite(maxVolumeDb)) throw new Error(`Unable to measure volume: ${path}`);
  return { meanVolumeDb, maxVolumeDb };
}

const targetMeanVolumeDb = -22;
const minimumTailPaddingSeconds = 0.18;
const segmentAudit = [];

const normalized = [];
for (const segment of segments) {
  const source = join(options.segmentsDir, `segment-${String(segment.index).padStart(4, "0")}.wav`);
  if (!existsSync(source)) throw new Error(`Missing TTS segment: ${source}`);
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", source]).trim());
  const target = Number(segment.duration);
  const speechWindow = Math.max(0.5, target - minimumTailPaddingSeconds);
  if (duration > speechWindow) {
    throw new Error(`Natural narration does not fit segment ${segment.index}: source=${duration.toFixed(3)}s target=${target.toFixed(3)}s. Extend the scene; speech acceleration is forbidden.`);
  }
  const before = measureVolume(source);
  const paddingAdjustmentDb = 10 * Math.log10(duration / target);
  const gainDb = targetMeanVolumeDb - before.meanVolumeDb - paddingAdjustmentDb;
  const destination = join(normalizedDir, `segment-${String(segment.index).padStart(4, "0")}.wav`);
  const filters = [`volume=${gainDb.toFixed(3)}dB`, `apad=pad_dur=${target}`, `atrim=duration=${target}`, "asetpts=N/SR/TB", "aresample=48000"];
  run("ffmpeg", ["-y", "-v", "error", "-i", source, "-af", filters.join(","), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", destination]);
  const after = measureVolume(destination);
  segmentAudit.push({
    index: segment.index,
    scene: segment.scene,
    text: segment.text,
    sourceDurationSeconds: Number(duration.toFixed(3)),
    targetDurationSeconds: Number(target.toFixed(3)),
    playbackSpeed: 1,
    gainDb: Number(gainDb.toFixed(3)),
    before,
    after,
    filterChain: filters.join(","),
  });
  normalized.push(destination);
}

const postMeans = segmentAudit.map((entry) => entry.after.meanVolumeDb);
const postNormalizationSpreadDb = Number((Math.max(...postMeans) - Math.min(...postMeans)).toFixed(2));
const segmentLoudnessPass = postNormalizationSpreadDb <= 2.5 && segmentAudit.every((entry) => entry.playbackSpeed === 1);
writeFileSync(join(options.auditDir, "speech-segment-loudness.json"), JSON.stringify({
  schemaVersion: 1,
  targetMeanVolumeDb,
  speedPolicy: "natural MeloTTS speed 0.95; no per-segment atempo",
  normalizationMethod: "measured gain compensation before concat",
  postNormalizationSpreadDb,
  maximumAllowedSpreadDb: 2.5,
  passed: segmentLoudnessPass,
  segments: segmentAudit,
}, null, 2) + "\n");
if (!segmentLoudnessPass) throw new Error(`Segment loudness audit failed: spread=${postNormalizationSpreadDb}dB`);

const inputs = normalized.flatMap(path => ["-i", path]);
const labels = normalized.map((_, index) => `[${index}:a]`).join("");
run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${labels}concat=n=${normalized.length}:v=0:a=1[a]`, "-map", "[a]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", options.out]);

const total = segments.reduce((sum, segment) => sum + Number(segment.duration), 0);
const outputDuration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", options.out]).trim());
if (Math.abs(total - outputDuration) > 0.05) throw new Error(`Narration duration mismatch: expected ${total}, found ${outputDuration}`);
rmSync(normalizedDir, { recursive: true, force: true });
writeFileSync(join(options.auditDir, "audio-repair-plan.json"), JSON.stringify({
  schemaVersion: 1,
  rootCause: "Narration segments were independently accelerated to fit fixed visual windows, while only the concatenated track received loudness normalization.",
  rejectedFilter: "per-segment atempo plus concat-only loudnorm",
  replacement: "natural-speed segment timing plus measured per-segment gain normalization; final bus processing occurs during MP4 mux",
  invariants: ["playbackSpeed equals 1 for every segment", "post-normalization mean-volume spread is at most 2.5 dB", "scene duration follows natural narration"],
}, null, 2) + "\n");
console.log(JSON.stringify({ output: options.out, durationSeconds: outputDuration, segmentCount: segments.length, playbackSpeed: 1, postNormalizationSpreadDb }, null, 2));
