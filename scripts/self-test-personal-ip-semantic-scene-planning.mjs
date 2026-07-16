#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildPersonalIpSemanticScenePlan } from "./lib/personal-ip-semantic-scene-planner.mjs";

const pageDurations = [185.358, 170.677, 165.718, 203.547, 139.755, 154.447, 154.322, 198.461, 170.756, 194.814, 187.047, 208.215];
const cueCounts = [10, 8, 10, 11, 8, 8, 8, 10, 9, 10, 10, 11];
const pages = pageDurations.map((durationSec, index) => ({
  id: index === 11 ? "closing-from-data-to-choice" : `source-page-${String(index + 1).padStart(2, "0")}`,
  durationSec,
  frame: { label: `源内容页 ${index + 1}`, subtitle: `源内容页 ${index + 1} 的结论` },
}));
const frames = pages.map((page, pageIndex) => ({
  ...page.frame,
  id: page.id,
  durationSec: page.durationSec,
  spokenText: Array.from({ length: cueCounts[pageIndex] }, (_, cueIndex) => `第${pageIndex + 1}页第${cueIndex + 1}个完整内容要点。`).join(""),
  subtitleCues: Array.from({ length: cueCounts[pageIndex] }, (_, cueIndex) => ({
    text: `第${pageIndex + 1}页第${cueIndex + 1}个完整内容要点。`,
    spokenText: `第${pageIndex + 1}页第${cueIndex + 1}个完整内容要点。`,
    duration: page.durationSec / cueCounts[pageIndex],
  })),
}));

const longPlan = buildPersonalIpSemanticScenePlan({
  brief: { durationSeconds: pageDurations.reduce((sum, value) => sum + value, 0), personalIp: {} },
  pages,
  frames,
});
assert.equal(longPlan.sourcePageCount, 12);
assert.equal(longPlan.growthDrivers.subtitleCueCount, 113);
assert.equal(longPlan.growthDrivers.durationBasedTarget, 72);
assert.equal(longPlan.resolvedSceneCount, 72);
assert.equal(longPlan.scenes.length, 72);
assert.equal(longPlan.growthRequired, true);
assert.equal(longPlan.maximumPolicy, "adaptive-no-default-cap");
assert.equal(longPlan.requestedMaximum, null);
assert.equal(longPlan.cappedByMaximum, false);
assert.equal(longPlan.allSourcePagesRepresented, true);
assert.equal(longPlan.sourceCoveragePreserved, true);
assert.ok(longPlan.representedSourcePageIds.includes("closing-from-data-to-choice"), "the twelfth source page was omitted");
assert.ok(longPlan.scenes.some((scene) => scene.sourcePageId === "closing-from-data-to-choice"), "the twelfth source page has no expanded semantic scene");

const staleFixedMaximumPlan = buildPersonalIpSemanticScenePlan({
  brief: {
    durationSeconds: pageDurations.reduce((sum, value) => sum + value, 0),
    personalIp: { semanticMaxSceneCount: 48 },
  },
  pages,
  frames,
});
assert.equal(staleFixedMaximumPlan.resolvedSceneCount, 72, "a stale fixed maximum must not clamp the adaptive content target");
assert.equal(staleFixedMaximumPlan.explicitMaximumUnderAutomatic, true);
assert.equal(staleFixedMaximumPlan.explicitMaximumRaisedToAutomatic, true);
assert.equal(staleFixedMaximumPlan.cappedByMaximum, false);

const shortPages = pages.slice(0, 3).map((page) => ({ ...page, durationSec: 3 }));
const shortFrames = frames.slice(0, 3).map((frame) => ({
  ...frame,
  durationSec: 3,
  spokenText: frame.subtitleCues[0].spokenText,
  subtitleCues: [{ ...frame.subtitleCues[0], duration: 3 }],
}));
const shortPlan = buildPersonalIpSemanticScenePlan({ brief: { durationSeconds: 9, personalIp: {} }, pages: shortPages, frames: shortFrames });
assert.equal(shortPlan.resolvedSceneCount, 3, "short content should not be padded to decorative pages");
assert.equal(shortPlan.growthRequired, false);

process.stdout.write(`${JSON.stringify({
  pass: true,
  longForm: {
    sourcePageCount: longPlan.sourcePageCount,
    resolvedSceneCount: longPlan.resolvedSceneCount,
    durationBasedTarget: longPlan.growthDrivers.durationBasedTarget,
    subtitleCueBasedTarget: longPlan.growthDrivers.subtitleCueBasedTarget,
    contentBasedTarget: longPlan.growthDrivers.contentBasedTarget,
    twelfthSourcePageRepresented: longPlan.representedSourcePageIds.includes("closing-from-data-to-choice"),
  },
  shortForm: {
    sourcePageCount: shortPlan.sourcePageCount,
    resolvedSceneCount: shortPlan.resolvedSceneCount,
  },
}, null, 2)}\n`);
