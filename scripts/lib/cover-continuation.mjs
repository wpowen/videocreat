function normalizedTargetId(value = "") {
  return String(value || "").replace(/-image2-integrated-cover$/, "").trim();
}

function pendingRequestIds(coverRequests = {}) {
  return (Array.isArray(coverRequests.requests) ? coverRequests.requests : [])
    .filter((request) => request?.status !== "completed")
    .map((request) => normalizedTargetId(request.targetId || request.id))
    .filter(Boolean);
}

export function buildPlatformCoverContinuationLane({
  coverRequests = {},
  coverDispatch = {},
  coverRun = {},
} = {}) {
  const requestIds = (Array.isArray(coverRequests.requests) ? coverRequests.requests : [])
    .map((request) => normalizedTargetId(request.targetId || request.id))
    .filter(Boolean);
  if (!requestIds.length) return null;

  const pendingIds = pendingRequestIds(coverRequests);
  const manifestVerified = coverRequests.allRequestedPlatformUploadCoversReady === true
    && pendingIds.length === 0;
  const coversVerified = coverRun.coversVerified === true && manifestVerified;
  if (coversVerified) return null;

  const generatedIds = new Set((Array.isArray(coverRun.generatedTargetIds) ? coverRun.generatedTargetIds : [])
    .map(normalizedTargetId));
  const coversGenerated = coverRun.coversGenerated === true
    && requestIds.every((targetId) => generatedIds.has(targetId));
  const dispatchJobs = Array.isArray(coverDispatch.jobs) ? coverDispatch.jobs : [];

  if (coversGenerated) {
    return {
      id: "platform-covers",
      status: "batch-ingest-required",
      pendingJobCount: 0,
      pendingRequestCount: pendingIds.length,
      requestManifest: "workflow/context-image2-cover-requests.json",
      dispatchPlan: "workflow/cover-image2-dispatch-plan.json",
      action: "Finish any missing target-bound inspection evidence, run the standalone locked batch ingest, then rerun final QC.",
    };
  }

  return {
    id: "platform-covers",
    status: "dispatch-required",
    pendingJobCount: dispatchJobs.length || pendingIds.length,
    pendingRequestCount: pendingIds.length,
    requestManifest: "workflow/context-image2-cover-requests.json",
    dispatchPlan: "workflow/cover-image2-dispatch-plan.json",
    action: "Run every cover dispatch job through built-in image_gen, record and inspect each target, then use the standalone locked batch ingest before final QC.",
  };
}
