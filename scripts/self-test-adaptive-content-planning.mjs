#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildAdaptiveCountPlan,
  buildMethodologyVisualCoverage,
  expandScenesAdaptively,
  extractMethodologyVisualUnits,
  selectCanonicalContentUnits,
} from "./lib/adaptive-content-scene-planner.mjs";

const structuredCues = Array.from({ length: 113 }, (_, index) => ({
  id: `cue-${index + 1}`,
  text: `第${index + 1}个连续口播要点，说明人物欲望、误信念与选择之间的关系。`,
}));
const sceneSummaries = Array.from({ length: 12 }, (_, index) => ({
  id: `scene-${index + 1}`,
  narration: structuredCues.slice(index * 9, Math.min(113, (index + 1) * 9)).map((cue) => cue.text).join(""),
}));
const fullNarration = structuredCues.map((cue) => cue.text).join("");

const canonical = selectCanonicalContentUnits({
  structuredGroups: [{ source: "subtitle-cue", entries: structuredCues }],
  scenes: sceneSummaries,
  fullTexts: [{ source: "brief.narration", text: fullNarration }],
});
assert.equal(canonical.sourceTier, "structured-cues");
assert.equal(canonical.units.length, 113, "canonical selection must not add scene summaries and full narration on top of subtitle cues");
assert.equal(canonical.duplicateTiersIgnored, true);
assert.equal(canonical.structuredCuesMatchFullNarration, true);

const mismatchedCanonical = selectCanonicalContentUnits({
  structuredGroups: [{ source: "stale-cues", entries: [{ text: "被改写的等长错误文本。" }] }],
  scenes: [{ id: "scene-1", narration: "场景摘要不是真实原稿。" }],
  fullTexts: [{ source: "brief.narration", text: "用户提供的等长真实原稿。" }],
});
assert.equal(mismatchedCanonical.sourceTier, "full-narration", "explicit full narration must outrank conflicting structured cues and scene summaries");
assert.equal(mismatchedCanonical.structuredCueMismatchRejected, true);

const punctuationMismatch = selectCanonicalContentUnits({
  structuredGroups: [{ source: "stale-cues", entries: [{ text: "保留原稿？绝不能改。" }] }],
  fullTexts: [{ source: "brief.narration", text: "保留原稿！绝不能改。" }],
});
assert.equal(punctuationMismatch.sourceTier, "full-narration", "punctuation changes are content changes, not whitespace-only fidelity");
assert.equal(punctuationMismatch.structuredCueMismatchRejected, true);

const repeatedNarration = "记住这句话。第一步。记住这句话。";
const repeatedCanonical = selectCanonicalContentUnits({
  fullTexts: [{ source: "brief.narration", text: repeatedNarration }],
});
assert.equal(repeatedCanonical.sourceTier, "full-narration");
assert.equal(repeatedCanonical.units.map((unit) => unit.text).join(""), repeatedNarration);
assert.equal(repeatedCanonical.units.filter((unit) => unit.text === "记住这句话。").length, 2, "legitimate repeated sentences must be preserved in order");

const longPlan = buildAdaptiveCountPlan({
  sourceCount: 12,
  durationSeconds: 2133.117,
  subtitleCueCount: 113,
  charCount: 11164,
  contentUnitCount: canonical.units.length,
  minCount: 4,
  requestedMaximum: 48,
});
assert.equal(longPlan.durationBasedTarget, 72);
assert.equal(longPlan.resolvedCount, 72, "35-minute content must grow to the adaptive duration target");
assert.equal(longPlan.maximumPolicy, "adaptive-no-default-cap");
assert.equal(longPlan.requestedMaximumUnderAutomatic, true);
assert.equal(longPlan.requestedMaximumRaisedToAutomatic, true);
assert.equal(longPlan.cappedByMaximum, false);

const shortPlan = buildAdaptiveCountPlan({
  sourceCount: 3,
  durationSeconds: 9,
  subtitleCueCount: 3,
  charCount: 90,
  contentUnitCount: 3,
  minCount: 3,
});
assert.equal(shortPlan.resolvedCount, 3, "short content must not be padded with decorative pages");

const twentyTwoMinutePlan = buildAdaptiveCountPlan({
  sourceCount: 99,
  topicGroupCount: 9,
  durationSeconds: 1281.287,
  charCount: 6530,
  contentUnitCount: 393,
  minCount: 4,
});
assert.equal(twentyTwoMinutePlan.durationBasedTarget, 43);
assert.equal(twentyTwoMinutePlan.contentBasedTarget, 30);
assert.equal(twentyTwoMinutePlan.semanticUnitTarget, 99);
assert.equal(twentyTwoMinutePlan.microVisualBeatTarget, 99, "sentence-level semantic units remain available for in-page emphasis and subtitle timing");
assert.equal(twentyTwoMinutePlan.uniqueGeneratedPageCount, 43, "micro visual beats must not become 99 expensive Image2 pages");
assert.equal(twentyTwoMinutePlan.resolvedCount, 43, "resolvedCount remains the compatibility alias for unique generated pages");
assert.equal(twentyTwoMinutePlan.strongestAutomaticDriver, "durationBasedTarget");
assert.equal(twentyTwoMinutePlan.pageCountPolicy, "duration-character-topic-groups");
assert.equal(twentyTwoMinutePlan.topicGroupTarget, 9, "raw micro page cards must not replace the original topic-group coverage floor");

