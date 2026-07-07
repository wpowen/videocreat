#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const out = resolve(argValue("--out", process.cwd()));
  const allowReviewFallback = process.argv.includes("--allow-review-fallback");
  const failures = [];
  const warnings = [];
  const qcPath = join(out, "workflow", "cover-image2-qc.json");
  const promptsPath = join(out, "workflow", "cover-image2-prompts.json");
  const designPath = join(out, "workflow", "cover-design.json");

  expect(existsSync(qcPath), "missing workflow/cover-image2-qc.json", failures);
  expect(existsSync(promptsPath), "missing workflow/cover-image2-prompts.json", failures);
  expect(existsSync(designPath), "missing workflow/cover-design.json", failures);
  if (failures.length) {
    console.log(JSON.stringify({ ok: false, out, failures, warnings }, null, 2));
    process.exit(1);
  }

  const qc = readJson(qcPath);
  const prompts = readJson(promptsPath);
  const design = readJson(designPath);
  const promptAssessments = Array.isArray(qc.promptAssessments) ? qc.promptAssessments : [];
  const promptItems = Array.isArray(prompts.prompts) ? prompts.prompts : [];

  expect(qc.version === "cover-image2-qc-v2-integrated-typography", "unexpected cover image2 qc version", failures);
  expect(qc.promptQualityPass === true, "cover Image 2 prompt quality did not pass", failures);
  expect(promptAssessments.length >= 5, "expected prompt assessments for common platform cover targets", failures);
  expect(promptItems.length >= 5, "expected Image 2 prompts for common platform cover targets", failures);
  expect(promptAssessments.every((item) => item.pass === true && Number(item.score || 0) >= 88), "one or more prompt assessments failed score threshold", failures);
  expect(design.coverImage2QualityGateFile === "workflow/cover-image2-qc.json", "cover-design.json does not reference cover-image2-qc.json", failures);
  expect(prompts.promptQualityGateFile === "workflow/cover-image2-qc.json", "cover-image2-prompts.json does not reference cover-image2-qc.json", failures);
  expect(Array.isArray(qc.requiredVisualBars) && qc.requiredVisualBars.length >= 5, "missing required visual quality bars", failures);

  expect(qc.integratedTypographyRequired === true, "cover Image 2 QC must require integrated typography", failures);
  if (qc.integratedTypographyAssetPresent !== true) {
    const message = "cover package is missing an approved Image 2/Codex integrated-typography cover asset";
    if (allowReviewFallback && (qc.reviewFallbackOnly === true || qc.finalCoverQualityEligible !== true)) warnings.push(message);
    else failures.push(message);
  }

  if (qc.reviewFallbackOnly === true || qc.finalCoverQualityEligible !== true) {
    const message = "cover package is review-only because no approved real Image 2/Codex integrated-typography cover is bound";
    if (allowReviewFallback) warnings.push(message);
    else failures.push(message);
  }

  const report = {
    ok: failures.length === 0,
    out,
    allowReviewFallback,
    promptQualityPass: qc.promptQualityPass,
    bitmapSubjectPresent: qc.bitmapSubjectPresent,
    finalCoverQualityEligible: qc.finalCoverQualityEligible,
    reviewFallbackOnly: qc.reviewFallbackOnly,
    promptAssessmentCount: promptAssessments.length,
    blockers: qc.blockers || [],
    failures,
    warnings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
