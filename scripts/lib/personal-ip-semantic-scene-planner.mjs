import { buildAdaptiveCountPlan } from "./adaptive-content-scene-planner.mjs";

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizedText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function comparableText(value = "") {
  return normalizedText(value).replace(/\s+/g, "");
}

function splitSemanticUnits(value = "") {
  const text = normalizedText(value);
  if (!text) return [];
  const sentences = text
    .split(/(?<=[。！？!?；;])\s*/u)
    .map(normalizedText)
    .filter(Boolean);
  return sentences.length ? sentences : [text];
}

export function classifyPersonalIpSemanticLayout(scene = {}) {
  const beatIndex = Math.max(1, Number(scene.beatIndex || 1));
  const methodologyUnits = Array.isArray(scene.methodologyVisualUnits) ? scene.methodologyVisualUnits : [];
  const methodologyKinds = new Set(methodologyUnits.map((unit) => normalizedText(unit?.kind || unit?.type).toLowerCase()).filter(Boolean));
  const text = normalizedText([
    scene.title,
    scene.subtitle,
    scene.takeaway,
    scene.sourceLabel,
    ...(Array.isArray(scene.sourceHeadline) ? scene.sourceHeadline : []),
    scene.sourceSubtitle,
    scene.spokenText,
    scene.methodologyText,
    ...(Array.isArray(scene.semanticUnits) ? scene.semanticUnits : []),
    ...(Array.isArray(scene.hookItems) ? scene.hookItems.flatMap((item) => Array.isArray(item) ? item.slice(1, 3) : [item?.label, item?.body]) : []),
    ...(Array.isArray(scene.routeItems) ? scene.routeItems.flatMap((item) => Array.isArray(item) ? item.slice(1, 3) : [item?.label, item?.body]) : []),
    ...methodologyUnits.map((unit) => unit?.text),
  ].filter(Boolean).join(" "));
  let contentKind = "core-statement";
  let layoutVariant = "editorial-statement";
  let motionVerb = "reveal";
  let visualMetaphor = "一张被批注的核心判断纸";

  // Only the first literary beat is an actual quote-stage.  Previously the
  // opening source page's literary/example label contaminated every expanded
  // beat, so four different teaching jobs all collapsed into a paragraph card.
  const isLiteraryOpening = /《[^》]+》|王熙凤|声音就先到了/.test(text);
  const isQuoteBeat = /《[^》]+》|王熙凤|我来迟了|引文|引用/.test([
    scene.title,
    scene.subtitle,
    ...(Array.isArray(scene.semanticUnits) ? scene.semanticUnits.slice(0, 3) : []),
  ].filter(Boolean).join(" "));
  if (isLiteraryOpening && (beatIndex === 1 || isQuoteBeat)) {
    contentKind = "literary-example";
    layoutVariant = "quote-stage";
    motionVerb = "inspect";
    visualMetaphor = "人物先于解释进入现场的引文舞台";
  } else if (/评分|量表|满分|一百\s*分|100\s*分|得分|分值/.test(text) || methodologyKinds.has("scorecard")) {
    contentKind = "scorecard";
    layoutVariant = "scorecard";
    motionVerb = "accumulate";
    visualMetaphor = "人物系统体检评分单";
  } else if ((methodologyKinds.has("checklist") || /检查清单|完成清单|逐项勾选|快速检查|完成前检查|验收清单/.test(text))) {
    contentKind = "checklist";
    layoutVariant = "action-checklist";
    motionVerb = "resolve";
    visualMetaphor = "可逐项勾选的人物选择工单";
  } else if (/七张.{0,10}表|第一张|第二张|第三张|第四张|第五张|第六张|第七张/.test(text)) {
    contentKind = "method-path";
    layoutVariant = "method-path";
    motionVerb = "trace";
    visualMetaphor = "七张表从证据走向可执行选择";
  } else if (/四样东西|欲望.{0,12}目标.{0,12}需要.{0,12}误信念|四项动力|四个词/.test(text)) {
    contentKind = "four-force-model";
    layoutVariant = "force-compass";
    motionVerb = "connect";
    visualMetaphor = "人物选择系统的四向罗盘";
  } else if (methodologyKinds.has("checklist")) {
    contentKind = "checklist";
    layoutVariant = "action-checklist";
    motionVerb = "resolve";
    visualMetaphor = "可逐项勾选的人物选择工单";
  } else if (/欲望.{0,12}目标.{0,12}需要.{0,12}误信念|四项动力|四个词/.test(text)) {
    contentKind = "four-force-model";
    layoutVariant = "force-compass";
    motionVerb = "connect";
    visualMetaphor = "人物选择系统的四向罗盘";
  } else if (/镜像|主角.{0,8}对手|对手.{0,8}主角|弱版本|强版本|对比/.test(text)) {
    contentKind = "comparison";
    layoutVariant = "mirror-split";
    motionVerb = "compare";
    visualMetaphor = "主角与对手隔着镜面互相施压";
  } else if (/资源|权限|关系|信息|先发解释权|三阶升级|反制/.test(text) && /对手|限制|代价|策略|动作/.test(text)) {
    contentKind = "resource-system";
    layoutVariant = "resource-pressure-map";
    motionVerb = "pressure";
    visualMetaphor = "对手把多种资源接入压力网络";
  } else if (/因果链|导致|因为.{0,20}所以|短期收益|保护性策略/.test(text)) {
    contentKind = "causal-model";
    layoutVariant = "causal-chain";
    motionVerb = "trace";
    visualMetaphor = "误信念驱动选择并累积代价的因果链";
  } else if (/错误选择|替代项|替代行动|三个选择|三次选择|后果表/.test(text)) {
    contentKind = "choice-system";
    layoutVariant = "choice-branches";
    motionVerb = "compare";
    visualMetaphor = "一个决定分叉成错误路径与替代路径";
  } else if (/人物弧线|四节点|旧信念|真相信念|崩塌|转变|起点.{0,16}终点/.test(text)) {
    contentKind = "transformation-timeline";
    layoutVariant = "arc-timeline";
    motionVerb = "transform";
    visualMetaphor = "人物从旧信念跨向新选择的弧线";
  } else if (/检查清单|完成清单|逐项勾选|快速检查|七种失败|硬门槛|检查表|完成前检查|验收清单/.test(text)) {
    contentKind = "checklist";
    layoutVariant = "action-checklist";
    motionVerb = "resolve";
    visualMetaphor = "可逐项勾选的人物选择工单";
  } else if (methodologyKinds.has("table") || /填写要求|项目.{0,8}要求|表格|动机表|资源表/.test(text)) {
    contentKind = "evidence-ledger";
    layoutVariant = "evidence-ledger";
    motionVerb = "inspect";
    visualMetaphor = "把抽象判断落到可填写的证据账本";
  } else if (methodologyKinds.has("steps") || /第[一二三四五六七八九十0-9]+步|步骤|流程|路径|先.{0,12}再.{0,12}最后/.test(text)) {
    contentKind = "method-path";
    layoutVariant = "method-path";
    motionVerb = "trace";
    visualMetaphor = "角色带着执行者走过一条方法路径";
  }

  return {
    id: scene.id || "",
    contentKind,
    layoutVariant,
    motionVerb,
    visualMetaphor,
    classificationEvidence: {
      methodologyKinds: [...methodologyKinds],
      textSample: text.slice(0, 180),
    },
  };
}

