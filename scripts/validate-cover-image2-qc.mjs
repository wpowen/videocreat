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
  const requireAllPlatformCovers = process.argv.includes("--require-all-platform-covers");
  const failures = [];
  const warnings = [];
  const qcPath = join(out, "workflow", "cover-image2-qc.json");
  const promptsPath = join(out, "workflow", "cover-image2-prompts.json");
  const designPath = join(out, "workflow", "cover-design.json");
  const requestPath = join(out, "workflow", "context-image2-cover-requests.json");
  const selectionPath = join(out, "workflow", "cover-size-selection.json");

  expect(existsSync(qcPath), "missing workflow/cover-image2-qc.json", failures);
  expect(existsSync(promptsPath), "missing workflow/cover-image2-prompts.json", failures);
  expect(existsSync(designPath), "missing workflow/cover-design.json", failures);
  expect(existsSync(requestPath), "missing workflow/context-image2-cover-requests.json", failures);
  expect(existsSync(selectionPath), "missing workflow/cover-size-selection.json", failures);
  if (failures.length) {
    console.log(JSON.stringify({ ok: false, out, failures, warnings }, null, 2));
    process.exit(1);
  }

  const qc = readJson(qcPath);
  const prompts = readJson(promptsPath);
  const design = readJson(designPath);
  const requests = readJson(requestPath);
  const selection = readJson(selectionPath);
  const promptAssessments = Array.isArray(qc.promptAssessments) ? qc.promptAssessments : [];
  const promptItems = Array.isArray(prompts.prompts) ? prompts.prompts : [];
  const promptTargetId = (value) => String(value || "").replace(/-image2-integrated-cover$/, "");
  const promptTargetIds = promptItems.map((item) => promptTargetId(item.targetId));
  const assessmentTargetIds = promptAssessments.map((item) => promptTargetId(item.targetId));
  const plannedPromptCount = Number(requests.requestCountContract?.plannedTargetCount || promptItems.length);

  expect(qc.version === "cover-image2-qc-v2-integrated-typography", "unexpected cover image2 qc version", failures);
  expect(qc.promptQualityPass === true, "cover Image 2 prompt quality did not pass", failures);
  expect(promptItems.length === plannedPromptCount, "Image 2 prompt plan does not cover every planned platform target", failures);
  expect(promptAssessments.length === promptItems.length, "prompt assessments do not cover every Image 2 prompt", failures);
  expect(promptTargetIds.every((targetId) => assessmentTargetIds.includes(targetId))
    && assessmentTargetIds.every((targetId) => promptTargetIds.includes(targetId)), "prompt assessment target ids differ from the prompt plan", failures);
  expect(promptItems.every((item) => String(item.prompt || "").length <= 4500), "one or more Image 2 prompts exceed the 4500-character production limit", failures);
  expect(promptItems.every((item) => item.coverArtDirectionSystem?.methodologyVersion === "cover-art-direction-system-v1"
    && item.coverArtDirectionSystem?.selectedStyleCount === 1
    && item.coverArtDirectionStyle?.id === item.coverArtDirectionSystem?.selectedStyle?.id
    && item.platformStrategy?.colorSystem?.methodologyVersion === "cover-semantic-color-system-v1"
    && item.platformStrategy?.colorSystem?.semanticFamilyId
    && item.platformStrategy?.colorSystem?.surfaceMode
    && item.platformStrategy?.colorSystem?.backgroundPolicy), "one or more Image 2 prompts lack target-bound art-direction or semantic-color evidence", failures);
  expect(promptAssessments.every((item) => item.pass === true && Number(item.score || 0) >= 88), "one or more prompt assessments failed score threshold", failures);
  expect(design.coverImage2QualityGateFile === "workflow/cover-image2-qc.json", "cover-design.json does not reference cover-image2-qc.json", failures);
  expect(prompts.promptQualityGateFile === "workflow/cover-image2-qc.json", "cover-image2-prompts.json does not reference cover-image2-qc.json", failures);
  expect(Array.isArray(qc.requiredVisualBars) && qc.requiredVisualBars.length >= 5, "missing required visual quality bars", failures);
  expect(requests.purpose === "platform-submission-cover", "cover requests must represent standalone platform submission covers", failures);
  expect(requests.videoInternalCoverDoesNotSatisfyRequest === true, "in-video cover must not satisfy platform submission cover generation", failures);
  expect(typeof requests.primaryPlatformUploadCoverTargetId === "string" && requests.primaryPlatformUploadCoverTargetId.length > 0, "missing primary platform upload cover target", failures);

  expect(qc.integratedTypographyRequired === true, "cover Image 2 QC must require integrated typography", failures);
  if (qc.integratedTypographyAssetPresent !== true) {
    const message = "cover package is missing an approved Image 2/Codex integrated-typography cover asset";
    if (allowReviewFallback && (qc.reviewFallbackOnly === true || qc.finalCoverQualityEligible !== true)) warnings.push(message);
    else failures.push(message);
  }

  const primarySubmissionCoverReady = qc.primaryPlatformUploadCoverReady === true
    && qc.platformSubmissionCoverReady === true;
  if (!primarySubmissionCoverReady) {
    const message = "cover package is review-only because the primary standalone platform submission cover is not ready";
    if (allowReviewFallback) warnings.push(message);
    else failures.push(message);
  } else if (qc.finalCoverQualityEligible !== true) {
    const message = "primary platform submission cover is ready, but additional requested platform sizes remain pending";
    if (requireAllPlatformCovers) failures.push(message);
    else warnings.push(message);
  }
  expect(selection.primaryPlatformUploadCoverReady === true || allowReviewFallback, "cover selection does not expose an upload-ready primary platform cover", failures);

  const report = {
    ok: failures.length === 0,
    out,
    allowReviewFallback,
    requireAllPlatformCovers,
    primaryPlatformUploadCoverReady: primarySubmissionCoverReady,
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
