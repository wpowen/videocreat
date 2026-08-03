#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--segments-dir") options.segmentsDir = resolve(argv[++index]);
    else if (argv[index] === "--out") options.out = resolve(argv[++index]);
    else if (argv[index] === "--help") {
      console.log("Usage: node scripts/assemble-workflow-film-audio.mjs [--segments-dir <dir>] [--out <wav>]");
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

const normalized = [];
for (const segment of segments) {
  const source = join(options.segmentsDir, `segment-${String(segment.index).padStart(4, "0")}.wav`);
  if (!existsSync(source)) throw new Error(`Missing TTS segment: ${source}`);
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", source]).trim());
  const target = Number(segment.duration);
  const speechWindow = Math.max(0.5, target - 0.18);
  const speed = duration > speechWindow ? Math.min(2, duration / speechWindow) : 1;
  const destination = join(normalizedDir, `segment-${String(segment.index).padStart(4, "0")}.wav`);
  const filters = [];
  if (speed > 1.001) filters.push(`atempo=${speed.toFixed(6)}`);
  filters.push(`apad=pad_dur=${target}`, `atrim=duration=${target}`, "asetpts=N/SR/TB", "aresample=48000");
  run("ffmpeg", ["-y", "-v", "error", "-i", source, "-af", filters.join(","), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", destination]);
  normalized.push(destination);
}

const inputs = normalized.flatMap(path => ["-i", path]);
const labels = normalized.map((_, index) => `[${index}:a]`).join("");
run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${labels}concat=n=${normalized.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[a]`, "-map", "[a]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", options.out]);

const total = segments.reduce((sum, segment) => sum + Number(segment.duration), 0);
const outputDuration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", options.out]).trim());
if (Math.abs(total - outputDuration) > 0.05) throw new Error(`Narration duration mismatch: expected ${total}, found ${outputDuration}`);
rmSync(normalizedDir, { recursive: true, force: true });
console.log(JSON.stringify({ output: options.out, durationSeconds: outputDuration, segmentCount: segments.length }, null, 2));