const structuredCoveragePlan = buildAdaptiveCountPlan({
  sourceCount: 18,
  durationSeconds: 180,
  charCount: 900,
  contentUnitCount: 80,
  minCount: 4,
});
assert.equal(structuredCoveragePlan.uniqueGeneratedPageCount, 18, "source topic/methodology groups must retain at least one unique page each");
assert.equal(structuredCoveragePlan.microVisualBeatTarget, 20);

const sourceScenes = [
  { id: "opening", narration: "人物一出场就要带着欲望。欲望让他主动接管现场。" },
  { id: "method", narration: "接着找到误信念。再让选择暴露代价。" },
  { id: "closing", narration: "最后用新的选择完成变化。结尾回收人物弧光。" },
];
const expansion = expandScenesAdaptively({
  scenes: sourceScenes,
  narration: sourceScenes.map((scene) => scene.narration).join(""),
  durationSeconds: 120,
  minCount: 3,
});
assert.equal(expansion.countPlan.resolvedCount, 4);
assert.equal(expansion.scenes.length, 4);
assert.deepEqual([...new Set(expansion.scenes.map((scene) => scene.sourceSceneId))], ["opening", "method", "closing"]);
assert.equal(expansion.sourceCoveragePreserved, true);

const longNarrationWithCoarseScenes = Array.from({ length: 40 }, (_, index) => `正文单元${index + 1}必须进入最终画面。`).join("");
const coarseExpansion = expandScenesAdaptively({
  scenes: [
    { id: "coarse-a", narration: "章节摘要甲。" },
    { id: "coarse-b", narration: "章节摘要乙。" },
    { id: "coarse-c", narration: "章节摘要丙。" },
  ],
  narration: longNarrationWithCoarseScenes,
  durationSeconds: 300,
});
assert.equal(coarseExpansion.canonicalSourceTier, "full-narration");
assert.equal(coarseExpansion.sourceCoveragePreserved, true);
assert.equal(coarseExpansion.scenes.map((scene) => scene.narration).join(""), longNarrationWithCoarseScenes);
assert.ok(coarseExpansion.scenes.some((scene) => scene.narration.includes("正文单元40")), "the final narration unit must reach a visual scene");

assert.throws(() => expandScenesAdaptively({
  scenes: [{ id: "sparse", narration: "一句" }],
  narration: "一句",
  durationSeconds: 600,
}), /blank visual scenes are forbidden/, "sparse long-duration briefs must fail instead of generating empty scenes");

const methodologyMarkdown = [
  "# 人物欲望与误信念",
  "## 三步法",
  "1. 写出人物表层欲望",
  "2. 找到阻碍他的误信念",
  "3. 用关键选择验证变化",
  "## 人物活力评分表",
  "| 维度 | 0分 | 2分 |",
  "| --- | --- | --- |",
  "| 主动性 | 被动等待 | 主动制造行动 |",
  "| 代价 | 没有代价 | 选择必须付费 |",
].join("\n");
const methodologyUnits = extractMethodologyVisualUnits(methodologyMarkdown);
assert.ok(methodologyUnits.some((unit) => unit.kind === "steps" && /表层欲望/.test(unit.text)));
assert.ok(methodologyUnits.some((unit) => unit.kind === "table" && /主动性/.test(unit.text)));
assert.ok(methodologyUnits.some((unit) => unit.kind === "table" && /代价/.test(unit.text)));

const alternateMethodologyUnits = extractMethodologyVisualUnits([
  "## RETAIN 五层系统",
  "- 先识别触发条件",
  "- 再检查行动反馈",
  "留存率 = 完播人数 / 播放人数",
].join("\n"));
assert.ok(alternateMethodologyUnits.some((unit) => unit.kind === "heading" && /RETAIN/.test(unit.text)));
assert.ok(alternateMethodologyUnits.some((unit) => unit.kind === "checklist" && /行动反馈/.test(unit.text)));
assert.ok(alternateMethodologyUnits.some((unit) => unit.kind === "formula" && /留存率/.test(unit.text)));

const coverage = buildMethodologyVisualCoverage({
  requiredUnits: methodologyUnits,
  visualScenes: [
    { id: "visual-1", text: "三步法：写出人物表层欲望；找到阻碍他的误信念；用关键选择验证变化" },
    { id: "visual-2", text: "人物活力评分表：维度按0分/2分评估；主动性——被动等待/主动制造行动；代价——没有代价/选择必须付费" },
  ],
});
assert.equal(coverage.status, "pass");
assert.equal(coverage.missingUnitCount, 0);

const missingCoverage = buildMethodologyVisualCoverage({
  requiredUnits: methodologyUnits,
  visualScenes: [{ id: "visual-1", text: "人物要有欲望" }],
});
assert.equal(missingCoverage.status, "fail");
assert.ok(missingCoverage.missingUnitCount > 0);

process.stdout.write(`${JSON.stringify({
  pass: true,
  canonicalUnitCount: canonical.units.length,
  longResolvedCount: longPlan.resolvedCount,
  shortResolvedCount: shortPlan.resolvedCount,
  twentyTwoMinuteUniquePages: twentyTwoMinutePlan.uniqueGeneratedPageCount,
  twentyTwoMinuteMicroVisualBeats: twentyTwoMinutePlan.microVisualBeatTarget,
  expandedSceneCount: expansion.scenes.length,
  methodologyUnitCount: methodologyUnits.length,
}, null, 2)}\n`);
