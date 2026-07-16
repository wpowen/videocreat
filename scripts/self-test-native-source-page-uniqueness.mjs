#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = mkdtempSync(join(tmpdir(), "native-source-page-uniqueness-"));
const sourceDir = join(root, "sources");
const outDir = join(root, "native-pages");
const jobsPath = join(root, "jobs.json");
const png = (seed) => {
  const header = Buffer.alloc(24);
  header.writeUInt32BE(0x89504e47, 0);
  header.writeUInt32BE(1600, 16);
  header.writeUInt32BE(900, 20);
  return Buffer.concat([header, Buffer.from([seed])]);
};

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

try {
  mkdirSync(sourceDir, { recursive: true });
  const personaDir = join(root, "persona");
  mkdirSync(personaDir, { recursive: true });
  const mainAnchorPath = join(personaDir, "main-anchor.png");
  const personaManifestPath = join(personaDir, "manifest.json");
  writeFileSync(mainAnchorPath, png(9));
  writeFileSync(personaManifestPath, JSON.stringify({
    schemaVersion: 1,
    personaId: "self-test-persona",
    status: "main-anchor-ready",
    activeVersion: "v1",
    assets: { mainAnchor: "main-anchor.png" },
    versions: { v1: { mainAnchor: "main-anchor.png", status: "active" } },
  }));
  const sourceBuffers = [png(1), png(2), png(3)];
  writeFileSync(join(sourceDir, "01.png"), sourceBuffers[0]);
  writeFileSync(join(sourceDir, "02.png"), sourceBuffers[1]);
  const jobs = [
    { jobId: "job-1", requestId: "request-1", prompt: "Draw the first distinct teaching page." },
    { jobId: "job-2", requestId: "request-2", prompt: "Draw the second distinct teaching page." },
    { jobId: "job-3", requestId: "request-3", prompt: "Draw the third distinct teaching page." },
  ];
  for (const job of jobs) {
    job.fixedPersonaManifest = personaManifestPath;
    job.contextImages = [{ role: "main-anchor", path: mainAnchorPath, required: true }];
  }
  writeFileSync(jobsPath, JSON.stringify({ fixedPersonaManifest: personaManifestPath, jobs }));
  const script = fileURLToPath(new URL("./ingest-native-imagegen-page-set.mjs", import.meta.url));
  const finalArgs = [
    script,
    "--jobs", jobsPath,
    "--source-dir", sourceDir,
    "--out", outDir,
    "--target-count", "3",
    "--persona-manifest", personaManifestPath,
    "--persona-reference-bound", "true",
  ];
  const blocked = spawnSync(process.execPath, finalArgs, { encoding: "utf8" });
  assert.notEqual(blocked.status, 0, "ingest must reject fewer unique sources than planned pages");
  assert.match(`${blocked.stdout}\n${blocked.stderr}`, /refused to reuse source images/i);

  writeFileSync(join(sourceDir, "03.png"), sourceBuffers[2]);
  const unreceipted = spawnSync(process.execPath, [
    script,
    "--jobs", jobsPath,
    "--source-dir", sourceDir,
    "--out", join(root, "unreceipted-out"),
    "--target-count", "3",
    "--persona-manifest", personaManifestPath,
    "--persona-reference-bound", "true",
  ], { encoding: "utf8" });
  assert.notEqual(unreceipted.status, 0, "final ingest must validate dispatch-time generation receipts instead of inventing them from sorted files");
  assert.match(`${unreceipted.stdout}\n${unreceipted.stderr}`, /generation receipt/i);

  const recorder = fileURLToPath(new URL("./record-native-imagegen-page-result.mjs", import.meta.url));
  const missingPersonaReceipt = spawnSync(process.execPath, [
    recorder,
    "--jobs", jobsPath,
    "--job-id", jobs[0].jobId,
    "--request-id", jobs[0].requestId,
    "--source", join(sourceDir, "01.png"),
    "--persona-manifest", join(root, "missing-persona", "manifest.json"),
    "--persona-reference-bound", "true",
    "--inspection-status", "passed-vision-review",
    "--inspector-type", "vision",
  ], { encoding: "utf8" });
  assert.notEqual(missingPersonaReceipt.status, 0, "receipt recording must reject a missing persona manifest");
  assert.match(`${missingPersonaReceipt.stdout}\n${missingPersonaReceipt.stderr}`, /persona manifest.*not found/i);
  const concurrentJobsPath = join(root, "concurrent-jobs.json");
  const concurrentJobs = Array.from({ length: 8 }, (_, index) => ({
    jobId: `concurrent-${index + 1}`,
    requestId: `concurrent-request-${index + 1}`,
    prompt: `Draw distinct concurrent teaching page ${index + 1}.`,
    fixedPersonaManifest: personaManifestPath,
    contextImages: [{ role: "main-anchor", path: mainAnchorPath, required: true }],
  }));
  writeFileSync(concurrentJobsPath, JSON.stringify({ fixedPersonaManifest: personaManifestPath, jobs: concurrentJobs }));
  const concurrentResults = await Promise.all(concurrentJobs.map((job, index) => runNode([
    recorder,
    "--jobs", concurrentJobsPath,
    "--job-id", job.jobId,
    "--request-id", job.requestId,
    "--source", join(sourceDir, `${String((index % 3) + 1).padStart(2, "0")}.png`),
    "--persona-reference-bound", "true",
    "--inspection-status", "passed-vision-review",
    "--inspector-type", "vision",
  ])));
  assert.equal(concurrentResults.every((result) => result.status === 0), true, JSON.stringify(concurrentResults, null, 2));
  const concurrentManifest = JSON.parse(readFileSync(concurrentJobsPath, "utf8"));
  assert.equal(concurrentManifest.jobs.filter((job) => job.generationReceipt).length, concurrentJobs.length, "concurrent receipt writers must not overwrite each other");

  for (let index = 0; index < jobs.length; index += 1) {
    const recorded = spawnSync(process.execPath, [
      recorder,
      "--jobs", jobsPath,
      "--job-id", jobs[index].jobId,
      "--request-id", jobs[index].requestId,
      "--source", join(sourceDir, `${String(index + 1).padStart(2, "0")}.png`),
      "--persona-reference-bound", "true",
      "--inspection-status", "passed-vision-review",
      "--inspector-type", "vision",
    ], { encoding: "utf8" });
    assert.equal(recorded.status, 0, `${recorded.stdout}\n${recorded.stderr}`);
  }

  const recordedBeforeInspectionFailure = JSON.parse(readFileSync(jobsPath, "utf8"));
  const missingInspectionPath = recordedBeforeInspectionFailure.jobs[0].inspectionRecordPath;
  rmSync(missingInspectionPath, { force: true });
  const missingInspection = spawnSync(process.execPath, finalArgs, { encoding: "utf8" });
  assert.notEqual(missingInspection.status, 0, "final ingest must reject a missing vision inspection record");
  assert.match(`${missingInspection.stdout}\n${missingInspection.stderr}`, /inspection/i);
  const restoredReceipt = spawnSync(process.execPath, [
    recorder,
    "--jobs", jobsPath,
    "--job-id", jobs[0].jobId,
    "--request-id", jobs[0].requestId,
    "--source", join(sourceDir, "01.png"),
    "--persona-reference-bound", "true",
    "--inspection-status", "passed-vision-review",
    "--inspector-type", "vision",
  ], { encoding: "utf8" });
  assert.equal(restoredReceipt.status, 0, `${restoredReceipt.stdout}\n${restoredReceipt.stderr}`);

  const passed = spawnSync(process.execPath, finalArgs, { encoding: "utf8" });
  assert.equal(passed.status, 0, `${passed.stdout}\n${passed.stderr}`);
  const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
  assert.equal(manifest.uniqueSourceImageCount, 3);
  assert.equal(manifest.sourceReusePolicy, "one-unique-source-per-final-page");
  assert.equal(manifest.content_pages.every((page) => page.distinctSourcePerPage === true), true);
  assert.equal(manifest.generationReceiptContract.complete, true);
  assert.equal(manifest.content_pages.every((page) => page.generationReceipt?.requestId && page.generationReceipt?.promptSha256 && page.generationReceipt?.outputSha256), true);
  assert.equal(new Set(manifest.content_pages.map((page) => page.generationReceipt.outputSha256)).size, 3);

  const mismatchedJobsPath = join(root, "mismatched-jobs.json");
  const recordedJobs = JSON.parse(readFileSync(jobsPath, "utf8")).jobs;
  writeFileSync(mismatchedJobsPath, JSON.stringify({ jobs: recordedJobs.slice(0, 2) }));
  const mismatchedJobs = spawnSync(process.execPath, [
    script,
    "--jobs", mismatchedJobsPath,
    "--source-dir", sourceDir,
    "--out", join(root, "mismatched-out"),
    "--target-count", "3",
    "--persona-manifest", personaManifestPath,
    "--persona-reference-bound", "true",
  ], { encoding: "utf8" });
  assert.notEqual(mismatchedJobs.status, 0, "ingest must reject a job count that differs from the planned page count");
  assert.match(`${mismatchedJobs.stdout}\n${mismatchedJobs.stderr}`, /job count.*planned page count/i);

  rmSync(join(sourceDir, "03.png"));
  const reuseWithoutDraft = spawnSync(process.execPath, [
    script,
    "--jobs", jobsPath,
    "--source-dir", sourceDir,
    "--out", join(root, "reuse-final-out"),
    "--target-count", "3",
    "--allow-source-reuse", "true",
    "--persona-manifest", personaManifestPath,
    "--persona-reference-bound", "true",
  ], { encoding: "utf8" });
  assert.notEqual(reuseWithoutDraft.status, 0, "source reuse must require an explicit draft output");
  assert.match(`${reuseWithoutDraft.stdout}\n${reuseWithoutDraft.stderr}`, /draft-only/i);

  const draftOut = join(root, "reuse-draft-out");
  const reuseDraft = spawnSync(process.execPath, [
    script,
    "--jobs", jobsPath,
    "--source-dir", sourceDir,
    "--out", draftOut,
    "--target-count", "3",
    "--allow-source-reuse", "true",
    "--allow-draft-output", "true",
    "--persona-manifest", personaManifestPath,
    "--persona-reference-bound", "true",
  ], { encoding: "utf8" });
  assert.equal(reuseDraft.status, 0, `${reuseDraft.stdout}\n${reuseDraft.stderr}`);
  const draftManifest = JSON.parse(readFileSync(join(draftOut, "manifest.json"), "utf8"));
  const draftPlan = JSON.parse(readFileSync(join(root, "workflow", "personal-ip-image-count-plan.json"), "utf8"));
  assert.equal(draftManifest.status, "draft-reused-source-pages");
  assert.equal(draftManifest.generationReceiptContract.complete, false);
  assert.equal(draftPlan.status, "draft");
  assert.equal(draftPlan.sourceImageCountPlanSatisfied, false);

  console.log(JSON.stringify({
    pass: true,
    rejectedUnderCount: true,
    rejectedJobCountMismatch: true,
    rejectedReuseWithoutDraft: true,
    rejectedMissingDispatchReceipts: true,
    rejectedMissingPersonaManifest: true,
    rejectedMissingInspectionRecord: true,
    concurrentReceiptWritesPreserved: true,
    draftReuseMarkedIncomplete: true,
    uniqueSourceImageCount: manifest.uniqueSourceImageCount,
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
