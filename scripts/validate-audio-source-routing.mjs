#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const outDir = join(workspace, "research/codex-video-workflow-poc/audio-source-routing-validation");

function read(relativePath) {
  return readFileSync(join(skillRoot, relativePath), "utf8");
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function indexOfRequired(source, needle, failures) {
  const index = source.indexOf(needle);
  expect(index !== -1, `Missing required source fragment: ${needle}`, failures);
  return index;
}

function main() {
  const failures = [];
  const script = read("scripts/poc-video-workflow.mjs");
  const nativeRenderer = read("scripts/render-ip-diagram-native-pages.mjs");
  const skill = read("SKILL.md");
  const readmeZh = read("README.zh-CN.md");

  expect(/--provided-audio <wav\|m4a\|mp3>/.test(script), "CLI usage must expose --provided-audio.", failures);
  expect(/const providedAudioPath = args\["provided-audio"\] \|\| args\.audio \|\| brief\.providedAudio \|\| brief\.audioPath \|\| ""/.test(script), "Main flow must resolve provided audio from CLI args and brief fields.", failures);
  expect(/const requestedVoiceBackend = providedAudioPath\s*\?\s*"provided_audio"\s*:\s*args\["voice-backend"\] \|\| brief\.voiceBackend \|\| runtimeDefaults\.voiceBackend \|\| "auto"/.test(script), "Provided audio must force requestedVoiceBackend to provided_audio; absent audio must fall back to configured voice backend/auto.", failures);
  expect(/providedAudio:\s*providedAudioPath/.test(script), "Main flow must pass providedAudio into generateAudio().", failures);
  expect(/providedAudioTrimStart/.test(script) && /providedAudioTrimEnd/.test(script), "Provided audio trim start/end must be supported.", failures);

  const providedBranch = indexOfRequired(script, "if (providedAudioPath) {", failures);
  const reuseBranch = indexOfRequired(script, 'if (process.env.CODEX_VIDEO_REUSE_AUDIO === "1")', failures);
  const ttsOrder = indexOfRequired(script, "const order = voiceBackendOrder(voiceBackend, allowSayFallback);", failures);
  expect(providedBranch < reuseBranch && providedBranch < ttsOrder, "Provided-audio branch must run before reuse/TTS backend selection.", failures);

  expect(/throw new Error\(`--provided-audio not found:/.test(script), "Missing provided audio must fail immediately.", failures);
  expect(/copyFileSync\(providedAudioPath, sourceCopy\)/.test(script), "Provided audio must be copied into the package.", failures);
  expect(/trimStart = Math\.max\(0, Number\(providedAudioTrimStart/.test(script), "Provided audio trim start must be clamped.", failures);
  expect(/trimEnd = Math\.max\(0, Number\(providedAudioTrimEnd/.test(script), "Provided audio trim end must be clamped.", failures);
  expect(/FINAL_AUDIO_DELIVERY_FILTER/.test(script), "Provided and generated audio must use the final delivery normalization filter.", failures);
  expect(/voiceBackend:\s*"provided_audio"/.test(script), "Provided audio manifest/return must record voiceBackend provided_audio.", failures);
  expect(/authorizedByUser:\s*true/.test(script), "Provided audio manifest must record user authorization.", failures);
  expect(/segmentTimingSource:\s*"provided_audio_estimated_subtitle_cue_segments"/.test(script), "Provided audio must bind subtitle cue timing by estimated cue segments.", failures);
  expect(/Final duration follows the authorized provided audio/.test(script), "Provided audio timing policy must make final duration follow the provided audio.", failures);

  expect(/function voiceBackendOrder/.test(script), "Generated-audio branch must keep voiceBackendOrder().", failures);
  expect(/if \(requested === "auto"\) order = \["cosyvoice_local", "melotts_local"\]/.test(script), "No-audio auto mode must try CosyVoice then MeloTTS.", failures);
  expect(/generateWithCosyVoice/.test(script) && /generateWithMeloTTS/.test(script), "No-audio branch must call local CosyVoice/MeloTTS generators.", failures);
  expect(/Refusing non-local-TTS fallback by default/.test(script), "No-audio branch must refuse non-local fallback by default.", failures);
  expect(/voiceBackendCompliant:[\s\S]*\["cosyvoice_local", "melotts_local"\][\s\S]*voiceBackend === "provided_audio" && voiceManifest\.providedAudio\?\.authorizedByUser === true/.test(script), "QC must accept only local TTS or authorized provided audio.", failures);
  expect(/--audio is required for render-ip-diagram-native-pages\.mjs/.test(nativeRenderer), "Native IP diagram renderer must require prebuilt audio and point no-audio runs back to the main voice chain.", failures);
  expect(/local CosyVoice\/MeloTTS creates the narration package/.test(nativeRenderer), "Native IP diagram renderer missing no-audio guidance for generated narration.", failures);

  expect(/Use the supplied audio file exactly as the narration source when `--provided-audio`, `--audio`, `brief\.providedAudio`, or `brief\.audioPath` is present/.test(skill), "SKILL.md must document provided-audio priority.", failures);
  expect(/When no supplied audio file is present, generate narration through the skill voice chain/.test(skill), "SKILL.md must document no-audio TTS fallback.", failures);
  expect(/提供音频/.test(readmeZh) && /未提供音频/.test(readmeZh), "README.zh-CN.md must document provided/no-audio behavior.", failures);

  mkdirSync(outDir, { recursive: true });
  const report = {
    ok: failures.length === 0,
    policy: {
      providedAudioPriority: true,
      providedAudioBackend: "provided_audio",
      noProvidedAudioBackend: "auto -> cosyvoice_local -> melotts_local",
      finalAudioNormalizationRequired: true,
      qcAllows: ["provided_audio with authorizedByUser", "cosyvoice_local", "melotts_local"],
    },
    checkedFiles: [
      "scripts/poc-video-workflow.mjs",
      "scripts/render-ip-diagram-native-pages.mjs",
      "SKILL.md",
      "README.zh-CN.md",
    ],
    failures,
  };
  writeFileSync(join(outDir, "audio-source-routing-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