function splitTextToMinimumUnits(value = "", minimum = 1) {
  const units = splitSemanticUnits(value);
  if (units.length >= minimum) return units;
  const text = normalizedText(value);
  if (!text) return [];
  const targetLength = Math.max(12, Math.ceil(Array.from(text).length / minimum));
  const chars = Array.from(text);
  const chunks = [];
  for (let index = 0; index < chars.length; index += targetLength) {
    chunks.push(chars.slice(index, index + targetLength).join(""));
  }
  return chunks.filter(Boolean);
}

function partitionContiguous(items = [], count = 1) {
  if (!items.length) return Array.from({ length: count }, () => []);
  const safeCount = Math.max(1, Math.min(count, items.length));
  const groups = [];
  let cursor = 0;
  for (let index = 0; index < safeCount; index += 1) {
    const remainingItems = items.length - cursor;
    const remainingGroups = safeCount - index;
    const take = Math.ceil(remainingItems / remainingGroups);
    groups.push(items.slice(cursor, cursor + take));
    cursor += take;
  }
  return groups;
}

function allocateSceneCounts(rows = [], target = 1) {
  if (!rows.length) return [];
  const counts = rows.map(() => 1);
  let remaining = Math.max(0, target - rows.length);
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0) || rows.length;
  const quotas = rows.map((row) => remaining * row.weight / totalWeight);
  quotas.forEach((quota, index) => {
    const addition = Math.floor(quota);
    counts[index] += addition;
    remaining -= addition;
  });
  const ranked = quotas
    .map((quota, index) => ({ index, remainder: quota - Math.floor(quota), weight: rows[index].weight }))
    .sort((left, right) => right.remainder - left.remainder || right.weight - left.weight || left.index - right.index);
  for (let index = 0; remaining > 0; index += 1) {
    counts[ranked[index % ranked.length].index] += 1;
    remaining -= 1;
  }
  return counts;
}

