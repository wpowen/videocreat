#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCoverGenerationWorkflowContract,
  buildCoverStatusSnapshot,
  formatContextImage2CoverPromptDocument,
  resolveCoverRequestScope,
  resolveTitleFirstWritingMethodCoverHook,
  validateCoverRequestScopeContract,
  validateContextImage2PromptParity,
} from "./lib/cover-generation-workflow.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(process.env.CODEX_VIDEO_WORKFLOW_TEST_ROOT || resolve(__dirname, ".."));
const root = join(workspace, "research", "codex-video-workflow-poc", "cover-generation-workflow-self-test");

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function main() {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "workflow"), { recursive: true });
  mkdirSync(join(root, "prompts", "context-image2-covers"), { recursive: true });

  const routed = resolveTitleFirstWritingMethodCoverHook({
    titleText: "教你如何开篇黄金三章",
    frameText: "主角欲望、误信念和选择压力都会在课程正文出现，但不能把封面主题改成人物选择系统。",
  });
  if (routed?.hookText !== "开头没人看?" || routed?.payoffText !== "第一章留人") {
    fail(`title-first cover routing failed: ${JSON.stringify(routed)}`);
  }

  const plannedTargetIds = [
    "master-16x9-4k",
    "youtube-1280x720",
    "horizontal-4x3-1600x1200",
    "bilibili-common-1146x717",
    "bilibili-1920x1080",
    "vertical-1080x1920",
    "vertical-profile-1080x1440",
    "instagram-reels-cover",
    "square-1200x1200",
  ];
  const fullScope = resolveCoverRequestScope({ brief: {}, availableTargetIds: plannedTargetIds, primaryTargetId: "youtube-1280x720" });
  if (fullScope.mode !== "all-planned-platform-targets" || fullScope.requestedTargetIds.length !== 9) {
    fail(`default cover scope did not preserve all nine targets: ${JSON.stringify(fullScope)}`);
  }
  let unauthorizedScopeRejected = false;
  try {
    resolveCoverRequestScope({
      brief: { coverPrimaryOnly: true },
      availableTargetIds: plannedTargetIds,
      primaryTargetId: "youtube-1280x720",
    });
  } catch (error) {
    unauthorizedScopeRejected = String(error?.message || error).includes("Cover scope narrowing requires explicit user authorization");
  }
  if (!unauthorizedScopeRejected) fail("primary-only cover scope passed without explicit user authorization");
  const authorizedScope = resolveCoverRequestScope({
    brief: {
      coverPrimaryOnly: true,
      coverScopeAuthorization: {
        authorizedByUser: true,
        mode: "explicit-primary-only",
        requestedTargetIds: ["youtube-1280x720"],
        source: "self-test-user-request",
      },
    },
    availableTargetIds: plannedTargetIds,
    primaryTargetId: "youtube-1280x720",
  });
  const authorizedManifest = {
    requestCountContract: {
      mode: authorizedScope.mode,
      plannedTargetCount: authorizedScope.plannedTargetIds.length,
      plannedTargetIds: authorizedScope.plannedTargetIds,
      expectedRequestCount: authorizedScope.requestedTargetIds.length,
      actualRequestCount: authorizedScope.requestedTargetIds.length,
      requestedTargetIds: authorizedScope.requestedTargetIds,
      actualTargetIds: authorizedScope.requestedTargetIds,
      scopeAuthorizationRequired: authorizedScope.scopeAuthorizationRequired,
      scopeAuthorizationPass: authorizedScope.scopeAuthorizationPass,
      scopeAuthorization: authorizedScope.scopeAuthorization,
      pass: true,
    },
    requests: authorizedScope.requestedTargetIds.map((targetId) => ({ targetId, status: "pending" })),
  };
  const authorizedContract = validateCoverRequestScopeContract({
    manifest: authorizedManifest,
    coverImage2Prompts: { prompts: plannedTargetIds.map((targetId) => ({ targetId: `${targetId}-image2-integrated-cover` })) },
  });
  if (!authorizedContract.pass) fail(`authorized narrowed cover scope failed validation: ${JSON.stringify(authorizedContract)}`);

  const request = {
    targetId: "youtube-1280x720",
    promptTargetId: "youtube-1280x720-image2-integrated-cover",
    width: 1280,
    height: 720,
    ratio: "16:9",
    promptPath: "prompts/context-image2-covers/youtube-1280x720.txt",
    prompt: "Use case: ads-marketing\nText (verbatim): 黄金开篇",
  };
  const document = formatContextImage2CoverPromptDocument({
    request,
    coverTitle: "教你如何开篇黄金三章",
  });
  if (!document.includes("external image_gen staging path")) fail("canonical prompt does not explain the external staging contract");
  if (document.includes("save the PNG in this package")) fail("canonical prompt still contradicts ingest by requesting a package-local source");
  writeFileSync(join(root, request.promptPath), document, "utf8");
  const manifest = {
    coverTitle: "教你如何开篇黄金三章",
    provider: "codex-context-image2",
    tool: "image_gen",
    requests: [{
      ...request,
      promptSha256: sha256(request.prompt),
      promptFileSha256: sha256(document),
    }],
  };
  writeFileSync(join(root, "workflow", "context-image2-cover-requests.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const parity = validateContextImage2PromptParity({ topicDir: root, manifest });
  if (!parity.pass) fail(`canonical prompt parity failed: ${JSON.stringify(parity)}`);
  writeFileSync(join(root, request.promptPath), `${document}\nstale overwrite`, "utf8");
  const staleParity = validateContextImage2PromptParity({ topicDir: root, manifest });
  if (staleParity.pass || !staleParity.failures.some((item) => item.includes("prompt file"))) {
    fail(`stale prompt overwrite was not detected: ${JSON.stringify(staleParity)}`);
  }

  const status = buildCoverStatusSnapshot({
    imageSource: "image2-dryrun",
    platformReadiness: { ready: true, targetId: "youtube-1280x720", failures: [] },
    coverImage2Qc: {
      promptQualityPass: true,
      finalCoverQualityEligible: true,
      reviewFallbackOnly: false,
      contextImage2Required: true,
      contextImage2HandoffRequired: true,
      blockers: [],
    },
    coverSizeSelection: { allEntriesUploadReady: true, needsRegeneration: [] },
    requestManifest: {
      provider: "codex-context-image2",
      requests: [{ status: "completed", provider: "codex-context-image2", tool: "image_gen" }],
    },
    coverDesign: { rootOutputCopies: [] },
  });
  if (status.platformSubmissionCoverReady !== true || status.finalCoverQualityEligible !== true || status.needsRegenerationCount !== 0) {
    fail(`cover delivery status did not converge: ${JSON.stringify(status)}`);
  }
  if (status.imageSource !== "codex-context-image2") {
    fail(`completed Context Image2 cover provenance was overwritten by the video imageSource: ${JSON.stringify(status)}`);
  }
  const generatedContract = buildCoverGenerationWorkflowContract({
    requestManifest: {
      status: "required-pending",
      pendingRequestCount: 9,
      completedRequestCount: 0,
      allRequestedPlatformUploadCoversReady: false,
      requestCountContract: {
        mode: "all-planned-platform-targets",
        plannedTargetCount: 9,
        expectedRequestCount: 9,
        scopeAuthorizationPass: true,
      },
    },
    generationRun: { coversGenerated: true },
  });
  if (generatedContract.status !== "covers_generated" || generatedContract.coversGenerated !== true || generatedContract.coversVerified !== false) {
    fail(`generated cover milestone was not separated from verification: ${JSON.stringify(generatedContract)}`);
  }
  const verifiedContract = buildCoverGenerationWorkflowContract({
    requestManifest: {
      status: "satisfied",
      pendingRequestCount: 0,
      completedRequestCount: 9,
      allRequestedPlatformUploadCoversReady: true,
      requestCountContract: {
        mode: "all-planned-platform-targets",
        plannedTargetCount: 9,
        expectedRequestCount: 9,
        scopeAuthorizationPass: true,
      },
    },
  });
  if (verifiedContract.status !== "covers_verified" || verifiedContract.coversGenerated !== true || verifiedContract.coversVerified !== true) {
    fail(`verified cover milestone did not converge: ${JSON.stringify(verifiedContract)}`);
  }

  const workflowSource = readFileSync(join(workspace, "scripts", "poc-video-workflow.mjs"), "utf8");
  const nativeRendererSource = readFileSync(join(workspace, "scripts", "render-ip-diagram-native-pages.mjs"), "utf8");
  const skillSource = readFileSync(join(workspace, "SKILL.md"), "utf8");
  const standaloneCoverSkillPath = join(workspace, "skills", "codex-video-cover-generation", "SKILL.md");
  if (!/cover-generation-workflow\.mjs/.test(workflowSource)) fail("main video workflow does not use the independent cover workflow module");
  if (!/writePromptFiles:\s*!coreCoverLogicPresent/.test(nativeRendererSource)) fail("native-page renderer can still overwrite canonical cover prompts");
  if (/Text \(verbatim\): 小说人物活起来/.test(nativeRendererSource)) fail("native-page cover fallback still contains a hard-coded unrelated topic");
  if (!/await coverArtifactsPromise;[\s\S]{0,2500}runQc\(/.test(workflowSource)) fail("full-auto does not await the cover artifact lane before final QC");
  if (!skillSource.includes("references/cover-generation-workflow.md")) fail("Skill does not route cover lifecycle maintenance to a dedicated file");
  if (!skillSource.includes("codex-video-cover-generation")) fail("main video Skill does not route execution to the standalone cover Skill");
  if (!existsSync(join(workspace, "references", "cover-generation-workflow.md"))) fail("dedicated cover-generation workflow reference is missing");
  if (!existsSync(standaloneCoverSkillPath)) fail("standalone codex-video-cover-generation Skill is missing");
  const standaloneCoverSkillSource = readFileSync(standaloneCoverSkillPath, "utf8");
  if (!/name:\s*codex-video-cover-generation/.test(standaloneCoverSkillSource)
    || !/validate-cover-generation-workflow\.mjs/.test(standaloneCoverSkillSource)
    || !/record-cover-generation-evidence\.mjs/.test(standaloneCoverSkillSource)
    || !/prepare-cover-image2-dispatch\.mjs/.test(standaloneCoverSkillSource)
    || !/record-cover-image2-dispatch-result\.mjs/.test(standaloneCoverSkillSource)
    || !/ingest-codex-image2-cover-batch\.mjs/.test(standaloneCoverSkillSource)
    || !/coversGenerated/.test(standaloneCoverSkillSource)
    || !/coversVerified/.test(standaloneCoverSkillSource)) {
    fail("standalone cover Skill does not own the canonical validate/generate/ingest lifecycle");
  }
  for (const relativePath of [
    "scripts/prepare-cover-image2-dispatch.mjs",
    "scripts/record-cover-image2-dispatch-result.mjs",
    "scripts/ingest-codex-image2-cover-batch.mjs",
    "scripts/lib/cover-image2-dispatch.mjs",
    "references/image2-dispatch-runtime.md",
  ]) {
    if (!existsSync(join(workspace, "skills", "codex-video-cover-generation", relativePath))) {
      fail(`standalone cover Skill runtime is missing ${relativePath}`);
    }
  }
  const evidenceRecorderPath = join(workspace, "scripts", "record-cover-generation-evidence.mjs");
  if (!existsSync(evidenceRecorderPath)) fail("dedicated cover evidence recorder is missing");
  const evidenceRecorderSource = readFileSync(evidenceRecorderPath, "utf8");
  for (const contract of [
    "CODEX_VIDEO_COVER_GENERATED_ROOT",
    "validateContextImage2PromptParity",
    "Generated source must remain outside the topic package",
    "native-target-ratio-match",
    "generationReceiptPath",
    "inspectionRecordPath",
  ]) {
    if (!evidenceRecorderSource.includes(contract)) fail(`cover evidence recorder is missing contract: ${contract}`);
  }

  console.log(JSON.stringify({ ok: true, root, routed, parity }, null, 2));
}

main();
