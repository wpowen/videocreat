const OFF_VALUES = new Set(["0", "false", "off", "no", "none", "disable", "disabled", "关闭", "禁用", "不要", "否"]);
const ON_VALUES = new Set(["1", "true", "on", "yes", "enable", "enabled", "开启", "启用", "是"]);

const PERSONAL_IP_POSITIVE_RE = /个人\s*IP|IP\s*角色|creator\s+persona|personal\s+IP|personal\s+brand|diagram\s+persona|角色主锚图|三张角色|我的\s*IP\s*形象|本人\s*形象/i;
const PERSONAL_IP_TERM_SOURCE = String.raw`(?:个人\s*IP|IP\s*角色|creator\s+persona|personal\s+IP|personal\s+brand|diagram\s+persona)`;
const PERSONAL_IP_NEGATIVE_RE = new RegExp(
  String.raw`(?:不要|不使用|不用|无需|不需要|不做|别用|禁止|关闭|禁用|取消|非|不是|并非|无).{0,8}${PERSONAL_IP_TERM_SOURCE}(?:\s*(?:或|和|及|、|or|and)\s*${PERSONAL_IP_TERM_SOURCE})*|(?:do\s+not|don't|without|no)\s+(?:use\s+)?(?:a\s+|my\s+|the\s+)?${PERSONAL_IP_TERM_SOURCE}(?:\s*(?:or|and|或|和|、)\s*(?:a\s+|my\s+|the\s+)?${PERSONAL_IP_TERM_SOURCE})*`,
  "gi",
);

export function normalizePlannerToggle(value) {
  if (value === true) return "on";
  if (value === false) return "off";
  if (value === null || value === undefined) return "auto";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "enabled")) return normalizePlannerToggle(value.enabled);
    if (Object.prototype.hasOwnProperty.call(value, "active")) return normalizePlannerToggle(value.active);
    if (Object.prototype.hasOwnProperty.call(value, "selected")) return normalizePlannerToggle(value.selected);
    const identityKeys = ["name", "displayName", "role", "manifest", "manifestPath", "assetRegistry", "photo", "image"];
    return identityKeys.some((key) => Boolean(value[key])) ? "on" : "auto";
  }
  const normalized = String(value).normalize("NFKC").trim().toLowerCase();
  if (!normalized || normalized === "auto") return "auto";
  if (OFF_VALUES.has(normalized)) return "off";
  if (ON_VALUES.has(normalized)) return "on";
  return "on";
}

function valuesFromBrief(brief = {}) {
  const scenes = Array.isArray(brief.scenes) ? brief.scenes : [];
  return [
    brief.title,
    brief.objective,
    brief.contentMode,
    brief.videoType,
    brief.visualMode,
    brief.visualSystem,
    brief.primaryVisualSystem,
    brief.visualPlanner,
    brief.plannerDriver,
    brief.plannerRoute,
    ...scenes.flatMap((scene) => [
      scene.label,
      scene.title,
      ...(Array.isArray(scene.headline) ? scene.headline : [scene.headline]),
      scene.body,
      scene.subtitle,
      scene.visualMode,
      scene.visualSystem,
      scene.primaryVisualSystem,
      scene.visualSeriesId,
    ]),
  ].filter(Boolean);
}

export function stripNegatedPersonalIpText(value = "") {
  return String(value || "").replace(PERSONAL_IP_NEGATIVE_RE, " [personal-ip-negated] ");
}

export function personalIpIntentForBrief(brief = {}) {
  const structuredCandidates = [
    ["personalIp", brief.personalIp],
    ["creatorPersona", brief.creatorPersona],
    ["ipCharacter", brief.ipCharacter],
    ["personalIpAssets", brief.personalIpAssets],
    ["authorizedRoleAssets", brief.authorizedRoleAssets],
    ["personalIpReference", brief.personalIpReference],
    ["personalIpPhoto", brief.personalIpPhoto],
    ["personalIpImage", brief.personalIpImage],
  ];
  const normalizedFields = structuredCandidates.map(([field, value]) => ({
    field,
    state: normalizePlannerToggle(value),
    present: value !== undefined && value !== null && value !== "",
  }));
  const explicitOn = normalizedFields.filter((entry) => entry.present && entry.state === "on");
  const explicitOff = normalizedFields.filter((entry) => entry.present && entry.state === "off");
  const text = valuesFromBrief(brief).join(" ");
  const negativeMatches = Array.from(text.matchAll(PERSONAL_IP_NEGATIVE_RE), (match) => match[0]);
  const positiveText = stripNegatedPersonalIpText(text);
  const textPositive = PERSONAL_IP_POSITIVE_RE.test(positiveText);
  const structuredState = explicitOn.length ? "on" : explicitOff.length ? "off" : "auto";
  const active = structuredState === "on" || (structuredState === "auto" && textPositive);
  return {
    active,
    state: active ? "on" : structuredState === "off" ? "off" : "auto",
    structuredState,
    explicitOnFields: explicitOn.map((entry) => entry.field),
    explicitOffFields: explicitOff.map((entry) => entry.field),
    textPositive,
    textNegated: negativeMatches.length > 0,
    negativeMatches,
    reason: explicitOn.length
      ? `structured personal-IP intent: ${explicitOn.map((entry) => entry.field).join(", ")}`
      : explicitOff.length
        ? `structured personal-IP opt-out: ${explicitOff.map((entry) => entry.field).join(", ")}`
        : textPositive
          ? "explicit non-negated personal-IP language"
          : negativeMatches.length
            ? "personal-IP language appears only in a negated context"
            : "no personal-IP intent",
  };
}

