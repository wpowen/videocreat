#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  validateContextImage2PromptParity,
  validateCoverRequestScopeContract,
} from "./lib/cover-generation-workflow.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const out = resolve(argValue("--out", ""));
const allowPending = process.argv.includes("--allow-pending");
const failures = [];
if (!argValue("--out", "")) failures.push("--out <package> is required");

const requestPath = join(out, "workflow", "context-image2-cover-requests.json");
const contractPath = join(out, "workflow", "cover-generation-workflow.json");
const selectionPath = join(out, "workflow", "cover-size-selection.json");
const coverQcPath = join(out, "workflow", "cover-image2-qc.json");
const promptsPath = join(out, "workflow", "cover-image2-prompts.json");
const generationRunPath = join(out, "workflow", "cover-generation-run.json");
for (const [label, path] of [
  ["request manifest", requestPath],
  ["standalone workflow contract", contractPath],
  ["cover size selection", selectionPath],
  ["cover Image2 QC", coverQcPath],
  ["cover Image2 prompt plan", promptsPath],
]) {
  if (!existsSync(path)) failures.push(`${label} is missing: ${path}`);
}

let manifest = {};
let workflowContract = {};
let parity = { pass: false, checkedRequestCount: 0, failures: ["request manifest missing"] };
let completedRequestCount = 0;
let pendingRequestCount = 0;
let scopeContract = { pass: false, plannedTargetCount: 0, requestedTargetCount: 0, actualTargetCount: 0, failures: ["request or prompt plan missing"] };
if (existsSync(requestPath)) {
  manifest = readJson(requestPath);
  parity = validateContextImage2PromptParity({ topicDir: out, manifest });
  failures.push(...parity.failures);
  const requests = Array.isArray(manifest.requests) ? manifest.requests : [];
  completedRequestCount = requests.filter((request) => request.status === "completed").length;
  pendingRequestCount = requests.length - completedRequestCount;
  if (!requests.length) failures.push("request manifest contains no platform cover targets");
  for (const request of requests.filter((item) => item.status === "completed")) {
    if (!request.actualOutput || !existsSync(join(out, request.actualOutput))) {
      failures.push(`${request.targetId}: completed request output is missing`);
    }
    if (request.inspectionPassed !== true) failures.push(`${request.targetId}: completed request lacks passed inspection evidence`);
    if (!request.generationReceiptPath || !existsSync(join(out, request.generationReceiptPath))) {
      failures.push(`${request.targetId}: generation receipt is missing`);
    }
    if (!request.inspectionRecordPath || !existsSync(join(out, request.inspectionRecordPath))) {
      failures.push(`${request.targetId}: inspection record is missing`);
    }
  }
  if (!allowPending && pendingRequestCount > 0) failures.push(`${pendingRequestCount} cover request(s) remain pending`);
  if (existsSync(promptsPath)) {
    scopeContract = validateCoverRequestScopeContract({ manifest, coverImage2Prompts: readJson(promptsPath) });
    failures.push(...scopeContract.failures);
  }
}
if (existsSync(contractPath)) {
  workflowContract = readJson(contractPath);
  const manifestCoversVerified = manifest.allRequestedPlatformUploadCoversReady === true && pendingRequestCount === 0;
  const expectedWorkflowStatus = manifestCoversVerified ? "covers_verified" : workflowContract.coversGenerated === true ? "covers_generated" : manifest.status;
  if (workflowContract.status !== expectedWorkflowStatus) failures.push("standalone workflow status disagrees with the request manifest and generation milestone");
  if (workflowContract.coversVerified !== manifestCoversVerified) failures.push("standalone workflow coversVerified disagrees with the request manifest");
  if (manifestCoversVerified && workflowContract.coversGenerated !== true) failures.push("verified cover workflow is missing coversGenerated=true");
  if (Number(workflowContract.completedRequestCount) !== completedRequestCount) failures.push("standalone workflow completed count disagrees with the request manifest");
  if (Number(workflowContract.pendingRequestCount) !== pendingRequestCount) failures.push("standalone workflow pending count disagrees with the request manifest");
  if (workflowContract.requestScopeMode !== scopeContract.mode) failures.push("standalone workflow request scope mode disagrees with the request manifest");
  if (Number(workflowContract.plannedTargetCount) !== scopeContract.plannedTargetCount) failures.push("standalone workflow planned target count disagrees with the prompt plan");
  if (Number(workflowContract.requestedTargetCount) !== scopeContract.requestedTargetCount) failures.push("standalone workflow requested target count disagrees with the request manifest");
  if (workflowContract.requestScopeAuthorizationPass !== true) failures.push("standalone workflow request scope authorization is not valid");
}
if (existsSync(generationRunPath)) {
  const generationRun = readJson(generationRunPath);
  const plannedDispatchTargets = Array.isArray(readJson(join(out, "workflow", "cover-image2-dispatch-plan.json")).pendingTargetIds)
    ? readJson(join(out, "workflow", "cover-image2-dispatch-plan.json")).pendingTargetIds
    : [];
  const generatedTargets = Array.isArray(generationRun.generatedTargetIds) ? generationRun.generatedTargetIds : [];
  if (generationRun.coversGenerated === true && generatedTargets.length !== plannedDispatchTargets.length) {
    failures.push("generation run claims coversGenerated without every prepared pending target");
  }
  if (generationRun.coversVerified === true && pendingRequestCount !== 0) {
    failures.push("generation run claims coversVerified while canonical requests remain pending");
  }
}

if (!allowPending && existsSync(selectionPath)) {
  const selection = readJson(selectionPath);
  if (selection.primaryPlatformUploadCoverReady !== true) failures.push("primary platform cover is not upload-ready in cover-size-selection");
}
if (!allowPending && existsSync(coverQcPath)) {
  const coverQc = readJson(coverQcPath);
  if (coverQc.platformSubmissionCoverReady !== true) failures.push("platform cover is not ready in cover-image2-qc");
}

const deliveryPath = join(out, "delivery-manifest.json");
const logQcPath = join(out, "logs", "qc.json");
if (!allowPending && existsSync(deliveryPath)) {
  const delivery = readJson(deliveryPath);
  if (delivery.coverStatus?.platformSubmissionCoverReady !== true) failures.push("delivery coverStatus is stale or not ready");
  if (existsSync(logQcPath)) {
    const logQc = readJson(logQcPath);
    if (delivery.publishingReady !== logQc.publishingReady) failures.push("delivery publishingReady disagrees with logs/qc.json");
  }
}

const result = {
  pass: failures.length === 0,
  allowPending,
  out,
  completedRequestCount,
  pendingRequestCount,
  promptParityPass: parity.pass,
  checkedPromptCount: parity.checkedRequestCount,
  plannedTargetCount: scopeContract.plannedTargetCount,
  requestedTargetCount: scopeContract.requestedTargetCount,
  requestScopePass: scopeContract.pass,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
