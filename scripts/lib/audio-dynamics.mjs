import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const SEGMENT_SPEECH_NORMALIZE_FILTER = [
  "highpass=f=70",
  "lowpass=f=14000",
  "loudnorm=I=-20:TP=-3:LRA=5",
].join(",");

export const FINAL_SPEECH_DELIVERY_FILTER = [
  "highpass=f=70",
  "lowpass=f=14000",
  "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=180:makeup=2dB:knee=2.5:detection=rms",
  "loudnorm=I=-15:TP=-1.5:LRA=5",
  "alimiter=limit=0.95",
].join(",");

export const SEGMENT_MEAN_TARGET_DB = -20;

function commandOutput(result) {
  return `${result?.stderr || ""}\n${result?.stdout || ""}`;
}

export function parseMeanVolume(output = "") {
  const match = String(output).match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  return match ? Number(match[1]) : null;
}

export function probeSegmentMeanVolumes(files = [], run) {
  return files.map((file) => {
    const result = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"]);
    return { file, meanVolume: parseMeanVolume(commandOutput(result)) };
  });
}

export function normalizeSpeechSegmentsForConcat({ files = [], output, workDir, run }) {
  if (!files.length) throw new Error("Speech segment normalization requires at least one input file.");
  if (!output) throw new Error("Speech segment normalization requires an output path.");
  if (typeof run !== "function") throw new Error("Speech segment normalization requires a command runner.");
  const root = workDir || dirname(output);
  const normalizedDir = join(root, "audio-normalized-segments");
  mkdirSync(normalizedDir, { recursive: true });
  const firstPassFiles = files.map((file, index) => {
    const normalized = join(normalizedDir, `${String(index + 1).padStart(4, "0")}-${basename(file).replace(/\.[^.]+$/, "")}.wav`);
    run("ffmpeg", [
      "-y", "-v", "error",
      "-i", file,
      "-af", SEGMENT_SPEECH_NORMALIZE_FILTER,
      "-ar", "48000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      normalized,
    ], { cwd: root, category: "audio-post" });
    return normalized;
  });
  const measuredDir = join(root, "audio-measured-level-segments");
  mkdirSync(measuredDir, { recursive: true });
  const gainCorrections = [];
  const normalizedFiles = firstPassFiles.map((file, index) => {
    const probe = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"]);
    const measuredMeanDb = parseMeanVolume(commandOutput(probe));
    if (!Number.isFinite(measuredMeanDb)) throw new Error(`Could not measure normalized speech segment ${file}.`);
    const gainDb = Number((SEGMENT_MEAN_TARGET_DB - measuredMeanDb).toFixed(2));
    const corrected = join(measuredDir, `${String(index + 1).padStart(4, "0")}-${basename(file)}`);
    run("ffmpeg", [
      "-y", "-v", "error",
      "-i", file,
      "-af", `volume=${gainDb}dB`,
      "-ar", "48000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      corrected,
    ], { cwd: root, category: "audio-post" });
    gainCorrections.push({ file, measuredMeanDb, targetMeanDb: SEGMENT_MEAN_TARGET_DB, gainDb, corrected });
    return corrected;
  });
  const concatListPath = join(root, `${basename(output)}.normalized.concat.txt`);
  writeFileSync(concatListPath, `${normalizedFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n")}\n`, "utf8");
  run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", output], { cwd: root, category: "audio-post" });
  return {
    output,
    normalizedFiles,
    normalizedDir,
    measuredDir,
    firstPassFiles,
    gainCorrections,
    concatListPath,
    filter: SEGMENT_SPEECH_NORMALIZE_FILTER,
    targetMeanDb: SEGMENT_MEAN_TARGET_DB,
    policy: "normalize-each-generated-speech-segment-then-apply-measured-mean-gain-before-concat",
  };
}
