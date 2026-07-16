#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Missing value for ${key || "argument"}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
  }
  return args;
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function enabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function fileSha256(path) {
  return sha256Buffer(readFileSync(path));
}

function resolvePersonaContext({ args, document, entry, jobsPath }) {
  const manifestValue = String(args.personaManifest || entry.fixedPersonaManifest || document.fixedPersonaManifest || "").trim();
  if (!manifestValue) throw new Error("A real persona manifest is required in --persona-manifest or the request manifest.");
  const manifestPath = resolve(manifestValue);
  if (!existsSync(manifestPath)) throw new Error(`persona manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const anchorValue = String(manifest.assets?.mainAnchor || manifest.versions?.[manifest.activeVersion]?.mainAnchor || "").trim();
  if (!anchorValue) throw new Error(`persona manifest has no active main anchor: ${manifestPath}`);
  const mainAnchorPath = resolve(dirname(manifestPath), anchorValue);
  if (!existsSync(mainAnchorPath)) throw new Error(`persona main anchor not found: ${mainAnchorPath}`);
  const requiredAnchor = (entry.contextImages || []).find((image) => image?.role === "main-anchor" && image.required === true);
  if (!requiredAnchor?.path) throw new Error(`job ${entry.jobId || entry.id} is missing a required main-anchor context image`);
  const requestAnchorPath = resolve(String(requiredAnchor.path));
  if (requestAnchorPath !== mainAnchorPath || !existsSync(requestAnchorPath)) {
    throw new Error(`job main-anchor does not match the persona manifest: ${requestAnchorPath} != ${mainAnchorPath}`);
  }
  const manifestSha256 = fileSha256(manifestPath);
  const mainAnchorSha256 = fileSha256(mainAnchorPath);
  if (requiredAnchor.sha256 && String(requiredAnchor.sha256).toLowerCase() !== mainAnchorSha256) {
    throw new Error(`job main-anchor hash does not match the actual persona anchor: ${requestAnchorPath}`);
  }
  return { manifestPath, manifestSha256, mainAnchorPath, mainAnchorSha256, jobsPath };
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireManifestLock(jobsPath, timeoutMs = 30_000) {
  const lockPath = `${jobsPath}.lock`;
  const startedAt = Date.now();
  while (true) {
    try {
      mkdirSync(lockPath);
      return lockPath;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for manifest lock: ${lockPath}`);
      }
      sleep(25);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const jobsPath = resolve(args.jobs);
const sourcePath = resolve(args.source);
if (!existsSync(jobsPath)) throw new Error(`jobs manifest not found: ${jobsPath}`);
if (!existsSync(sourcePath)) throw new Error(`generated source image not found: ${sourcePath}`);
if (!enabled(args.personaReferenceBound)) {
  throw new Error("--persona-reference-bound true is required when recording a final personal-IP image_gen result.");
}

const lockPath = acquireManifestLock(jobsPath);
try {
  const document = JSON.parse(readFileSync(jobsPath, "utf8"));
  const collectionKey = Array.isArray(document.jobs) ? "jobs" : Array.isArray(document.requests) ? "requests" : null;
  if (!collectionKey) throw new Error("jobs manifest must contain jobs[] or requests[]");
  const entry = document[collectionKey].find((item) => String(item.jobId || item.id) === String(args.jobId));
  if (!entry) throw new Error(`job not found: ${args.jobId}`);
  const persona = resolvePersonaContext({ args, document, entry, jobsPath });
  const manifestPromptCandidates = entry.promptPath ? [
    resolve(dirname(jobsPath), String(entry.promptPath)),
    resolve(dirname(jobsPath), "..", String(entry.promptPath)),
  ] : [];
  const manifestPromptPath = manifestPromptCandidates.find((candidate) => existsSync(candidate));
  const prompt = String(entry.prompt
    || (args.promptFile ? readFileSync(resolve(args.promptFile), "utf8") : "")
    || (manifestPromptPath ? readFileSync(manifestPromptPath, "utf8") : "")).trim();
  if (!prompt) throw new Error("The selected job has no readable inline prompt/promptPath; pass --prompt-file with the exact dispatched prompt.");
  const requestId = String(args.requestId || entry.requestId || entry.jobId || entry.id).trim();
  if (!requestId) throw new Error("generation request id is required");
  const inspectionStatus = String(args.inspectionStatus || "").trim();
  const inspectorType = String(args.inspectorType || "").trim();
  if (inspectionStatus !== "passed-vision-review" || !inspectorType) {
    throw new Error("Final native page recording requires --inspection-status passed-vision-review and --inspector-type <type> after target-bound visual inspection.");
  }

  const outputSha256 = sha256Buffer(readFileSync(sourcePath));
  const promptSha256 = sha256Text(prompt);
  const inspectionRecordPath = resolve(
    entry.inspectionRecordPath
      ? resolve(dirname(jobsPath), "..", String(entry.inspectionRecordPath))
      : join(dirname(jobsPath), "native-page-inspection-evidence", `${entry.jobId || entry.id}-inspection-record.json`),
  );
  const inspectionRecord = {
    schemaVersion: 1,
    requestId,
    jobId: String(entry.jobId || entry.id),
    status: inspectionStatus,
    inspectorType,
    promptSha256,
    outputSha256,
    personaManifestSha256: persona.manifestSha256,
    mainAnchorSha256: persona.mainAnchorSha256,
    inspectedAt: new Date().toISOString(),
  };
  mkdirSync(dirname(inspectionRecordPath), { recursive: true });
  writeFileSync(inspectionRecordPath, `${JSON.stringify(inspectionRecord, null, 2)}\n`, "utf8");

  entry.requestId = requestId;
  entry.inspectionRecordPath = inspectionRecordPath;
  entry.inspectionRecord = inspectionRecord;
  entry.generationReceipt = {
    schemaVersion: 1,
    recordedAtDispatch: true,
    requestId,
    jobId: String(entry.jobId || entry.id),
    provider: "codex-context-image2",
    tool: "image_gen",
    promptSha256,
    outputSha256,
    outputFileName: basename(sourcePath),
    outputPath: sourcePath,
    personaReferenceBound: true,
    personaManifestPath: persona.manifestPath,
    personaManifestSha256: persona.manifestSha256,
    mainAnchorPath: persona.mainAnchorPath,
    mainAnchorSha256: persona.mainAnchorSha256,
    inspectionRecordPath,
    inspectionStatus,
    inspectorType,
    recordedAt: new Date().toISOString(),
  };
  entry.sourceImage = sourcePath;
  entry.sourceImageSha256 = entry.generationReceipt.outputSha256;
  entry.promptSha256 = entry.generationReceipt.promptSha256;

  const tempPath = resolve(dirname(jobsPath), `.${basename(jobsPath)}.${process.pid}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  renameSync(tempPath, jobsPath);
  process.stdout.write(`${JSON.stringify({
    jobs: jobsPath,
    collection: collectionKey,
    jobId: entry.jobId || entry.id,
    requestId,
    source: sourcePath,
    outputSha256: entry.generationReceipt.outputSha256,
  }, null, 2)}\n`);
} finally {
  rmdirSync(lockPath);
}
