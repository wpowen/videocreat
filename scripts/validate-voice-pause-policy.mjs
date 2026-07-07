#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const outDir = join(workspace, "research/codex-video-workflow-poc/voice-pause-policy-validation");

function read(relativePath) {
  return readFileSync(join(skillRoot, relativePath), "utf8");
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const failures = [];
  const script = read("scripts/poc-video-workflow.mjs");
  const skill = read("SKILL.md");
  const voiceDirection = read("references/voice-direction.md");
  const methodology = read("references/methodology.md");
  const qualityGates = read("references/quality-gates.md");
  const readme = read("README.md");

  expect(/SHORT_PUNCTUATION_PAUSE_SECONDS\s*=\s*0\.5/.test(script), "script must define comma short pause as 0.5s", failures);
  expect(/SENTENCE_END_PAUSE_SECONDS\s*=\s*"tts-default"/.test(script), "script must keep sentence-end pause on TTS default", failures);
  expect(/commaLikeSeconds:\s*SHORT_PUNCTUATION_PAUSE_SECONDS/.test(script), "voice direction must record commaLikeSeconds", failures);
  expect(/sentenceEnd:\s*SENTENCE_END_PAUSE_SECONDS/.test(script), "voice direction must record sentenceEnd default", failures);
  expect(/commaLikePunctuation:\s*\["，", ",", "、"\]/.test(script), "voice direction must list comma-like punctuation", failures);
  expect(/hasLineBreakAfterComma/.test(script), "QC must reject comma-to-line-break conversion", failures);
  const splitSentencesBody = script.match(/function\s+splitSentences\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const legacySentencePattern = splitSentencesBody.match(/const pattern = \/([^/]+)\/gu;/)?.[1] || "";
  const terminatorTestPattern = splitSentencesBody.match(/!\s*\/([^/]+)\/u\.test\(char\)/)?.[1] || "";
  const sentenceSplitPattern = legacySentencePattern || terminatorTestPattern;
  const hasDotTerminatorGuard = /char\s*!==\s*"\."/u.test(splitSentencesBody);
  expect(/function\s+splitSemanticCueTexts/.test(script), "script must define semantic subtitle cue splitting", failures);
  expect(Boolean(sentenceSplitPattern), "script must define sentence splitting by terminal punctuation", failures);
  expect(/[。！？]/.test(sentenceSplitPattern) && /[!?]/.test(sentenceSplitPattern) && hasDotTerminatorGuard, "sentence splitting must include Chinese and English terminal punctuation", failures);
  expect(!/[，,、]/.test(sentenceSplitPattern), "sentence splitting must not include comma-like punctuation", failures);

  for (const [name, content] of [
    ["SKILL.md", skill],
    ["references/voice-direction.md", voiceDirection],
    ["references/methodology.md", methodology],
    ["references/quality-gates.md", qualityGates],
    ["README.md", readme],
  ]) {
    expect(/0\.5s|0\.5/.test(content), `${name} must document the 0.5s comma pause`, failures);
    expect(/comma|逗号|Comma-like/.test(content), `${name} must document comma-like punctuation behavior`, failures);
    expect(/sentence-ending|句末|sentenceEnd|backend\/default|默认/.test(content), `${name} must document sentence-ending default behavior`, failures);
  }

  mkdirSync(outDir, { recursive: true });
  const report = {
    ok: failures.length === 0,
    policy: {
      commaLikeSeconds: 0.5,
      sentenceEnd: "tts-default",
      commaLikePunctuation: ["，", ",", "、"],
      mustNotSplitAtComma: true,
    },
    checkedFiles: [
      "scripts/poc-video-workflow.mjs",
      "SKILL.md",
      "references/voice-direction.md",
      "references/methodology.md",
      "references/quality-gates.md",
      "README.md",
    ],
    failures,
  };
  writeFileSync(join(outDir, "voice-pause-policy-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
