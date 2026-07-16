#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const analyzer = join(scriptDir, "analyze-chinese-pronunciation.py");
const python = join(skillRoot, "research", "voice-quality-poc", "melotts", ".venv", "bin", "python");
const baseLexicon = join(skillRoot, "assets", "chinese-polyphone-phrases.json");
const workflowScript = readFileSync(join(scriptDir, "poc-video-workflow.mjs"), "utf8");
const pronunciationReference = readFileSync(join(skillRoot, "references", "chinese-pronunciation-control.md"), "utf8");
const qualityGates = readFileSync(join(skillRoot, "references", "quality-gates.md"), "utf8");
const tempRoot = mkdtempSync(join(tmpdir(), "codex-video-pronunciation-"));
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function analyze(name, text, { overrides = [], allowUnresolved = false } = {}) {
  const textPath = join(tempRoot, `${name}.txt`);
  const overridesPath = join(tempRoot, `${name}.overrides.json`);
  const outputPath = join(tempRoot, `${name}.json`);
  writeFileSync(textPath, text, "utf8");
  writeFileSync(overridesPath, `${JSON.stringify({ pronunciations: overrides }, null, 2)}\n`, "utf8");
  const result = spawnSync(python, [
    analyzer,
    "--text-file", textPath,
    "--base-lexicon", baseLexicon,
    "--overrides", overridesPath,
    "--output", outputPath,
    ...(allowUnresolved ? ["--allow-unresolved"] : []),
  ], { cwd: skillRoot, encoding: "utf8" });
  const report = result.status === 0 || result.status === 2
    ? JSON.parse(readFileSync(outputPath, "utf8"))
    : null;
  return { result, report };
}

