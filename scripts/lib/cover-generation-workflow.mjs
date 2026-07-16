import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export { buildCoverGenerationWorkflowContract } from "../../skills/codex-video-cover-generation/scripts/lib/cover-generation-workflow-contract.mjs";

export function sha256Text(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeCoverTargetId(value = "") {
  return String(value || "").replace(/-image2-integrated-cover$/, "");
}

function uniqueCoverTargetIds(values = []) {
  return [...new Set(values.map(normalizeCoverTargetId).filter(Boolean))];
}

function sameTargetSet(left = [], right = []) {
  const a = uniqueCoverTargetIds(left).sort();
  const b = uniqueCoverTargetIds(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function resolveCoverRequestScope({ brief = {}, availableTargetIds = [], primaryTargetId = "" } = {}) {
  const plannedTargetIds = uniqueCoverTargetIds(availableTargetIds);
  const explicitTargetIds = uniqueCoverTargetIds([
    ...(Array.isArray(brief.coverTargetIds) ? brief.coverTargetIds : []),
    ...(Array.isArray(brief.coverTargets) ? brief.coverTargets : []),
  ]).filter((targetId) => plannedTargetIds.includes(targetId));
  const primaryOnly = brief.coverPrimaryOnly === true
    || brief.coverAllPlatforms === false
    || brief.generateAllPlatformCovers === false;
  const mode = explicitTargetIds.length
    ? "explicit-target-list"
    : primaryOnly
      ? "explicit-primary-only"
      : "all-planned-platform-targets";
  const requestedTargetIds = explicitTargetIds.length
    ? explicitTargetIds
    : primaryOnly
      ? [normalizeCoverTargetId(primaryTargetId) || plannedTargetIds[0]].filter(Boolean)
      : plannedTargetIds;
  const scopeNarrowed = !sameTargetSet(requestedTargetIds, plannedTargetIds);
  const authorization = brief.coverScopeAuthorization && typeof brief.coverScopeAuthorization === "object"
    ? brief.coverScopeAuthorization
    : {};
  const authorizationPass = !scopeNarrowed || (
    authorization.authorizedByUser === true
    && authorization.mode === mode
    && sameTargetSet(authorization.requestedTargetIds, requestedTargetIds)
    && Boolean(String(authorization.source || "").trim())
  );
  if (!authorizationPass) {
    throw new Error(
      `Cover scope narrowing requires explicit user authorization: planned ${plannedTargetIds.length} target(s), requested ${requestedTargetIds.length}. Add coverScopeAuthorization with authorizedByUser=true, mode=${mode}, matching requestedTargetIds, and a user-request source.`,
    );
  }
  return {
    mode,
    plannedTargetIds,
    requestedTargetIds,
    scopeNarrowed,
    scopeAuthorizationRequired: scopeNarrowed,
    scopeAuthorizationPass: authorizationPass,
    scopeAuthorization: scopeNarrowed ? {
      authorizedByUser: true,
      mode,
      requestedTargetIds,
      source: String(authorization.source || "").trim(),
    } : null,
  };
}

export function validateCoverRequestScopeContract({ manifest = {}, coverImage2Prompts = {} } = {}) {
  const failures = [];
  const contract = manifest.requestCountContract || {};
  const promptItems = Array.isArray(coverImage2Prompts?.prompts) ? coverImage2Prompts.prompts : [];
  const plannedTargetIds = uniqueCoverTargetIds(promptItems.map((item) => item.targetId || item.id));
  const requestedTargetIds = uniqueCoverTargetIds(contract.requestedTargetIds || []);
  const actualTargetIds = uniqueCoverTargetIds((manifest.requests || []).map((request) => request.targetId || request.id));
  const mode = String(contract.mode || "");
  const scopeNarrowed = plannedTargetIds.length > 0 && !sameTargetSet(requestedTargetIds, plannedTargetIds);
  if (!plannedTargetIds.length) failures.push("cover prompt plan contains no platform targets");
  if (!requestedTargetIds.length) failures.push("requestCountContract contains no requested target ids");
  if (!sameTargetSet(actualTargetIds, requestedTargetIds)) failures.push("actual cover requests do not match requestCountContract.requestedTargetIds");
  if (Number(contract.expectedRequestCount) !== requestedTargetIds.length) failures.push("requestCountContract.expectedRequestCount does not match requested target count");
  if (Number(contract.actualRequestCount) !== actualTargetIds.length) failures.push("requestCountContract.actualRequestCount does not match manifest request count");
  if (mode === "all-planned-platform-targets" && !sameTargetSet(requestedTargetIds, plannedTargetIds)) {
    failures.push("all-planned-platform-targets request scope does not include every planned cover target");
  }
  if (mode === "explicit-primary-only" && requestedTargetIds.length !== 1) {
    failures.push("explicit-primary-only request scope must contain exactly one target");
  }
  if (!["all-planned-platform-targets", "explicit-primary-only", "explicit-target-list"].includes(mode)) {
    failures.push(`unsupported requestCountContract mode: ${mode || "missing"}`);
  }
  if (scopeNarrowed) {
    const authorization = contract.scopeAuthorization || {};
    if (authorization.authorizedByUser !== true
      || authorization.mode !== mode
      || !sameTargetSet(authorization.requestedTargetIds, requestedTargetIds)
      || !String(authorization.source || "").trim()) {
      failures.push("narrowed cover scope lacks matching explicit user authorization");
    }
  }
  if (contract.scopeAuthorizationRequired !== scopeNarrowed) failures.push("requestCountContract.scopeAuthorizationRequired is inconsistent with the planned/requested scope");
  if (contract.scopeAuthorizationPass !== true) failures.push("requestCountContract.scopeAuthorizationPass is not true");
  if (Number(contract.plannedTargetCount) !== plannedTargetIds.length) failures.push("requestCountContract.plannedTargetCount does not match the cover prompt plan");
  if (!sameTargetSet(contract.plannedTargetIds || [], plannedTargetIds)) failures.push("requestCountContract.plannedTargetIds does not match the cover prompt plan");
  if (contract.pass !== true) failures.push("requestCountContract.pass is not true");
  return {
    pass: failures.length === 0,
    mode,
    plannedTargetIds,
    requestedTargetIds,
    actualTargetIds,
    plannedTargetCount: plannedTargetIds.length,
    requestedTargetCount: requestedTargetIds.length,
    actualTargetCount: actualTargetIds.length,
    scopeNarrowed,
    failures,
  };
}

function coverTitleDescription(value) {
  return String(value || "")
    .replace(/^《|》$/gu, "")
    .replace(/^第\s*[\d０-９一二三四五六七八九十百]+\s*[章节讲集课期]*\s*[：:、.\-\s]+/u, "")
    .trim();
}

function writingMethodCoverHook(raw) {
  const text = String(raw || "");
  const rules = [
    [/黄金开篇|开篇|开头|第一章/, ["开头没人看?", "第一章留人", "为什么翻走"]],
    [/选题决策|灵感转化为小说主题|十个灵感|10个灵感|主项目|备用项目|作者资源|资源匹配|四层检查|四层筛选/, ["灵感怎么选?", "10个只留1个", "先筛再写"]],
    [/小说不是灵感产品|不是灵感|灵感产品|灵感/, ["灵感不够", "读者买承诺", "别等灵感"]],
    [/题材|平台|读者画像|读者/, ["写给谁看?", "题材先匹配", "别选错战场"]],
    [/一句话卖点|卖点|核心循环|循环/, ["一句话卖点", "追更靠循环", "先卖清楚"]],
    [/故事发动机|发动机/, ["故事会自转", "欲望冲突供能", "别靠硬推"]],
    [/冲突三层|三层冲突|冲突/, ["冲突不止吵", "三层一起压", "压力从哪来"]],
    [/筹码|压迫/, ["筹码上桌", "压迫逼选择", "代价够不够"]],
    [/钩子系统|钩子/, ["钩子别断", "每段给追问", "一直想看"]],
    [/爽点|压缩释放|释放/, ["爽点要蓄压", "压住再释放", "爆点才爽"]],
    [/长篇规划|规划|大纲|长篇/, ["写着写着崩?", "先搭骨架", "后面不塌"]],
    [/雪花法|递进规划|递进/, ["一句话变全书", "从小到大", "别一上来硬写"]],
    [/场景|最小故事单元/, ["每场都要变", "别写流水账", "一场一推动"]],
    [/章纲|Scene Contract|场景契约/, ["章纲别空写", "每章有合同", "写前先锁定"]],
    [/伏笔|契诃夫|Payoff Ledger|回收/, ["埋了就兑现", "伏笔别失踪", "回收才爽"]],
    [/反转|误导/, ["反转别硬拧", "骗读者要公平", "真正原因"]],
    [/角色三支柱|角色支柱/, ["角色立不住?", "三根柱子", "别只写人设"]],
    [/角色弧线|关系债/, ["关系债推进", "人物会变", "别原地打转"]],
    [/人物欲望|误信念|人物选择系统|选择系统/, ["人物为什么活?", "误信念逼选择", "为什么越想保护越会推远"]],
    [/反派|对手/, ["对手越强越稳", "反派别工具化", "压力才好看"]],
    [/对话声纹|声纹|对白|对话/, ["一听就知道谁", "对白别同腔", "声音有身份"]],
    [/画面感|文采/, ["先让人看见", "文采别堆词", "画面压过形容"]],
    [/去\s*AI\s*味|AI味|AI 味/, ["别像模板文", "去掉AI腔", "让句子像人写"]],
    [/节奏|信息编排/, ["信息给太早?", "节奏会控场", "别一次说完"]],
    [/审稿|修稿|闭环/, ["修完再复检", "审稿有闭环", "别只改错字"]],
    [/脑洞|连载样稿|样稿/, ["脑洞变样稿", "先写可连载", "别停在设定"]],
  ];
  const match = rules.find(([pattern]) => pattern.test(text));
  if (!match) return null;
  const [hookText, payoffText, gapText] = match[1];
  return {
    hookText,
    payoffText,
    curiosityGap: `为什么「${coverTitleDescription(text).replace(/^写小说方法论[：:]?/u, "") || text}」决定读者会不会继续看？`,
    viewerDecision: `一秒内看懂：这不是课程PPT，而是解决「${hookText.replace("?", "")}」的写作封面承诺。`,
    gapText,
  };
}

export function resolveTitleFirstWritingMethodCoverHook({ titleText = "", frameText = "" } = {}) {
  return writingMethodCoverHook(titleText) || writingMethodCoverHook(frameText);
}

export function formatContextImage2CoverPromptDocument({ request = {}, coverTitle = "" } = {}) {
  return [
    `Context Image2 cover request: ${request.targetId || ""}`,
    `Cover title: ${coverTitle || request.coverTitle || ""}`,
    `Target: ${request.width || ""}x${request.height || ""} (${request.ratio || ""})`,
    "Use Codex Context Image2 / image_gen. Generate a complete native-ratio cover bitmap with integrated Chinese thumbnail typography from the prompt below.",
    "Do not create a local SVG/HTML substitute. Keep the original PNG at an external image_gen staging path until ingest completes. Do not copy it into this package before ingest; the ingest command will copy and normalize it.",
    "",
    request.prompt || "",
  ].join("\n");
}

export function validateContextImage2PromptParity({ topicDir, manifest } = {}) {
  const failures = [];
  const entries = [];
  for (const request of manifest?.requests || []) {
    const targetId = request.targetId || "unknown-target";
    const promptPath = request.promptPath ? join(topicDir, request.promptPath) : "";
    const expectedDocument = formatContextImage2CoverPromptDocument({
      request,
      coverTitle: request.coverTitle || manifest?.coverTitle || "",
    });
    const expectedPromptSha256 = sha256Text(request.prompt || "");
    const expectedPromptFileSha256 = sha256Text(expectedDocument);
    if (!promptPath || !existsSync(promptPath)) {
      failures.push(`${targetId}: prompt file is missing`);
      entries.push({ targetId, promptPath: request.promptPath || "", pass: false });
      continue;
    }
    const actualDocument = readFileSync(promptPath, "utf8");
    const actualPromptFileSha256 = sha256Text(actualDocument);
    if (request.promptSha256 && request.promptSha256 !== expectedPromptSha256) {
      failures.push(`${targetId}: request prompt hash does not match the canonical prompt`);
    }
    if (request.promptFileSha256 && request.promptFileSha256 !== expectedPromptFileSha256) {
      failures.push(`${targetId}: recorded prompt file hash does not match the canonical prompt document`);
    }
    if (actualPromptFileSha256 !== expectedPromptFileSha256) {
      failures.push(`${targetId}: prompt file differs from the canonical request document`);
    }
    entries.push({
      targetId,
      promptPath: request.promptPath,
      promptSha256: expectedPromptSha256,
      promptFileSha256: actualPromptFileSha256,
      expectedPromptFileSha256,
      pass: actualPromptFileSha256 === expectedPromptFileSha256,
    });
  }
  return { pass: failures.length === 0, checkedRequestCount: entries.length, failures, entries };
}

export function buildCoverStatusSnapshot({
  imageSource = "",
  platformReadiness = {},
  coverImage2Qc = {},
  coverSizeSelection = {},
  requestManifest = {},
  coverDesign = {},
} = {}) {
  const requests = Array.isArray(requestManifest?.requests) ? requestManifest.requests : [];
  const completedRequestCount = requests.filter((request) => request.status === "completed").length;
  const pendingRequestCount = Math.max(0, requests.length - completedRequestCount);
  const completedContextImage2Request = requests.find((request) => request.status === "completed"
    && (request.provider === "codex-context-image2" || request.tool === "image_gen"));
  const resolvedImageSource = completedContextImage2Request
    ? (completedContextImage2Request.provider || requestManifest?.provider || "codex-context-image2")
    : imageSource;
  const needsRegeneration = Array.isArray(coverSizeSelection?.needsRegeneration)
    ? coverSizeSelection.needsRegeneration
    : [];
  return {
    imageSource: resolvedImageSource,
    primaryPlatformUploadCoverTargetId: platformReadiness.targetId || requestManifest?.primaryPlatformUploadCoverTargetId || "",
    primaryPlatformUploadCoverReady: platformReadiness.ready === true,
    platformSubmissionCoverReady: platformReadiness.ready === true,
    allRequestedPlatformUploadCoversReady: requestManifest?.allRequestedPlatformUploadCoversReady === true
      || (requests.length > 0 && completedRequestCount === requests.length),
    completedRequestCount,
    pendingRequestCount,
    promptQualityPass: coverImage2Qc?.promptQualityPass === true,
    finalCoverQualityEligible: coverImage2Qc?.finalCoverQualityEligible === true,
    reviewFallbackOnly: coverImage2Qc?.reviewFallbackOnly === true,
    contextImage2Required: coverImage2Qc?.contextImage2Required !== false,
    contextImage2HandoffRequired: coverImage2Qc?.contextImage2HandoffRequired === true,
    allEntriesUploadReady: coverSizeSelection?.allEntriesUploadReady === true,
    needsRegenerationCount: needsRegeneration.length,
    rootOutputCopies: Array.isArray(coverDesign?.rootOutputCopies) ? coverDesign.rootOutputCopies : [],
    blockers: [
      ...(Array.isArray(platformReadiness?.failures) ? platformReadiness.failures : []),
      ...(Array.isArray(coverImage2Qc?.blockers) ? coverImage2Qc.blockers : []),
    ],
  };
}