function textForScene(brief = {}, page = {}, index = 0) {
  const frame = page.frame || {};
  const sceneText = [
    page.id,
    page.visualRole,
    page.imageRole,
    page.shotTemplate,
    frame.label,
    frame.title,
    ...(Array.isArray(frame.headline) ? frame.headline : [frame.headline]),
    frame.body,
    frame.subtitle,
    frame.visualMode,
    frame.visualStyle,
    frame.visualSeriesId,
  ].filter(Boolean).join(" ");
  const globalText = index === 0
    ? [brief.title, brief.objective, brief.contentMode, brief.videoType, brief.visualMode].filter(Boolean).join(" ")
    : "";
  return `${globalText} ${sceneText}`.normalize("NFKC").trim();
}

function addMatch(result, label, condition, weight) {
  if (!condition) return;
  result.score += weight;
  result.matchedSignals.push(label);
}

function scoreSeries(seriesId, text, context = {}) {
  const result = { seriesId, score: 0, matchedSignals: [], negativeSignals: [] };
  const has = (pattern) => pattern.test(text);
  switch (seriesId) {
    case "knowledge-encyclopedia-card-v1":
      addMatch(result, "one-subject-many-attributes", has(/主体.{0,8}(?:档案|属性|特征)|单一主体.{0,8}(?:档案|属性)|subject\s+profile/i), 5);
      addMatch(result, "rating-or-roundup", has(/盘点|评分|评级|排行|top\s*[- ]?\d+|roundup|rating/i), 4);
      addMatch(result, "structured-science", has(/结构化科普|科普(?:卡|结构|档案)|冷知识|百科/i), 4);
      if (has(/逐个介绍|每个.{0,8}一张|图鉴|多个(?:物种|个体)/i)) result.negativeSignals.push("repeated-specimens");
      if (has(/步骤|清单|避坑|阵营|关系边/i)) result.negativeSignals.push("stronger-structure-present");
      break;
    case "strategy-guide-board-v1":
      addMatch(result, "ordered-steps", has(/第?一(?:步|阶段).{0,30}第?二(?:步|阶段)|先.{0,16}再|步骤|step[- ]?by[- ]?step|ordered\s+tutorial/i), 5);
      addMatch(result, "checklist", has(/检查清单|行动清单|checklist|do\s*\/\s*don'?t/i), 4);
      addMatch(result, "pitfall-warning", has(/避坑|注意事项|常见坑|pitfall|how\s+to|教程/i), 4);
      if (has(/人物关系|阵营|物种图鉴|超现实|水墨/i)) result.negativeSignals.push("different-content-shape");
      break;
    case "relationship-map-poster-v1":
      addMatch(result, "multiple-nodes-typed-edges", has(/人物.{0,12}(?:关系|阵营)|阵营.{0,16}(?:关系|联盟|冲突)|联盟|关系边|谁和谁|typed\s+edges/i), 6);
      addMatch(result, "concept-network", has(/概念关系|组织结构|因果网络|关系图谱|cluster\s+network/i), 4);
      if (has(/同一个主体|同一主体|跨时间|多状态/i)) result.negativeSignals.push("same-subject-states");
      break;
    case "collection-atlas-card-v1":
      addMatch(result, "collection-series", has(/图鉴|收藏卡|atlas|field\s+guide/i), 6);
      addMatch(result, "repeated-specimens", has(/逐个介绍|每个.{0,10}(?:一张|一卡|单独)|多个(?:物种|动植物|动物|植物|物品|工具)|物种/i), 5);
      if (has(/单一主体|一个主体|评分排行/i)) result.negativeSignals.push("single-subject-profile");
      break;
    case "editorial-cover-hook-v1":
      addMatch(result, "opening-or-divider", has(/开场.{0,12}(?:hook|钩子)|章节分隔|主题揭示|标题页|封面式开场|chapter\s+divider|topic\s+reveal/i), 6);
      addMatch(result, "short-title-role", has(/短标题|杂志封面|editorial\s+cover/i), 3);
      break;
    case "surreal-carrier-poster-v1":
      addMatch(result, "surreal-metaphor", has(/超现实|视觉隐喻|概念隐喻|梦境|surreal|concept\s+metaphor/i), 6);
      addMatch(result, "wonder-transition", has(/惊奇.{0,10}(?:hook|钩子)|隐喻.{0,10}转场|载体.{0,10}转场|wonder\s+hook/i), 4);
      break;
    case "oriental-ink-atmosphere-v1": {
      const culture = has(/中国文化|东方文化|传统文化|历史题材|诗词|水墨|oriental|ink\s+wash/i);
      const breath = has(/留白|季节流逝|岁月|时间流逝|节奏呼吸|平静收尾|calm\s+ending|pacing\s+breath/i);
      addMatch(result, "culture-or-history", culture, 4);
      addMatch(result, "intentional-breath-or-ending", culture && breath, 6);
      if (!culture || !breath) result.negativeSignals.push("requires-culture-and-breathing-signal");
      break;
    }
    case "interface-mockup-plate-v1": {
      const product = has(/SaaS|软件|产品功能|工具.{0,10}(?:功能|讲解)|product\s+feature|tool\s+walkthrough/i);
      const ui = has(/操作界面|界面.{0,10}(?:状态|讲解|操作)|工作流状态|dashboard|interface|workflow\s+state/i);
      addMatch(result, "tool-or-product", product, 4);
      addMatch(result, "software-interface-state", product && ui, 6);
      if (context.realScreenshotAvailable || has(/(?:已有|有|使用|提供).{0,8}(?:真实|授权).{0,6}截图|authorized\s+real\s+screenshot/i)) {
        result.negativeSignals.push("authorized-real-screenshot-available");
      }
      break;
    }
    case "photo-collage-grid-v1": {
      const sameSubject = has(/同一个(?:主体|产品|角色|对象)|同一(?:主体|产品|角色|对象)|same\s+subject/i);
      const states = has(/演进|迭代|多状态|前后对比|跨时间|时间拼贴|progression|multi[- ]state|before[- ]after/i);
      addMatch(result, "same-subject-multiple-states", sameSubject && states, 7);
      addMatch(result, "progression-or-recap", has(/回顾.{0,12}(?:演进|变化|状态)|从初版到|三次迭代|time\s+progression/i), 4);
      if (has(/人物关系|阵营|关系边/i)) result.negativeSignals.push("typed-relationship-edges");
      break;
    }
    default:
      break;
  }
  result.score -= result.negativeSignals.length * 3;
  return result;
}

function explicitSeriesIdForScene(brief = {}, page = {}) {
  const frame = page.frame || {};
  return frame.visualSeriesId
    || frame.seriesId
    || page.visualSeriesId
    || brief.visualSeriesId
    || brief.seriesId
    || null;
}

export function selectVisualSeriesForScene({ brief = {}, page = {}, index = 0, catalog = {}, personalIpIntent = {} } = {}) {
  const series = Array.isArray(catalog.series) ? catalog.series : [];
  const explicitSeriesId = explicitSeriesIdForScene(brief, page);
  if (personalIpIntent.active) {
    return {
      sceneId: page.id || page.frame?.id || `scene-${index + 1}`,
      selectedSeriesId: null,
      selectionMode: "none",
      decision: "suppressed-by-personal-ip",
      precedenceWinner: "personal-ip",
      explicitSeriesId,
      textPolicy: "text-safe",
      autoActivated: false,
      finalEligible: false,
      matchedSignals: [],
      rejectedCandidates: explicitSeriesId ? [{ seriesId: explicitSeriesId, reason: "personal-IP route has precedence" }] : [],
      blockedReason: null,
    };
  }
  const explicitSeries = explicitSeriesId ? series.find((entry) => entry.seriesId === explicitSeriesId) : null;
  if (explicitSeriesId && !explicitSeries) {
    return {
      sceneId: page.id || page.frame?.id || `scene-${index + 1}`,
      selectedSeriesId: null,
      selectionMode: "explicit-invalid",
      decision: "blocked-invalid-series",
      precedenceWinner: "invalid-explicit-series",
      explicitSeriesId,
      textPolicy: "text-safe",
      autoActivated: false,
      finalEligible: false,
      matchedSignals: [],
      rejectedCandidates: [],
      blockedReason: `unknown visual series: ${explicitSeriesId}`,
    };
  }
  const text = textForScene(brief, page, index);
  const scored = series
    .map((entry) => ({ entry, ...scoreSeries(entry.seriesId, text, {
      realScreenshotAvailable: Boolean(brief.realScreenshotAvailable || brief.authorizedScreenshotAvailable || page.frame?.realScreenshotAvailable),
    }) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || Number(right.entry.routing?.priority || 0) - Number(left.entry.routing?.priority || 0));
  const winner = explicitSeries
    ? { entry: explicitSeries, seriesId: explicitSeries.seriesId, score: 100, matchedSignals: ["explicit-series-id"], negativeSignals: [] }
    : scored[0];
  if (!winner || (!explicitSeries && winner.score < Number(catalog.routingContract?.thresholds?.recommend || 6))) {
    return {
      sceneId: page.id || page.frame?.id || `scene-${index + 1}`,
      selectedSeriesId: null,
      selectionMode: "none",
      decision: "no-series",
      precedenceWinner: "fallback-planner",
      explicitSeriesId: null,
      textPolicy: "text-safe",
      autoActivated: false,
      finalEligible: false,
      matchedSignals: [],
      rejectedCandidates: scored.slice(0, 3).map((candidate) => ({
        seriesId: candidate.seriesId,
        score: candidate.score,
        reason: "below recommendation threshold or lost conflict resolution",
      })),
      blockedReason: null,
    };
  }
  const seriesStatus = winner.entry.status || "candidate";
  const finalEligible = seriesStatus === "approved";
  const autoActivated = finalEligible && (explicitSeries || winner.score >= Number(catalog.routingContract?.thresholds?.autoSelectApproved || 8));
  return {
    sceneId: page.id || page.frame?.id || `scene-${index + 1}`,
    selectedSeriesId: winner.seriesId,
    seriesName: winner.entry.name,
    seriesStatus,
    selectionMode: explicitSeries ? "explicit" : "planner-score",
    decision: finalEligible ? (autoActivated ? "auto-select-approved" : "recommend-approved") : "recommend-only",
    precedenceWinner: explicitSeries ? "explicit-visual-series" : "visual-series-planner",
    explicitSeriesId: explicitSeriesId || null,
    score: winner.score,
    textPolicy: "text-safe",
    autoActivated,
    finalEligible,
    matchedSignals: winner.matchedSignals,
    negativeSignals: winner.negativeSignals,
    rejectedCandidates: scored
      .filter((candidate) => candidate.seriesId !== winner.seriesId)
      .slice(0, 4)
      .map((candidate) => ({
        seriesId: candidate.seriesId,
        score: candidate.score,
        matchedSignals: candidate.matchedSignals,
        reason: "lower-scoring or lower-priority content shape",
      })),
    generationStatus: finalEligible ? "ready-for-approved-series-planning" : "pending-series-approval-or-user-draft-confirmation",
    blockedReason: null,
  };
}

export function buildVisualSeriesRoutingPlan({ brief = {}, pages = [], catalog = {}, personalIpIntent = null } = {}) {
  const resolvedPersonalIpIntent = personalIpIntent || personalIpIntentForBrief(brief);
  const sceneDecisions = pages.map((page, index) => selectVisualSeriesForScene({
    brief,
    page,
    index,
    catalog,
    personalIpIntent: resolvedPersonalIpIntent,
  }));
  const selected = sceneDecisions.filter((decision) => decision.selectedSeriesId);
  return {
    schemaVersion: 1,
    stage: "pre-render-visual-series-routing",
    status: "ready",
    sourceCatalog: "assets/gpt-image-2-visual-series-catalog.json",
    personalIpBoundary: {
      active: resolvedPersonalIpIntent.active,
      state: resolvedPersonalIpIntent.state,
      reason: resolvedPersonalIpIntent.reason,
      precedence: "explicit non-negated personal-IP intent wins before non-persona visual series",
    },
    videoDecision: {
      precedenceWinner: resolvedPersonalIpIntent.active
        ? "personal-ip-wins"
        : selected.some((decision) => decision.selectionMode === "explicit")
          ? "explicit-visual-series"
          : selected.length
            ? "scene-series-planner"
            : "fallback-planner",
      selectedSeriesIds: [...new Set(selected.map((decision) => decision.selectedSeriesId))],
      candidateSeriesOnly: selected.length > 0 && selected.every((decision) => decision.seriesStatus === "candidate"),
      finalAutoEligible: selected.some((decision) => decision.finalEligible && decision.autoActivated),
      rule: "one primary route per scene; candidate series are recommendations only and cannot silently enter final composition",
    },
    sceneDecisions,
  };
}