function frameCueItems(frame = {}) {
  const cues = Array.isArray(frame.subtitleCues) ? frame.subtitleCues : [];
  return cues.map((cue, index) => ({
    index: index + 1,
    text: normalizedText(cue?.text || cue?.subtitle || cue),
    spokenText: normalizedText(cue?.spokenText || cue?.text || cue?.subtitle || cue),
    durationSeconds: positiveNumber(cue?.duration, positiveNumber(cue?.end) - positiveNumber(cue?.start)),
  })).filter((cue) => cue.spokenText || cue.text);
}

function sourceRows({ pages = [], frames = [] } = {}) {
  return pages.map((page, index) => {
    const frame = frames[index] || page.frame || {};
    const cues = frameCueItems(frame);
    const spokenText = normalizedText(
      frame.spokenText
      || cues.map((cue) => cue.spokenText).join("")
      || frame.body
      || frame.subtitle
      || page.frame?.subtitle
      || frame.label
      || page.id,
    );
    const durationSeconds = positiveNumber(frame.durationSec, positiveNumber(page.durationSec));
    const charCount = Array.from(spokenText.replace(/\s/g, "")).length;
    return {
      page,
      frame,
      sourcePageId: String(page.id || frame.id || `source-page-${index + 1}`),
      sourcePageOrder: index + 1,
      durationSeconds,
      cues,
      methodologyVisualUnits: Array.isArray(frame.methodologyVisualUnits) ? frame.methodologyVisualUnits : [],
      spokenText,
      charCount,
      weight: Math.max(1, durationSeconds / 30, cues.length / 4, charCount / 220),
    };
  });
}