try {
  const title = analyze("title", "《凡人修仙传》。凡人修仙传。人物传记。");
  expect(title.result.status === 0, `title preflight should pass: ${title.result.stderr || title.result.stdout}`);
  expect(title.report?.ok === true, "title preflight report should be ok");
  expect(Array.isArray(title.report?.phrases) && title.report.phrases.length > 0, "analyzer output must expose a synthesis-ready phrases array");
  expect(JSON.stringify(title.report?.phrases) === JSON.stringify(title.report?.effectiveEntries), "synthesis-ready phrases must exactly match effectiveEntries");
  const titleMatches = title.report?.phraseMatches?.filter((item) => item.phrase === "凡人修仙传") || [];
  expect(titleMatches.length === 2, `expected two title matches, got ${titleMatches.length}`);
  expect(titleMatches.every((item) => item.pinyin.at(-1) === "zhuan4"), "凡人修仙传 must resolve 传 as zhuan4");
  expect(title.report?.unresolved?.length === 0, "resolved title article must not contain unresolved polyphones");
  const titleFrontend = title.report?.meloFrontendValidation?.find((item) => item.phrase === "凡人修仙传");
  expect(titleFrontend?.status === "passed", "凡人修仙传 must pass the real MeloTTS frontend probe");
  expect(titleFrontend?.tones?.includes(4), "MeloTTS frontend verification must contain fourth-tone phones for 凡人修仙传");

  const ordinary = analyze("ordinary-context", "《红楼梦》里的林黛玉，很多时候嘴上问的只是一件小事：你刚才去了哪里？这件东西是谁送的？");
  expect(ordinary.result.status === 0, `ordinary contextual Chinese must not be blocked by obscure standalone dictionary readings: ${ordinary.result.stderr || ordinary.result.stdout}`);
  expect(ordinary.report?.unresolved?.length === 0, "ordinary contextual Chinese must not create unresolved reviewed-risk polyphones");
  expect(Number(ordinary.report?.counts?.ignoredHeteronymOccurrencesOutsideReviewedRiskSet || 0) > 0, "ordinary contextual Chinese should audit ignored unreviewed heteronym occurrences");

  const override = analyze("override", "凡人修仙传", {
    overrides: [{ phrase: "凡人修仙传", pinyin: ["fan2", "ren2", "xiu1", "xian1", "chuan2"], note: "test override" }],
  });
  expect(override.result.status === 0, `override preflight should pass: ${override.result.stderr || override.result.stdout}`);
  expect(override.report?.phraseMatches?.[0]?.source === "run-override", "run override must take priority over base lexicon");
  expect(override.report?.phraseMatches?.[0]?.pinyin?.at(-1) === "chuan2", "run override pronunciation must be applied");

  const unresolved = analyze("unresolved", "传。", { allowUnresolved: true });
  expect(unresolved.result.status === 0, `allow-unresolved probe should complete: ${unresolved.result.stderr || unresolved.result.stdout}`);
  expect(unresolved.report?.ok === false, "standalone ambiguous polyphone must remain unresolved");
  expect(unresolved.report?.unresolved?.some((item) => item.character === "传"), "unresolved report must identify 传");

  const strict = analyze("strict", "传。");
  expect(strict.result.status === 2, `strict unresolved preflight must exit 2, got ${strict.result.status}`);
  expect(strict.report?.blocking === true, "strict unresolved report must be blocking");

  const preflightIndex = workflowScript.indexOf("runChinesePronunciationPreflight({");
  const segmentationIndex = workflowScript.indexOf("const narrationSegments = frameNarrationSegments", preflightIndex);
  const ttsMatch = workflowScript.slice(segmentationIndex).match(/(?:const|let)?\s*audio\s*=\s*await generateAudio\(/);
  const ttsIndex = ttsMatch ? segmentationIndex + ttsMatch.index : -1;
  expect(preflightIndex >= 0 && preflightIndex < segmentationIndex && segmentationIndex < ttsIndex, "whole-document pronunciation preflight must run before segmentation and TTS");
  expect(/jieba\.add_word\(phrase, freq=10\*\*9/.test(workflowScript), "MeloTTS adapter must inject controlled phrases into jieba as well as pypinyin");
  expect(/if not phrases:[\s\S]*pronunciation plan contains no synthesis-ready phrases/.test(workflowScript), "MeloTTS adapter must reject a supplied pronunciation plan whose phrases array is empty");
  expect(/if \(pronunciationPlan && !phrases\.length\)[\s\S]*effective pronunciation plan contains no synthesis-ready phrases/.test(workflowScript), "workflow must reject an empty effective pronunciation plan before launching MeloTTS");
  expect(/loadedPronunciationEntries[\s\S]*loadedPronunciationHash[\s\S]*pronunciationLoaderActive/.test(workflowScript), "application verification must record actual loaded entry count, hash, and active loader status");
  expect(/pronunciation plan was not applied to synthesis/.test(workflowScript), "workflow must fail after synthesis if the selected backend cannot prove that it applied the locked plan");
  expect(/top-level `phrases` array must exist[\s\S]*must exactly match the analyzed `effectiveEntries`/.test(pronunciationReference), "pronunciation reference must define the synthesis-ready phrases contract");
  expect(/pronunciationLoaderActive: true[\s\S]*loadedPronunciationEntries > 0[\s\S]*loadedPronunciationHash/.test(pronunciationReference), "pronunciation reference must define loader application evidence");
  expect(/empty plan[\s\S]*hash mismatch[\s\S]*inactive loader/.test(qualityGates), "quality gates must block silent pronunciation-plan bypasses");
  expect(/if \(pronunciationPlan\?\.requiresMeloTts\)[\s\S]*order = \["melotts_local"\]/.test(workflowScript), "controlled Chinese pronunciation must lock auto routing to MeloTTS");
  expect(/existingManifest\.pronunciationPlanHash !== pronunciationPlan\.effectivePronunciationHash/.test(workflowScript), "audio reuse must reject a changed pronunciation plan hash");
  expect(/pronunciationPlanHash: pronunciationPlan\?\.effectivePronunciationHash/.test(workflowScript), "voice manifest must record the effective pronunciation plan hash");
  expect(/function buildProvidedAudioPronunciationLineage\(/.test(workflowScript), "provided workflow audio must build a pronunciation lineage artifact");
  expect(/provided-audio-pronunciation-lineage\.json/.test(workflowScript), "provided workflow audio must persist pronunciation lineage evidence");
  expect(/pronunciationStrictPreflightPassed/.test(workflowScript), "final QC must hard-gate strict generated-TTS pronunciation evidence");
  expect(/allowUnresolvedPronunciationsUsed/.test(workflowScript), "allow-unresolved pronunciation runs must be exposed to final QC as degraded");

  const report = {
    ok: failures.length === 0,
    analyzer: "scripts/analyze-chinese-pronunciation.py",
    python: "research/voice-quality-poc/melotts/.venv/bin/python",
    cases: ["full-article-title", "ordinary-context-no-false-positive", "synthesis-plan-contract", "run-override-priority", "unresolved-audit", "strict-block", "workflow-order", "backend-lock", "cache-reuse-gate"],
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
