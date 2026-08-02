const DEFAULT_MAX_CONCURRENCY = 9;

function normalizedTargetId(value = "") {
  return String(value || "").replace(/-image2-integrated-cover$/, "").trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function dispatchJobFingerprint(job = {}) {
  return JSON.stringify({
    targetId: normalizedTargetId(job.targetId || job.id),
    requestId: String(job.requestId || job.promptTargetId || job.targetId || job.id || ""),
    provider: String(job.provider || "codex-context-image2"),
    tool: String(job.tool || "image_gen"),
    prompt: String(job.prompt || ""),
    promptSha256: String(job.promptSha256 || ""),
    inputImages: (Array.isArray(job.inputImages) ? job.inputImages : []).map((item) => ({
      role: String(item?.role || "reference"),
      path: String(item?.path || ""),
      contentSha256: String(item?.contentSha256 || ""),
    })),
    promptPath: String(job.promptPath || ""),
    expectedOutput: String(job.expectedOutput || ""),
    generationReceiptPath: String(job.generationReceiptPath || ""),
    inspectionRecordPath: String(job.inspectionRecordPath || ""),
    requestSchemaVersion: String(job.requestSchemaVersion || ""),
    width: Number(job.width || 0),
    height: Number(job.height || 0),
    ratio: String(job.ratio || ""),
  });
}

function normalizeConcurrency(value, pendingCount) {
  if (pendingCount <= 0) return 0;
  const requested = Number(value);
  const defaultConcurrency = Math.min(DEFAULT_MAX_CONCURRENCY, pendingCount);
  if (!Number.isFinite(requested) || requested <= 0) return defaultConcurrency;
  return Math.min(Math.max(1, Math.floor(requested)), DEFAULT_MAX_CONCURRENCY, pendingCount);
}

function quotedTextFromBullet(line = "") {
  const match = String(line).match(/^\s*-\s*["“](.+?)["”]\s*$/u);
  return match ? match[1].trim() : "";
}

export function extractApprovedVisibleText(prompt = "") {
  const lines = String(prompt || "").split(/\r?\n/u);
  const text = [];
  let insideVerbatim = false;
  for (const line of lines) {
    if (/^\s*Text\s*\(verbatim\)\s*:/iu.test(line)) {
      insideVerbatim = true;
      continue;
    }
    if (!insideVerbatim) continue;
    const value = quotedTextFromBullet(line);
    if (value) {
      text.push(value);
      continue;
    }
    if (line.trim()) break;
  }
  if (text.length) return unique(text);
  const whitelist = String(prompt || "").match(/Approved text whitelist\s*:\s*([^\n]+)/iu)?.[1] || "";
  return unique([...whitelist.matchAll(/「([^」]+)」/gu)].map((match) => match[1].trim()));
}

export function buildCoverImage2DispatchPlan({
  manifest = {},
  topicDir = "",
  requestedConcurrency,
  createdAt = new Date().toISOString(),
  previousPlan = {},
  previousRun = {},
  sourceExists = () => false,
  inputImageFingerprint = () => "",
  sourceFingerprint = () => "",
} = {}) {
  const requests = Array.isArray(manifest.requests) ? manifest.requests : [];
  const pendingRequests = requests.filter((request) => request?.status !== "completed");
  const candidateJobs = pendingRequests.map((request) => ({
    targetId: normalizedTargetId(request.targetId || request.id),
    requestId: request.requestId || request.promptTargetId || request.targetId || request.id || "",
    provider: request.provider || manifest.provider || "codex-context-image2",
    tool: request.tool || manifest.tool || "image_gen",
    prompt: String(request.prompt || ""),
    promptSha256: String(request.promptSha256 || ""),
    promptPath: String(request.promptPath || ""),
    approvedVisibleText: Array.isArray(request.approvedVisibleText) && request.approvedVisibleText.length
      ? unique(request.approvedVisibleText.map((value) => String(value).trim()))
      : extractApprovedVisibleText(request.prompt),
    inputImages: (Array.isArray(request.inputImages) ? request.inputImages : []).map((item) => ({
      role: String(item?.role || "reference"),
      path: String(item?.path || ""),
      contentSha256: String(inputImageFingerprint(item?.path, item) || item?.contentSha256 || ""),
    })),
    width: Number(request.width || 0),
    height: Number(request.height || 0),
    ratio: String(request.ratio || ""),
    expectedOutput: String(request.expectedOutput || ""),
    generationReceiptPath: String(request.generationReceiptPath || ""),
    inspectionRecordPath: String(request.inspectionRecordPath || ""),
    requestSchemaVersion: String(request.schemaVersion || manifest.schemaVersion || ""),
    parallelSafe: request.parallelSafe === true,
  }));
  const previousJobByTarget = new Map([
    ...(Array.isArray(previousPlan.jobs) ? previousPlan.jobs : []),
    ...(Array.isArray(previousPlan.preservedJobs) ? previousPlan.preservedJobs : []),
  ]
    .map((job) => [normalizedTargetId(job.targetId || job.id), job]));
  const previousResultByTarget = new Map((Array.isArray(previousRun.targetResults) ? previousRun.targetResults : [])
    .map((result) => [normalizedTargetId(result.targetId), result]));
  const preservedGeneratedTargetIds = candidateJobs
    .filter((job) => {
      const previousJob = previousJobByTarget.get(job.targetId);
      const previousResult = previousResultByTarget.get(job.targetId);
      return previousJob
        && previousResult?.status === "generated"
        && previousResult.sourcePath
        && previousResult.sourceSha256
        && sourceExists(previousResult.sourcePath)
        && sourceFingerprint(previousResult.sourcePath) === previousResult.sourceSha256
        && dispatchJobFingerprint(previousJob) === dispatchJobFingerprint(job);
    })
    .map((job) => job.targetId);
  const preservedGeneratedSet = new Set(preservedGeneratedTargetIds);
  const preservedJobs = candidateJobs.filter((job) => preservedGeneratedSet.has(job.targetId));
  const jobs = candidateJobs.filter((job) => !preservedGeneratedSet.has(job.targetId));
  const plannedTargetCount = Number(manifest.requestCountContract?.plannedTargetCount || requests.length);
  const requestedTargetCount = Number(manifest.requestCountContract?.expectedRequestCount || requests.length);
  const completedTargetIds = requests
    .filter((request) => request?.status === "completed")
    .map((request) => normalizedTargetId(request.targetId || request.id));
  const pendingTargetIds = jobs.map((job) => job.targetId);
  const concurrency = normalizeConcurrency(requestedConcurrency, jobs.length);
  const invalidJobs = candidateJobs.filter((job) => !job.targetId
    || !job.prompt
    || !job.width
    || !job.height
    || job.provider !== "codex-context-image2"
    || job.tool !== "image_gen"
    || job.parallelSafe !== true);
  if (invalidJobs.length) {
    throw new Error(`Invalid Image2 cover dispatch job(s): ${invalidJobs.map((job) => job.targetId || "missing-target").join(", ")}`);
  }
  if (new Set(pendingTargetIds).size !== pendingTargetIds.length) {
    throw new Error("Image2 cover dispatch contains duplicate pending target ids");
  }
  return {
    schemaVersion: 1,
    stage: "cover-image2-dispatch-plan",
    status: jobs.length ? "dispatch-ready" : "nothing-pending",
    topicDir: String(topicDir || ""),
    createdAt,
    strategy: "all-pending-worker-pool",
    failureMode: "all-settled-target-isolation",
    provider: "codex-context-image2",
    tool: "image_gen",
    maxConcurrency: DEFAULT_MAX_CONCURRENCY,
    concurrency,
    plannedTargetCount,
    requestedTargetCount,
    completedTargetCount: completedTargetIds.length,
    pendingTargetCount: jobs.length,
    completedTargetIds,
    preservedGeneratedTargetIds,
    preservedJobs,
    pendingTargetIds,
    targetCountPreserved: jobs.length + preservedGeneratedTargetIds.length === pendingRequests.length,
    singleWave: jobs.length > 0 && concurrency === jobs.length,
    jobs,
  };
}

function settledResult({ job, status, value, reason, submittedAt, completedAt }) {
  if (status === "fulfilled") {
    return {
      targetId: job.targetId,
      status: "generated",
      submittedAt,
      completedAt,
      output: value || null,
    };
  }
  return {
    targetId: job.targetId,
    status: "failed",
    submittedAt,
    completedAt,
    error: String(reason?.message || reason || "unknown Image2 failure"),
  };
}

export async function executeCoverImage2DispatchPlan({
  plan = {},
  generate,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof generate !== "function") throw new Error("executeCoverImage2DispatchPlan requires a generate(job) function");
  const jobs = Array.isArray(plan.jobs) ? plan.jobs : [];
  const concurrency = normalizeConcurrency(plan.concurrency, jobs.length);
  if (!jobs.length) {
    return {
      schemaVersion: 1,
      stage: "cover-image2-dispatch-result",
      status: "generated",
      coversGenerated: true,
      succeededCount: 0,
      failedCount: 0,
      succeededTargetIds: [],
      failedTargetIds: [],
      retryTargetIds: [],
      results: [],
    };
  }

  const results = new Array(jobs.length);
  let nextIndex = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < jobs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const job = jobs[index];
      const submittedAt = now();
      const [settled] = await Promise.allSettled([Promise.resolve().then(() => generate(job))]);
      results[index] = settledResult({
        job,
        status: settled.status,
        value: settled.status === "fulfilled" ? settled.value : null,
        reason: settled.status === "rejected" ? settled.reason : null,
        submittedAt,
        completedAt: now(),
      });
    }
  });
  const workerResults = await Promise.allSettled(workers);
  const workerFailure = workerResults.find((result) => result.status === "rejected");
  if (workerFailure) throw workerFailure.reason;

  const succeededTargetIds = results.filter((result) => result.status === "generated").map((result) => result.targetId);
  const failedTargetIds = results.filter((result) => result.status === "failed").map((result) => result.targetId);
  return {
    schemaVersion: 1,
    stage: "cover-image2-dispatch-result",
    status: failedTargetIds.length ? "partial-failure" : "generated",
    coversGenerated: failedTargetIds.length === 0 && succeededTargetIds.length === jobs.length,
    succeededCount: succeededTargetIds.length,
    failedCount: failedTargetIds.length,
    succeededTargetIds,
    failedTargetIds,
    retryTargetIds: failedTargetIds,
    results,
  };
}

export const COVER_IMAGE2_MAX_CONCURRENCY = DEFAULT_MAX_CONCURRENCY;