export function buildPersonalIpSemanticScenePlan({ brief = {}, pages = [], frames = [] } = {}) {
  const rows = sourceRows({ pages, frames });
  if (!rows.length) throw new Error("Personal-IP semantic scene planning requires at least one source page.");
  const personalIp = brief.personalIp && typeof brief.personalIp === "object" ? brief.personalIp : {};
  const sourcePageCount = rows.length;
  const durationSeconds = rows.reduce((sum, row) => sum + row.durationSeconds, 0)
    || positiveNumber(brief.durationSeconds)
    || positiveNumber(brief.audioDurationSeconds)
    || positiveNumber(brief.videoDurationSeconds);
  const subtitleCueCount = Math.max(
    rows.reduce((sum, row) => sum + row.cues.length, 0),
    positiveNumber(brief.subtitleCueCount),
    positiveNumber(brief.narrationSegmentCount),
    positiveNumber(brief.voiceoverSegmentCount),
  );
  const charCount = rows.reduce((sum, row) => sum + row.charCount, 0);
  const secondsPerScene = Math.max(12, positiveNumber(
    brief.personalIpSemanticSecondsPerScene || personalIp.semanticSecondsPerScene,
    30,
  ));
  const subtitleCuesPerScene = Math.max(1, positiveNumber(
    brief.personalIpSemanticCuesPerScene || personalIp.semanticCuesPerScene,
    4,
  ));
  const charsPerScene = Math.max(80, positiveNumber(
    brief.personalIpSemanticCharsPerScene || personalIp.semanticCharsPerScene,
    220,
  ));
  const requestedMaximum = positiveNumber(
    brief.personalIpSemanticMaxSceneCount || personalIp.semanticMaxSceneCount,
    0,
  );
  const requestedTarget = positiveNumber(
    brief.personalIpSemanticSceneCount || personalIp.semanticSceneCount,
    0,
  );
  const adaptiveCountPlan = buildAdaptiveCountPlan({
    sourceCount: sourcePageCount,
    durationSeconds,
    subtitleCueCount,
    charCount,
    contentUnitCount: rows.reduce((sum, row) => sum + Math.max(row.cues.length, splitSemanticUnits(row.spokenText).length), 0),
    minCount: sourcePageCount,
    requestedTarget,
    requestedMaximum,
    secondsPerPage: secondsPerScene,
    subtitleCuesPerPage: subtitleCuesPerScene,
    charsPerPage: charsPerScene,
    contentUnitsPerPage: 4,
  });
  const durationBasedTarget = adaptiveCountPlan.durationBasedTarget;
  const subtitleCueBasedTarget = adaptiveCountPlan.subtitleCueBasedTarget;
  const contentBasedTarget = adaptiveCountPlan.contentBasedTarget;
  const automaticTarget = adaptiveCountPlan.automaticTarget;
  const explicitTargetUnderAutomatic = adaptiveCountPlan.requestedTargetUnderAutomatic;
  const explicitMaximumUnderAutomatic = adaptiveCountPlan.requestedMaximumUnderAutomatic;
  const resolvedSceneCount = adaptiveCountPlan.resolvedCount;
  const counts = allocateSceneCounts(rows, resolvedSceneCount);
  const scenes = [];
  for (const [rowIndex, row] of rows.entries()) {
    const sceneCount = counts[rowIndex];
    let contentItems = row.cues;
    let contentSource = "subtitle-cues";
    if (contentItems.length < sceneCount) {
      contentSource = "spoken-text-semantic-units";
      contentItems = splitTextToMinimumUnits(row.spokenText, sceneCount).map((text, index) => ({
        index: index + 1,
        text,
        spokenText: text,
        durationSeconds: row.durationSeconds / Math.max(1, sceneCount),
      }));
    }
    const chunks = partitionContiguous(contentItems, sceneCount);
    if (chunks.length !== sceneCount) {
      throw new Error(`Cannot expand ${row.sourcePageId} into ${sceneCount} semantic scenes from ${contentItems.length} content units.`);
    }
    const methodologyGroups = Array.from({ length: sceneCount }, () => []);
    row.methodologyVisualUnits.forEach((unit, unitIndex) => {
      const targetIndex = Math.min(sceneCount - 1, Math.floor(unitIndex * sceneCount / Math.max(1, row.methodologyVisualUnits.length)));
      methodologyGroups[targetIndex].push(unit);
    });
    chunks.forEach((chunk, beatIndex) => {
      const spokenText = normalizedText(chunk.map((item) => item.spokenText || item.text).join(""));
      const captions = chunk.map((item) => normalizedText(item.text || item.spokenText)).filter(Boolean);
      const methodologyVisualUnits = methodologyGroups[beatIndex];
      const semanticUnits = [
        ...splitSemanticUnits(spokenText),
        ...methodologyVisualUnits.map((unit) => normalizedText(unit.text)).filter(Boolean),
      ];
      const durationFromCues = chunk.reduce((sum, item) => sum + positiveNumber(item.durationSeconds), 0);
      const plannedScene = {
        id: sceneCount === 1 ? row.sourcePageId : `${row.sourcePageId}--beat-${String(beatIndex + 1).padStart(2, "0")}`,
        order: scenes.length + 1,
        sourcePageId: row.sourcePageId,
        sourcePageOrder: row.sourcePageOrder,
        beatIndex: beatIndex + 1,
        beatCount: sceneCount,
        contentSource,
        durationSeconds: durationFromCues || row.durationSeconds / sceneCount,
        sourceLabel: normalizedText(row.frame.label || row.page.frame?.label || row.sourcePageId),
        sourceHeadline: Array.isArray(row.frame.headline) ? row.frame.headline.map(normalizedText).filter(Boolean) : [],
        sourceSubtitle: normalizedText(row.frame.subtitle || row.page.frame?.subtitle || ""),
        spokenText,
        captions,
        methodologyVisualUnits,
        methodologyText: methodologyVisualUnits.map((unit) => normalizedText(unit.text)).join("；"),
        semanticUnits: semanticUnits.length ? semanticUnits : [spokenText].filter(Boolean),
      };
      scenes.push({ ...plannedScene, ...classifyPersonalIpSemanticLayout(plannedScene) });
    });
  }
  const sourcePageIds = rows.map((row) => row.sourcePageId);
  const representedSourcePageIds = [...new Set(scenes.map((scene) => scene.sourcePageId))];
  const allSourcePagesRepresented = sourcePageIds.length === representedSourcePageIds.length
    && sourcePageIds.every((id) => representedSourcePageIds.includes(id));
  const sourceCoveragePreserved = rows.every((row) => {
    const rebuilt = scenes.filter((scene) => scene.sourcePageId === row.sourcePageId).map((scene) => scene.spokenText).join("");
    return comparableText(rebuilt) === comparableText(row.spokenText);
  });
  if (scenes.length !== resolvedSceneCount || !allSourcePagesRepresented || !sourceCoveragePreserved) {
    throw new Error("Personal-IP semantic scene expansion failed exact count or source-content coverage validation.");
  }
  return {
    schemaVersion: 1,
    stage: "personal-ip-semantic-scene-count-plan",
    route: "personal-ip-semantic-layers-svg-html-video",
    sourcePageCount,
    sourcePageIds,
    representedSourcePageIds,
    allSourcePagesRepresented,
    sourceCoveragePreserved,
    adaptiveCountPlan,
    automaticTarget,
    requestedTarget: requestedTarget || null,
    requestedMaximum: requestedMaximum || null,
    maximumPolicy: "adaptive-no-default-cap",
    explicitMaximumUnderAutomatic,
    explicitMaximumRaisedToAutomatic: explicitMaximumUnderAutomatic,
    resolvedSceneCount,
    explicitTargetUnderAutomatic,
    cappedByMaximum: false,
    growthRequired: resolvedSceneCount > sourcePageCount,
    growthDrivers: {
      durationSeconds,
      subtitleCueCount,
      charCount,
      secondsPerScene,
      subtitleCuesPerScene,
      charsPerScene,
      sourcePageTarget: sourcePageCount,
      durationBasedTarget,
      subtitleCueBasedTarget,
      contentBasedTarget,
      strongestAutomaticDriver: [
        ["sourcePageTarget", sourcePageCount],
        ["durationBasedTarget", durationBasedTarget],
        ["subtitleCueBasedTarget", subtitleCueBasedTarget],
        ["contentBasedTarget", contentBasedTarget],
      ].sort((left, right) => right[1] - left[1])[0][0],
    },
    sourcePages: rows.map((row, index) => ({
      id: row.sourcePageId,
      order: row.sourcePageOrder,
      durationSeconds: row.durationSeconds,
      subtitleCueCount: row.cues.length,
      charCount: row.charCount,
      expandedSceneCount: counts[index],
      sceneIds: scenes.filter((scene) => scene.sourcePageId === row.sourcePageId).map((scene) => scene.id),
    })),
    scenes,
  };
}
