export function buildCoverGenerationWorkflowContract({ requestManifest = {}, generationRun = {} } = {}) {
  const requestCountContract = requestManifest.requestCountContract || {};
  const coversVerified = requestManifest.allRequestedPlatformUploadCoversReady === true
    && Number(requestManifest.pendingRequestCount || 0) === 0;
  const coversGenerated = coversVerified || generationRun.coversGenerated === true;
  return {
    schemaVersion: 1,
    stage: "standalone-cover-generation-workflow",
    status: coversVerified ? "covers_verified" : coversGenerated ? "covers_generated" : requestManifest.status || "required-pending",
    coversGenerated,
    coversVerified,
    completedRequestCount: Number(requestManifest.completedRequestCount || 0),
    pendingRequestCount: Number(requestManifest.pendingRequestCount || 0),
    primaryPlatformUploadCoverReady: requestManifest.primaryPlatformUploadCoverReady === true,
    allRequestedPlatformUploadCoversReady: requestManifest.allRequestedPlatformUploadCoversReady === true,
    requestScopeMode: requestCountContract.mode || "",
    plannedTargetCount: Number(requestCountContract.plannedTargetCount || 0),
    requestedTargetCount: Number(requestCountContract.expectedRequestCount || 0),
    requestScopeAuthorizationRequired: requestCountContract.scopeAuthorizationRequired === true,
    requestScopeAuthorizationPass: requestCountContract.scopeAuthorizationPass === true,
    canonicalRequestFile: "workflow/context-image2-cover-requests.json",
    lifecycle: ["plan", "dispatch-all-pending", "covers_generated", "inspect", "batch-ingest", "covers_verified", "delivery-sync"],
    promptParityRequired: true,
    sourceStagingPolicy: "external-imagegen-output-until-ingest",
    executionOwner: "codex-video-cover-generation",
    dispatchPlan: "workflow/cover-image2-dispatch-plan.json",
    generationRun: "workflow/cover-generation-run.json",
    ingestOwner: "skills/codex-video-cover-generation/scripts/ingest-codex-image2-cover-batch.mjs",
    validationOwner: "scripts/validate-cover-generation-workflow.mjs",
    fullVideoQcTriggeredByCoverWorkflow: false,
    fullVideoQcRequiredForPublishPromotion: true,
    completionRule: "Planned target count, authorized request scope, and actual request count agree; every requested target is generated, inspected, and batch-ingested with request-bound evidence; prompt files match the request manifest; cover QC passes; and delivery coverStatus converges. Full-video QC is a separate publish-promotion stage.",
  };
}
