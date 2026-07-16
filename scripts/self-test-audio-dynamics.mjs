#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  FINAL_SPEECH_DELIVERY_FILTER,
  SEGMENT_SPEECH_NORMALIZE_FILTER,
  normalizeSpeechSegmentsForConcat,
  probeSegmentMeanVolumes,
} from "./lib/audio-dynamics.mjs";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result;
}

assert.match(SEGMENT_SPEECH_NORMALIZE_FILTER, /loudnorm=/, "each TTS segment must be normalized before concat");
assert.match(FINAL_SPEECH_DELIVERY_FILTER, /acompressor=/, "final speech chain must control short-term dynamics");
assert.match(FINAL_SPEECH_DELIVERY_FILTER, /loudnorm=.*LRA=5/, "final speech chain must target a tighter loudness range");
assert.match(FINAL_SPEECH_DELIVERY_FILTER, /alimiter=/, "final speech chain must retain a true-peak safety limiter");

const workflowSource = readFileSync(new URL("./poc-video-workflow.mjs", import.meta.url), "utf8");
const runQcSource = workflowSource.match(/async function runQc\([\s\S]*?\n}\n\nasync function main\(/)?.[0] || "";
assert.match(runQcSource, /const speechSegmentLoudness = readJsonIfExists\(join\(out, "workflow", "speech-segment-loudness\.json"\)\)/, "runQc must load speech segment loudness evidence in its own scope");
assert.match(runQcSource, /const finalAudioNormalization = readJsonIfExists\(join\(out, "workflow", "final-audio-normalization\.json"\)\)/, "runQc must load final audio normalization evidence in its own scope");

const root = mkdtempSync(join(tmpdir(), "codex-audio-dynamics-"));
try {
  const levels = [0.035, 0.09, 0.22, 0.055];
  const inputs = levels.map((level, index) => {
    const path = join(root, `input-${index + 1}.wav`);
    run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${210 + index * 45}:sample_rate=48000:duration=1.2`, "-af", `volume=${level}`, "-c:a", "pcm_s16le", path]);
    return path;
  });
  const output = join(root, "normalized.wav");
  const result = normalizeSpeechSegmentsForConcat({ files: inputs, output, workDir: root, run });
  const after = probeSegmentMeanVolumes(result.normalizedFiles, run);
  const means = after.map((item) => item.meanVolume).filter(Number.isFinite);
  const spread = Math.max(...means) - Math.min(...means);
  assert.ok(spread <= 2.5, `normalized segment loudness spread is still ${spread.toFixed(2)} dB`);
  assert.ok(result.normalizedFiles.length === inputs.length, "every input segment needs a normalized counterpart");
  assert.ok(result.gainCorrections.length === inputs.length && result.gainCorrections.every((item) => Number.isFinite(item.gainDb)), "every first-pass segment needs a measured gain correction");
  assert.ok(readFileSync(result.concatListPath, "utf8").split("\n").filter(Boolean).length === inputs.length, "concat manifest lost a segment");
  writeFileSync(join(root, "result.json"), `${JSON.stringify({ spread, after }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: true, spreadDb: Number(spread.toFixed(2)), segmentCount: inputs.length }, null, 2)}\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
