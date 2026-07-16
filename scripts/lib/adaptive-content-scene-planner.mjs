function positiveNumber(value, fallback = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeContentText(value = "") {
  return String(value || "").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function comparableText(value = "") {
  return normalizeContentText(value).replace(/[\s，,。！？!?；;：:、|\-—_（）()【】\[\]]/g, "").toLowerCase();
}

function textFromEntry(entry = {}) {
  if (typeof entry === "string") return entry;
  return entry.text || entry.narration || entry.voiceover || entry.spokenText || entry.subtitle || entry.body || entry.content || "";
}

export function splitSemanticContentUnits(value = "") {
  const text = normalizeContentText(value);
  if (!text) return [];
  const units = text
    .split(/(?<=[。！？!?；;])\s*|\n+/u)
    .map(normalizeContentText)
    .filter(Boolean);
  return units.length ? units : [text];
}

function normalizedUnits(entries = [], source = "content") {
  return entries.map((entry, index) => ({
    id: typeof entry === "object" && entry?.id ? String(entry.id) : `${source}-${String(index + 1).padStart(2, "0")}`,
    source,
    sceneId: typeof entry === "object" ? entry.sceneId || entry.frameId || entry.id || null : null,
    text: normalizeContentText(textFromEntry(entry)),
  })).filter((unit) => unit.text);
}

function dedupeUnits(units = []) {
  const seen = new Set();
  return units.filter((unit) => {
    const key = comparableText(unit.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((unit, index) => ({ ...unit, order: index + 1 }));
}

export function selectCanonicalContentUnits({ structuredGroups = [], scenes = [], pages = [], fullTexts = [] } = {}) {
  const structured = structuredGroups.flatMap((group) => normalizedUnits(
    Array.isArray(group?.entries) ? group.entries : [],
    group?.source || "structured-cue",
  ));
  const sceneUnits = normalizedUnits(scenes.map((scene) => ({
    ...scene,
    text: textFromEntry(scene),
  })), "brief.scene");
  const pageUnits = normalizedUnits(pages.map((page) => ({
    ...(page?.frame || page || {}),
    id: page?.id || page?.frame?.id,
    text: textFromEntry(page?.frame || page),
  })), "designPlan.page");
  const fullTextUnits = fullTexts.flatMap((item) => {
    const rawText = item && typeof item === "object" ? item.text : item;
    if (typeof rawText !== "string" || !rawText.trim()) return [];
    return splitSemanticContentUnits(rawText).map((text, index) => ({
      id: `${item?.source || "full-text"}-${String(index + 1).padStart(2, "0")}`,
      source: item?.source || "full-text",
      text,
    }));
  });
  const sceneChars = sceneUnits.reduce((sum, unit) => sum + Array.from(unit.text.replace(/\s/g, "")).length, 0);
  const fullTextChars = fullTextUnits.reduce((sum, unit) => sum + Array.from(unit.text.replace(/\s/g, "")).length, 0);
  const fullNarrationIsCanonical = fullTextUnits.length > 0 && fullTextChars > Math.max(120, sceneChars * 1.35);
  const fallbackTiers = fullNarrationIsCanonical
    ? [
        { sourceTier: "full-narration", units: fullTextUnits },
        { sourceTier: "brief-scenes", units: sceneUnits },
        { sourceTier: "design-pages", units: pageUnits },
      ]
    : [
        { sourceTier: "brief-scenes", units: sceneUnits },
        { sourceTier: "full-narration", units: fullTextUnits },
        { sourceTier: "design-pages", units: pageUnits },
      ];
  const tiers = [{ sourceTier: "structured-cues", units: structured }, ...fallbackTiers];
  const selectedIndex = tiers.findIndex((tier) => tier.units.length > 0);
  const selected = selectedIndex >= 0 ? tiers[selectedIndex] : { sourceTier: "empty", units: [] };
  return {
    sourceTier: selected.sourceTier,
    units: dedupeUnits(selected.units),
    availableTiers: tiers.map((tier) => ({ sourceTier: tier.sourceTier, unitCount: tier.units.length })),
    duplicateTiersIgnored: selectedIndex >= 0 && tiers.slice(selectedIndex + 1).some((tier) => tier.units.length > 0),
    precedence: tiers.map((tier) => tier.sourceTier),
    fullNarrationPreferredOverCoarseScenes: fullNarrationIsCanonical,
  };
}

export function buildAdaptiveCountPlan({
  sourceCount = 0,
  topicGroupCount = 0,
  durationSeconds = 0,
  subtitleCueCount = 0,
  charCount = 0,
  contentUnitCount = 0,
  minCount = 1,
  requestedTarget = 0,
  requestedMaximum = 0,
  secondsPerPage = 30,
  subtitleCuesPerPage = 4,
  charsPerPage = 220,
  contentUnitsPerPage = 4,
} = {}) {
  const rawSourceCount = Math.floor(positiveNumber(sourceCount, 0));
  const explicitTopicGroupCount = Math.floor(positiveNumber(topicGroupCount, 0));
  const topicGroupTarget = explicitTopicGroupCount || rawSourceCount;
  const floor = Math.max(1, Math.floor(positiveNumber(minCount, 1)), topicGroupTarget);
  const durationBasedTarget = durationSeconds > 0 ? Math.ceil(durationSeconds / Math.max(1, positiveNumber(secondsPerPage, 30))) : 0;
  const subtitleCueBasedTarget = subtitleCueCount > 0 ? Math.ceil(subtitleCueCount / Math.max(1, positiveNumber(subtitleCuesPerPage, 4))) : 0;
  const contentBasedTarget = charCount > 0 ? Math.ceil(charCount / Math.max(1, positiveNumber(charsPerPage, 220))) : 0;
  const effectiveContentUnitCount = subtitleCueCount > 0 && contentUnitCount > 0
    ? Math.min(contentUnitCount, subtitleCueCount)
    : contentUnitCount;
  const semanticUnitTarget = effectiveContentUnitCount > 0 ? Math.ceil(effectiveContentUnitCount / Math.max(1, positiveNumber(contentUnitsPerPage, 4))) : 0;
  // Subtitle/semantic units describe how often the narration may need an
  // emphasis, reveal, pointer move, or subtitle update. They are deliberately
  // not unique-image requirements: promoting every four short sentences to a
  // separate Image2 page makes punctuation density control generation cost.
  // Unique pages are instead governed by source topic/methodology groups,
  // elapsed time, and the amount of spoken content.
  const automaticTarget = Math.max(floor, durationBasedTarget, contentBasedTarget);
  const explicitTarget = Math.floor(positiveNumber(requestedTarget, 0));
  const explicitMaximum = Math.floor(positiveNumber(requestedMaximum, 0));
  const resolvedCount = Math.max(automaticTarget, explicitTarget);
  const microVisualBeatTarget = Math.max(resolvedCount, subtitleCueBasedTarget, semanticUnitTarget);
  const requestedTargetUnderAutomatic = explicitTarget > 0 && explicitTarget < automaticTarget;
  const requestedMaximumUnderAutomatic = explicitMaximum > 0 && explicitMaximum < automaticTarget;
  return {
    schemaVersion: 2,
    policy: "adaptive-unique-pages-with-micro-visual-beats",
    pageCountPolicy: "duration-character-topic-groups",
    microVisualBeatPolicy: "subtitle-and-semantic-units-drive-in-page-beats-not-unique-images",
    maximumPolicy: "adaptive-no-default-cap",
    minCount: floor,
    sourceCount: rawSourceCount,
    topicGroupCount: explicitTopicGroupCount || null,
    topicGroupTarget,
    automaticTarget,
    requestedTarget: explicitTarget || null,
    requestedMaximum: explicitMaximum || null,
    effectiveMaximum: explicitMaximum ? Math.max(explicitMaximum, resolvedCount) : null,
    requestedTargetUnderAutomatic,
    requestedTargetRaisedToAutomatic: requestedTargetUnderAutomatic,
    requestedMaximumUnderAutomatic,
    requestedMaximumRaisedToAutomatic: requestedMaximumUnderAutomatic,
    cappedByMaximum: false,
    resolvedCount,
    uniqueGeneratedPageCount: resolvedCount,
    microVisualBeatTarget,
    microVisualBeatCount: microVisualBeatTarget,
    durationBasedTarget,
    subtitleCueBasedTarget,
    contentBasedTarget,
    semanticUnitTarget,
    inputs: {
      sourceCount: rawSourceCount,
      topicGroupCount: explicitTopicGroupCount,
      durationSeconds: positiveNumber(durationSeconds, 0),
      subtitleCueCount: Math.floor(positiveNumber(subtitleCueCount, 0)),
      charCount: Math.floor(positiveNumber(charCount, 0)),
      contentUnitCount: Math.floor(positiveNumber(contentUnitCount, 0)),
      effectiveContentUnitCount: Math.floor(positiveNumber(effectiveContentUnitCount, 0)),
      secondsPerPage: positiveNumber(secondsPerPage, 30),
      subtitleCuesPerPage: positiveNumber(subtitleCuesPerPage, 4),
      charsPerPage: positiveNumber(charsPerPage, 220),
      contentUnitsPerPage: positiveNumber(contentUnitsPerPage, 4),
    },
    strongestAutomaticDriver: [
      ["topicGroupTarget", floor],
      ["durationBasedTarget", durationBasedTarget],
      ["contentBasedTarget", contentBasedTarget],
    ].sort((left, right) => right[1] - left[1])[0][0],
    microVisualBeatDriver: [
      ["uniqueGeneratedPageCount", resolvedCount],
      ["subtitleCueBasedTarget", subtitleCueBasedTarget],
      ["semanticUnitTarget", semanticUnitTarget],
    ].sort((left, right) => right[1] - left[1])[0][0],
  };
}

function personalIpDurationBand(durationSeconds = 0) {
  const seconds = positiveNumber(durationSeconds, 0);
  if (seconds <= 180) return { id: "up-to-3-minutes", min: 3, max: 5 };
  if (seconds <= 480) return { id: "3-to-8-minutes", min: 5, max: 9 };
  if (seconds <= 900) return { id: "8-to-15-minutes", min: 8, max: 14 };
  if (seconds <= 1800) return { id: "15-to-30-minutes", min: 14, max: 24 };
  return { id: "over-30-minutes", min: 24, max: 32 };
}

export function buildPersonalIpPageCapacityPlan({
  aspect = "16:9",
  sourceCount = 0,
  topicGroupCount = 0,
  durationSeconds = 0,
  subtitleCueCount = 0,
  charCount = 0,
  contentUnitCount = 0,
  minCount = 4,
  requestedTarget = 0,
  requestedMaximum = 0,
  secondsPerPage = 0,
  charsPerPage = 0,
} = {}) {
  const vertical = String(aspect || "").trim() === "9:16";
  const defaultPageCapacity = vertical
    ? { aspect: "9:16", secondsPerPage: 60, charsPerPage: 300, contentUnitsPerPage: 4, microBeatsPerPage: 4 }
    : { aspect: "16:9", secondsPerPage: 90, charsPerPage: 420, contentUnitsPerPage: 6, microBeatsPerPage: 4 };
  const pageCapacity = {
    ...defaultPageCapacity,
    secondsPerPage: positiveNumber(secondsPerPage, defaultPageCapacity.secondsPerPage),
    charsPerPage: positiveNumber(charsPerPage, defaultPageCapacity.charsPerPage),
  };
  const rawSourceCount = Math.floor(positiveNumber(sourceCount, 0));
  const explicitTopicGroupCount = Math.floor(positiveNumber(topicGroupCount, 0));
  const topicGroupTarget = explicitTopicGroupCount || rawSourceCount;
  const floor = Math.max(1, Math.floor(positiveNumber(minCount, 4)));
  const duration = positiveNumber(durationSeconds, 0);
  const durationBand = personalIpDurationBand(duration);
  const durationBasedTarget = duration > 0 ? Math.ceil(duration / pageCapacity.secondsPerPage) : 0;
  const contentBasedTarget = charCount > 0 ? Math.ceil(positiveNumber(charCount, 0) / pageCapacity.charsPerPage) : 0;
  const topicCoverageTarget = topicGroupTarget > 0
    ? Math.ceil(topicGroupTarget / Math.max(1, Math.floor(pageCapacity.contentUnitsPerPage / 2)))
    : 0;
  const automaticTargetBeforeSafetyBand = Math.max(floor, durationBand.min, durationBasedTarget, contentBasedTarget, topicCoverageTarget);
  const automaticTarget = Math.min(automaticTargetBeforeSafetyBand, durationBand.max);
  const explicitTarget = Math.floor(positiveNumber(requestedTarget, 0));
  const explicitMaximum = Math.floor(positiveNumber(requestedMaximum, 0));
  const targetBeforeMaximum = explicitTarget > 0 ? Math.max(floor, explicitTarget) : automaticTarget;
  const defaultMaximum = explicitTarget > durationBand.max && explicitMaximum <= 0
    ? explicitTarget
    : durationBand.max;
  const maxUniquePages = Math.max(floor, explicitMaximum || defaultMaximum);
  const resolvedCount = Math.max(floor, Math.min(targetBeforeMaximum, maxUniquePages));
  const subtitleCueBasedTarget = subtitleCueCount > 0
    ? Math.ceil(positiveNumber(subtitleCueCount, 0) / pageCapacity.microBeatsPerPage)
    : 0;
  const semanticUnitTarget = contentUnitCount > 0
    ? Math.ceil(positiveNumber(contentUnitCount, 0) / pageCapacity.microBeatsPerPage)
    : 0;
  const microVisualBeatTarget = Math.max(resolvedCount, subtitleCueBasedTarget, semanticUnitTarget);
  const requestedMaximumUnderAutomatic = explicitMaximum > 0 && explicitMaximum < automaticTarget;
  const cappedByMaximum = explicitMaximum > 0 && targetBeforeMaximum > maxUniquePages;
  const safetyBandApplied = automaticTargetBeforeSafetyBand > durationBand.max;
  const maxRepairGenerations = Math.min(6, Math.max(1, Math.ceil(resolvedCount * 0.2)));
  return {
    schemaVersion: 3,
    policy: "personal-ip-semantic-page-capacity",
    pageCountPolicy: "spoken-content-capacity-with-duration-safety-band",
    microVisualBeatPolicy: "subtitle-and-semantic-units-drive-in-page-beats-not-unique-images",
    maximumPolicy: "duration-band-default-user-maximum-hard-cap",
    coverageStrategy: "semantic-packing-with-in-page-micro-beats",
    repairVariantPolicy: "on-demand-qc-failures-only",
    proactiveVariantCount: 0,
    maxRepairGenerations,
    minCount: floor,
    sourceCount: rawSourceCount,
    topicGroupCount: explicitTopicGroupCount || null,
    topicGroupTarget,
    topicCoverageTarget,
    durationBand,
    pageCapacity,
    automaticTargetBeforeSafetyBand,
    automaticTarget,
    requestedTarget: explicitTarget || null,
    requestedTargetOverridesAutomatic: explicitTarget > 0 && explicitTarget !== automaticTarget,
    requestedMaximum: explicitMaximum || null,
    requestedMaximumUnderAutomatic,
    requestedMaximumApplied: cappedByMaximum,
    requestedMaximumRaisedToAutomatic: false,
    effectiveMaximum: maxUniquePages,
    maxUniquePages,
    safetyBandApplied,
    cappedByMaximum,
    resolvedCount,
    uniqueGeneratedPageCount: resolvedCount,
    microVisualBeatTarget,
    microVisualBeatCount: microVisualBeatTarget,
    durationBasedTarget,
    subtitleCueBasedTarget,
    contentBasedTarget,
    semanticUnitTarget,
    strongestAutomaticDriver: [
      ["durationBandMinimum", durationBand.min],
      ["durationBasedTarget", durationBasedTarget],
      ["contentBasedTarget", contentBasedTarget],
      ["topicCoverageTarget", topicCoverageTarget],
    ].sort((left, right) => right[1] - left[1])[0][0],
    microVisualBeatDriver: [
      ["uniqueGeneratedPageCount", resolvedCount],
      ["subtitleCueBasedTarget", subtitleCueBasedTarget],
      ["semanticUnitTarget", semanticUnitTarget],
    ].sort((left, right) => right[1] - left[1])[0][0],
    inputs: {
      aspect: pageCapacity.aspect,
      sourceCount: rawSourceCount,
      topicGroupCount: explicitTopicGroupCount,
      durationSeconds: duration,
      subtitleCueCount: Math.floor(positiveNumber(subtitleCueCount, 0)),
      charCount: Math.floor(positiveNumber(charCount, 0)),
      contentUnitCount: Math.floor(positiveNumber(contentUnitCount, 0)),
    },
  };
}

function allocateCounts(rows = [], target = 1) {
  const counts = rows.map(() => 1);
  let remaining = Math.max(0, target - rows.length);
  while (remaining > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    rows.forEach((row, index) => {
      const score = row.weight / counts[index];
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    counts[bestIndex] += 1;
    remaining -= 1;
  }
  return counts;
}

function splitTextExactly(value = "", count = 1) {
  const text = normalizeContentText(value);
  if (!text) return Array.from({ length: count }, () => "");
  const semantic = splitSemanticContentUnits(text);
  if (semantic.length >= count) {
    const groups = [];
    let cursor = 0;
    for (let index = 0; index < count; index += 1) {
      const remainingItems = semantic.length - cursor;
      const remainingGroups = count - index;
      const take = Math.ceil(remainingItems / remainingGroups);
      groups.push(semantic.slice(cursor, cursor + take).join(""));
      cursor += take;
    }
    return groups;
  }
  const chars = Array.from(text);
  const groups = [];
  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    const remainingChars = chars.length - cursor;
    const remainingGroups = count - index;
    const take = Math.max(1, Math.ceil(remainingChars / remainingGroups));
    groups.push(chars.slice(cursor, cursor + take).join(""));
    cursor += take;
  }
  return groups;
}

export function partitionContentText(value = "", count = 1, { label = "content" } = {}) {
  const text = normalizeContentText(value);
  const resolvedCount = Math.max(1, Math.floor(positiveNumber(count, 1)));
  const characterCount = Array.from(text).length;
  if (!text) throw new Error(`Cannot partition empty ${label}.`);
  if (resolvedCount > characterCount) {
    throw new Error(`Adaptive target ${resolvedCount} exceeds the ${characterCount} available characters in ${label}. Provide the complete narration or structured subtitle cues; repeated or blank page beats are forbidden.`);
  }
  const parts = splitTextExactly(text, resolvedCount);
  if (parts.length !== resolvedCount || parts.some((part) => !normalizeContentText(part))) {
    throw new Error(`Failed to partition ${label} into ${resolvedCount} non-empty contiguous beats.`);
  }
  if (comparableText(parts.join("")) !== comparableText(text)) {
    throw new Error(`Partitioning ${label} did not preserve the canonical content exactly.`);
  }
  return parts;
}

export function expandScenesAdaptively({
  scenes = [],
  narration = "",
  durationSeconds = 0,
  subtitleCueCount = 0,
  requestedTarget = 0,
  requestedMaximum = 0,
  minCount = 3,
} = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("Adaptive scene expansion requires source scenes.");
  const rows = scenes.map((scene, index) => {
    const text = normalizeContentText(textFromEntry(scene));
    const charCount = Array.from(text.replace(/\s/g, "")).length;
    const semanticUnitCount = splitSemanticContentUnits(text).length;
    return {
      scene,
      sourceSceneId: String(scene.id || `scene-${index + 1}`),
      text,
      charCount,
      semanticUnitCount,
      weight: Math.max(1, positiveNumber(scene.durationSec, 0) / 30, charCount / 220, semanticUnitCount / 4),
    };
  });
  const fullNarration = normalizeContentText(narration || rows.map((row) => row.text).join(""));
  const canonical = selectCanonicalContentUnits({
    scenes: rows.map((row) => ({ id: row.sourceSceneId, narration: row.text })),
    fullTexts: [{ source: "full-narration", text: fullNarration }],
  });
  const canonicalText = normalizeContentText(
    canonical.sourceTier === "full-narration"
      ? canonical.units.map((unit) => unit.text).join("")
      : rows.map((row) => row.text).join(""),
  );
  const countPlan = buildAdaptiveCountPlan({
    sourceCount: rows.length,
    durationSeconds,
    subtitleCueCount,
    charCount: Array.from(canonicalText.replace(/\s/g, "")).length,
    contentUnitCount: canonical.units.length,
    minCount: Math.max(minCount, rows.length),
    requestedTarget,
    requestedMaximum,
  });
  const splittableCharacterCount = Array.from(canonicalText).length;
  if (countPlan.resolvedCount > splittableCharacterCount) {
    throw new Error(`Adaptive scene target ${countPlan.resolvedCount} exceeds the ${splittableCharacterCount} available spoken characters. Provide the complete narration or structured subtitle cues; blank visual scenes are forbidden.`);
  }
  const counts = allocateCounts(rows, countPlan.resolvedCount);
  const expanded = [];
  const canonicalChunks = canonical.sourceTier === "full-narration"
    ? splitTextExactly(canonicalText, countPlan.resolvedCount)
    : null;
  let canonicalChunkCursor = 0;
  rows.forEach((row, rowIndex) => {
    const chunks = canonicalChunks
      ? canonicalChunks.slice(canonicalChunkCursor, canonicalChunkCursor + counts[rowIndex])
      : splitTextExactly(row.text, counts[rowIndex]);
    canonicalChunkCursor += chunks.length;
    chunks.forEach((chunk, beatIndex) => {
      const beatCount = chunks.length;
      expanded.push({
        ...row.scene,
        id: beatCount === 1 ? row.sourceSceneId : `${row.sourceSceneId}--beat-${String(beatIndex + 1).padStart(2, "0")}`,
        sourceSceneId: row.sourceSceneId,
        sourceSceneOrder: rowIndex + 1,
        beatIndex: beatIndex + 1,
        beatCount,
        canonicalSourceTier: canonical.sourceTier,
        sourceSceneSummary: row.text,
        narration: chunk,
        spokenText: chunk,
        subtitle: chunk,
        body: chunk,
      });
    });
  });
  const representedSourceSceneIds = [...new Set(expanded.map((scene) => scene.sourceSceneId))];
  const allSourceScenesRepresented = rows.every((row) => representedSourceSceneIds.includes(row.sourceSceneId));
  const sourceCoveragePreserved = comparableText(expanded.map((scene) => scene.narration).join("")) === comparableText(canonicalText);
  if (expanded.length !== countPlan.resolvedCount || !allSourceScenesRepresented || !sourceCoveragePreserved) {
    throw new Error("Adaptive scene expansion failed exact count or source-content preservation.");
  }
  return {
    schemaVersion: 1,
    stage: "adaptive-content-scene-plan",
    countPlan,
    canonicalSourceTier: canonical.sourceTier,
    canonicalContentUnitIds: canonical.units.map((unit) => unit.id),
    canonicalContentUnitCount: canonical.units.length,
    canonicalTextCharacterCount: Array.from(canonicalText.replace(/\s/g, "")).length,
    sourceSceneCount: rows.length,
    representedSourceSceneIds,
    allSourceScenesRepresented,
    sourceCoveragePreserved,
    growthRequired: expanded.length > rows.length,
    scenes: expanded,
  };
}

export function extractMethodologyVisualUnits(markdown = "") {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const units = [];
  let inMethodologySection = false;
  const methodologySignal = /步骤|流程|方法|评分|打分|清单|检查|量表|表格|公式|模型|框架|系统|法|RETAIN|SCORE|CHECK/i;
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      inMethodologySection = methodologySignal.test(heading[1].trim());
      if (inMethodologySection) units.push({ id: `method-heading-${index + 1}`, kind: "heading", text: heading[1].trim(), sourceLine: index + 1 });
      return;
    }
    const step = line.match(/^\s*(?:\d+[.、）)]|[-*+]\s*步骤\s*\d*[:：]?)\s*(.+)$/u);
    if (step) {
      units.push({ id: `method-step-${index + 1}`, kind: "steps", text: step[1].trim(), sourceLine: index + 1 });
      return;
    }
    const bullet = line.match(/^[-*+]\s+(.+)$/u);
    if (bullet && (inMethodologySection || methodologySignal.test(bullet[1]))) {
      units.push({ id: `method-checklist-${index + 1}`, kind: "checklist", text: bullet[1].trim(), sourceLine: index + 1 });
      return;
    }
    if (/^\|.+\|$/.test(line) && !/^\|?\s*:?-{3,}/.test(line.replace(/\s/g, ""))) {
      const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 2) units.push({ id: `method-table-${index + 1}`, kind: "table", text: cells.join("；"), cells, sourceLine: index + 1 });
      return;
    }
    if (/评分|打分|检查清单|步骤|流程/u.test(line) && /[:：]\s*\S+/u.test(line)) {
      units.push({ id: `method-key-${index + 1}`, kind: "key-point", text: line, sourceLine: index + 1 });
      return;
    }
    if (/^[^=＝]{1,40}[=＝][^=＝]{1,120}$/u.test(line)) {
      units.push({ id: `method-formula-${index + 1}`, kind: "formula", text: line, sourceLine: index + 1 });
    }
  });
  return dedupeUnits(units).map((unit) => ({ ...unit, kind: unit.kind || "key-point" }));
}

function visualSceneText(scene = {}) {
  return normalizeContentText([
    scene.text,
    scene.label,
    ...(Array.isArray(scene.headline) ? scene.headline : [scene.headline]),
    scene.body,
    scene.subtitle,
    scene.visualText,
    scene.methodologyText,
  ].filter(Boolean).join(" "));
}

export function buildMethodologyVisualCoverage({ requiredUnits = [], visualScenes = [], condensedAllowed = false } = {}) {
  const sceneRows = visualScenes.map((scene, index) => ({
    id: String(scene.id || `scene-${index + 1}`),
    text: visualSceneText(scene),
    comparable: comparableText(visualSceneText(scene)),
  }));
  const matches = requiredUnits.map((unit) => {
    const required = comparableText(unit.text);
    const matchedSceneIds = sceneRows.filter((scene) => {
      if (!required || !scene.comparable) return false;
      if (scene.comparable.includes(required) || required.includes(scene.comparable)) return true;
      const tokens = normalizeContentText(unit.text).split(/[\s；;，,。！？!?：:、|/]+/).map(comparableText).filter((token) => token.length >= 2);
      return tokens.length > 0 && tokens.filter((token) => scene.comparable.includes(token)).length / tokens.length >= 0.75;
    }).map((scene) => scene.id);
    return { ...unit, matched: matchedSceneIds.length > 0, matchedSceneIds };
  });
  const missingUnits = matches.filter((unit) => !unit.matched);
  const pass = condensedAllowed || missingUnits.length === 0;
  return {
    schemaVersion: 1,
    stage: "methodology-visual-coverage",
    policy: "Steps, tables, scorecards, checklists, formulas, and named methodology structures from source material must appear in final visual scenes even when the spoken script summarizes them.",
    condensedAllowed,
    requiredUnitCount: matches.length,
    matchedUnitCount: matches.length - missingUnits.length,
    missingUnitCount: missingUnits.length,
    status: pass ? "pass" : "fail",
    matches,
    missingUnits,
  };
}
