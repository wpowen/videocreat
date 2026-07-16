#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--") || !argv[i + 1]) throw new Error(`Missing value for ${key}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[i + 1];
    i += 1;
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pngDimensions(path) {
  const header = readFileSync(path).subarray(0, 24);
  if (header.length < 24 || header.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function textSha256(value = "") {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function resolvePersonaContext({ args, jobsDocument, jobs, jobsPath, allowDraftOutput }) {
  if (allowDraftOutput) return null;
  const manifestValue = String(args.personaManifest || jobsDocument.fixedPersonaManifest || "").trim();
  if (!manifestValue) throw new Error("Final personal-IP page ingest requires a real --persona-manifest <manifest.json>.");
  const manifestPath = resolve(manifestValue);
  if (!existsSync(manifestPath)) throw new Error(`persona manifest not found: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  const anchorValue = String(manifest.assets?.mainAnchor || manifest.versions?.[manifest.activeVersion]?.mainAnchor || "").trim();
  if (!anchorValue) throw new Error(`persona manifest has no active main anchor: ${manifestPath}`);
  const mainAnchorPath = resolve(dirname(manifestPath), anchorValue);
  if (!existsSync(mainAnchorPath)) throw new Error(`persona main anchor not found: ${mainAnchorPath}`);
  const manifestSha256 = fileSha256(manifestPath);
  const mainAnchorSha256 = fileSha256(mainAnchorPath);
  for (const job of jobs) {
    const jobManifest = String(job.fixedPersonaManifest || jobsDocument.fixedPersonaManifest || manifestPath);
    if (resolve(jobManifest) !== manifestPath) throw new Error(`job ${job.jobId || job.id} uses a different persona manifest`);
    const requiredAnchor = (job.contextImages || []).find((image) => image?.role === "main-anchor" && image.required === true);
    if (!requiredAnchor?.path) throw new Error(`job ${job.jobId || job.id} is missing a required main-anchor context image`);
    const requestAnchorPath = resolve(String(requiredAnchor.path));
    if (requestAnchorPath !== mainAnchorPath || !existsSync(requestAnchorPath)) {
      throw new Error(`job ${job.jobId || job.id} main-anchor does not match the persona manifest`);
    }
    if (requiredAnchor.sha256 && String(requiredAnchor.sha256).toLowerCase() !== mainAnchorSha256) {
      throw new Error(`job ${job.jobId || job.id} main-anchor hash is stale`);
    }
  }
  return { manifestPath, manifestSha256, mainAnchorPath, mainAnchorSha256, jobsPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobsPath = resolve(args.jobs);
  const sourceDir = resolve(args.sourceDir);
  const outDir = resolve(args.out);
  const targetCount = Math.max(1, Number(args.targetCount || 1));
  const allowSourceReuse = isEnabled(args.allowSourceReuse);
  const allowDraftOutput = isEnabled(args.allowDraftOutput);
  const personaReferenceBound = isEnabled(args.personaReferenceBound);
  const personaManifest = String(args.personaManifest || "");
  const jobsDocument = readJson(jobsPath);
  const rawJobs = Array.isArray(jobsDocument.jobs)
    ? jobsDocument.jobs
    : Array.isArray(jobsDocument.requests)
      ? jobsDocument.requests
      : [];
  const jobs = rawJobs.map((job) => {
    if (String(job.prompt || "").trim() || !job.promptPath) return job;
    const candidates = [
      resolve(dirname(jobsPath), String(job.promptPath)),
      resolve(dirname(jobsPath), "..", String(job.promptPath)),
    ];
    const promptFile = candidates.find((candidate) => existsSync(candidate));
    return promptFile ? { ...job, prompt: readFileSync(promptFile, "utf8").trim() } : job;
  });
  if (!existsSync(sourceDir)) throw new Error(`source-dir not found: ${sourceDir}`);
  if (!jobs.length) throw new Error("native jobs are empty");
  if (jobs.length !== targetCount) {
    throw new Error(`Native job count ${jobs.length} does not match planned page count ${targetCount}. One content-bound job is required per final page.`);
  }
  const jobIds = jobs.map((job, index) => String(job.jobId || job.id || `job-${index + 1}`));
  if (new Set(jobIds).size !== jobs.length) {
    throw new Error("Native jobs contain duplicate job ids; every final page requires a unique content-bound job.");
  }
  const jobsWithoutPrompt = jobs.filter((job) => !String(job.prompt || "").trim());
  if (jobsWithoutPrompt.length > 0) {
    throw new Error(`${jobsWithoutPrompt.length} native job(s) are missing the exact generation prompt; final page provenance cannot be bound to content.`);
  }
  if (allowSourceReuse && !allowDraftOutput) {
    throw new Error("Native source reuse is draft-only. Pass --allow-draft-output true together with --allow-source-reuse true, and never use the result as final output.");
  }
  if (!allowDraftOutput && !personaReferenceBound) {
    throw new Error("Final personal-IP page ingest requires --persona-reference-bound true.");
  }
  const persona = resolvePersonaContext({ args, jobsDocument, jobs, jobsPath, allowDraftOutput });
  const sources = readdirSync(sourceDir)
    .filter((name) => extname(name).toLowerCase() === ".png")
    .map((name) => join(sourceDir, name))
    .filter((path) => {
      const dimensions = pngDimensions(path);
      return dimensions && dimensions.width / dimensions.height >= 1.6;
    })
    .sort();
  if (!sources.length) throw new Error("no landscape PNG image_gen outputs found");
  const sourceRecords = sources.map((path) => ({ path, sha256: fileSha256(path) }));
  const uniqueSourceRecords = [...new Map(sourceRecords.map((item) => [item.sha256, item])).values()];
  if (!allowSourceReuse && (uniqueSourceRecords.length !== targetCount || sourceRecords.length !== targetCount)) {
    throw new Error([
      "Native personal-IP page ingest refused to reuse source images.",
      `- Required exactly ${targetCount} content pages, found ${sourceRecords.length} files and ${uniqueSourceRecords.length} unique landscape image_gen outputs.`,
      "- Generate one distinct source image for every planned page/cue before ingesting.",
      "- Missing, repeated, or stale extra source files are not a valid full-auto final page set.",
    ].join("\n"));
  }
  const sourceByBasename = new Map(sourceRecords.map((record) => [basename(record.path), record]));
  const sourceByHash = new Map(sourceRecords.map((record) => [record.sha256, record]));
  const dispatchReceipts = jobs.map((job) => job.generationReceipt || job.dispatchResult?.generationReceipt || null);
  if (!allowDraftOutput && dispatchReceipts.some((receipt) => !receipt)) {
    throw new Error("Every final native page job requires a dispatch-time generation receipt. Ingest validates recorded image_gen evidence and must not invent receipts from sorted source files.");
  }
  mkdirSync(outDir, { recursive: true });

  const contentPages = [];
  for (let index = 0; index < targetCount; index += 1) {
    const job = jobs[index];
    const dispatchReceipt = dispatchReceipts[index] || {};
    const expectedRequestId = String(job.requestId || job.jobId || job.id || "").trim();
    const receiptRequestId = String(dispatchReceipt.requestId || "").trim();
    const receiptPromptSha256 = String(dispatchReceipt.promptSha256 || "").trim().toLowerCase();
    const receiptOutputSha256 = String(dispatchReceipt.outputSha256 || "").trim().toLowerCase();
    const receiptOutputFileName = basename(String(dispatchReceipt.outputFileName || dispatchReceipt.outputPath || ""));
    const receiptSourceRecord = (receiptOutputFileName ? sourceByBasename.get(receiptOutputFileName) : null)
      || (receiptOutputSha256 ? sourceByHash.get(receiptOutputSha256) : null)
      || null;
    const inspectionRecordValue = String(job.inspectionRecordPath || dispatchReceipt.inspectionRecordPath || "").trim();
    const inspectionRecordPath = inspectionRecordValue ? resolve(inspectionRecordValue) : "";
    const inspectionRecord = inspectionRecordPath && existsSync(inspectionRecordPath) ? readJson(inspectionRecordPath) : null;
    const inspectionValid = Boolean(inspectionRecord)
      && inspectionRecord.status === "passed-vision-review"
      && inspectionRecord.requestId === expectedRequestId
      && inspectionRecord.promptSha256 === textSha256(job.prompt)
      && inspectionRecord.outputSha256 === receiptOutputSha256
      && inspectionRecord.personaManifestSha256 === persona?.manifestSha256
      && inspectionRecord.mainAnchorSha256 === persona?.mainAnchorSha256;
    const receiptValid = Boolean(receiptSourceRecord)
      && receiptRequestId === expectedRequestId
      && receiptPromptSha256 === textSha256(job.prompt)
      && receiptOutputSha256 === receiptSourceRecord.sha256
      && dispatchReceipt.personaReferenceBound === true
      && dispatchReceipt.provider === "codex-context-image2"
      && dispatchReceipt.tool === "image_gen"
      && dispatchReceipt.personaManifestSha256 === persona?.manifestSha256
      && dispatchReceipt.mainAnchorSha256 === persona?.mainAnchorSha256
      && inspectionValid;
    if (!allowDraftOutput && !receiptValid) {
      throw new Error(`Generation receipt validation failed for ${job.jobId || job.id || `job-${index + 1}`}: request, prompt hash, output hash/file, provider/tool, persona manifest/main-anchor hashes, and passed vision inspection must match the actual image_gen dispatch result.`);
    }
    const sourceRecord = receiptValid
      ? receiptSourceRecord
      : allowSourceReuse
        ? sourceRecords[index % sourceRecords.length]
        : uniqueSourceRecords[index];
    const source = sourceRecord.path;
    const pagePath = `page-${String(index + 1).padStart(2, "0")}.png`;
    copyFileSync(source, join(outDir, pagePath));
    contentPages.push({
      id: job.jobId || `ip-native-job-${String(index + 1).padStart(2, "0")}`,
      order: index + 1,
      path: pagePath,
      sceneId: job.sceneId || null,
      scriptUnitId: job.scriptUnitId || null,
      scriptUnitText: job.scriptUnitText || "",
      methodologyText: job.methodologyText || "",
      requiredVisualUnitIds: job.requiredVisualUnitIds || [],
      promptMethod: job.promptMethod || null,
      prompt: job.prompt || "",
      source_generated_image: source,
      personaReferenceBoundToGeneration: personaReferenceBound,
      personaReferenceManifest: persona?.manifestPath || personaManifest || null,
      imageGenTool: "image_gen",
      generatedImagePath: source,
      sourceReuseIndex: allowSourceReuse ? index % sourceRecords.length : null,
      sourceSha256: sourceRecord.sha256,
      distinctSourcePerPage: !allowSourceReuse,
      generationReceipt: {
        schemaVersion: 1,
        recordedAtDispatch: receiptValid,
        requestId: receiptRequestId || expectedRequestId,
        jobId: String(job.jobId || job.id),
        provider: dispatchReceipt.provider || "codex-context-image2",
        tool: dispatchReceipt.tool || "image_gen",
        promptSha256: receiptPromptSha256 || textSha256(job.prompt),
        outputSha256: receiptOutputSha256 || sourceRecord.sha256,
        outputPath: source,
        personaReferenceManifest: personaManifest || null,
        personaReferenceBound: dispatchReceipt.personaReferenceBound === true && personaReferenceBound,
        personaManifestSha256: dispatchReceipt.personaManifestSha256 || null,
        mainAnchorSha256: dispatchReceipt.mainAnchorSha256 || null,
        inspectionRecordPath: inspectionRecordPath || null,
        inspectionStatus: inspectionRecord?.status || null,
      },
      inspectionRecord,
    });
  }

  const generationReceiptComplete = !allowSourceReuse
    && contentPages.length === targetCount
    && contentPages.every((page) => page.generationReceipt.requestId
      && page.generationReceipt.recordedAtDispatch === true
      && page.generationReceipt.promptSha256
      && page.generationReceipt.outputSha256
      && page.generationReceipt.personaReferenceBound
      && page.generationReceipt.personaManifestSha256 === persona?.manifestSha256
      && page.generationReceipt.mainAnchorSha256 === persona?.mainAnchorSha256
      && page.inspectionRecord?.status === "passed-vision-review")
    && new Set(contentPages.map((page) => page.generationReceipt.requestId)).size === targetCount
    && new Set(contentPages.map((page) => page.generationReceipt.outputSha256)).size === targetCount;

  writeJson(join(outDir, "manifest.json"), {
    schemaVersion: 1,
    status: allowSourceReuse ? "draft-reused-source-pages" : "ready-native-imagegen-page-set",
    generation_route: "Codex built-in image_gen with fixed persona context; landscape source images ingested locally",
    provider: "codex-context-image2",
    tool: "image_gen",
    personaReferenceManifest: persona?.manifestPath || personaManifest || null,
    personaReferenceManifestSha256: persona?.manifestSha256 || null,
    personaMainAnchor: persona?.mainAnchorPath || null,
    personaMainAnchorSha256: persona?.mainAnchorSha256 || null,
    adaptivePageCount: targetCount,
    sourceImageCount: uniqueSourceRecords.length,
    sourceFileCount: sources.length,
    uniqueSourceImageCount: uniqueSourceRecords.length,
    sourceReusePolicy: allowSourceReuse ? "explicit-draft-only-source-reuse" : "one-unique-source-per-final-page",
    generationReceiptContract: {
      required: true,
      complete: generationReceiptComplete,
      plannedRequestCount: targetCount,
      recordedReceiptCount: contentPages.length,
      uniqueRequestIdCount: new Set(contentPages.map((page) => page.generationReceipt.requestId)).size,
      uniqueOutputHashCount: new Set(contentPages.map((page) => page.generationReceipt.outputSha256)).size,
    },
    imageCountPlan: "workflow/personal-ip-image-count-plan.json",
    content_pages: contentPages,
  });
  const packageRoot = dirname(outDir);
  const policy = readJson(jobsPath).imageCountPolicy || {};
  const nativePolicy = policy.nativeSourcePageCountPolicy || {};
  const countPlanPath = join(packageRoot, "workflow", "personal-ip-image-count-plan.json");
  const existingCountPlan = existsSync(countPlanPath) ? readJson(countPlanPath) : {};
  writeJson(join(packageRoot, "workflow", "personal-ip-image-count-plan.json"), {
    ...existingCountPlan,
    schemaVersion: Math.max(3, Number(existingCountPlan.schemaVersion || 0)),
    stage: "ingest-native-imagegen-page-set",
    status: generationReceiptComplete ? "pass" : "draft",
    mode: nativePolicy.mode || existingCountPlan.mode || "semantic-page-capacity",
    resolvedImageCount: targetCount,
    minimumImageCount: Number(nativePolicy.minImageCount || 4),
    maximumImageCount: Number(nativePolicy.maxImageCount || existingCountPlan.maxImageCount || targetCount),
    maxUniquePages: Number(nativePolicy.maxUniquePages || existingCountPlan.maxUniquePages || targetCount),
    maximumPolicy: nativePolicy.maximumPolicy || existingCountPlan.maximumPolicy || "duration-band-default-user-maximum-hard-cap",
    requestedMaximumApplied: nativePolicy.requestedMaximumApplied === true || existingCountPlan.requestedMaximumApplied === true,
    coverageStrategy: nativePolicy.coverageStrategy || existingCountPlan.coverageStrategy || "semantic-packing-with-in-page-micro-beats",
    repairVariantPolicy: nativePolicy.repairVariantPolicy || existingCountPlan.repairVariantPolicy || "on-demand-qc-failures-only",
    maxRepairGenerations: Number(nativePolicy.maxRepairGenerations || existingCountPlan.maxRepairGenerations || Math.min(6, Math.max(1, Math.ceil(targetCount * 0.2)))),
    sourceImageCountPlanSatisfied: generationReceiptComplete,
    sourceGeneratedImageCount: uniqueSourceRecords.length,
    sourceFileCount: sources.length,
    uniqueSourceImageCount: uniqueSourceRecords.length,
    finalPageCount: targetCount,
    contentMetrics: nativePolicy.contentMetrics || existingCountPlan.contentMetrics || {},
    sourceReusePolicy: allowSourceReuse ? "explicit-draft-only-source-reuse" : "one-unique-source-per-final-page",
    distinctSourcePerPage: !allowSourceReuse,
    generationReceiptContractComplete: generationReceiptComplete,
  });
  console.log(JSON.stringify({ outDir, targetCount, sourceCount: sources.length, manifest: join(outDir, "manifest.json") }, null, 2));
}

main();
