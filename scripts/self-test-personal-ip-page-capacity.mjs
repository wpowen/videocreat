#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildPersonalIpPageCapacityPlan } from "./lib/adaptive-content-scene-planner.mjs";

const currentLongHorizontal = buildPersonalIpPageCapacityPlan({
  aspect: "16:9",
  topicGroupCount: 9,
  durationSeconds: 1780,
  subtitleCueCount: 328,
  charCount: 7627,
  contentUnitCount: 328,
  minCount: 4,
});

assert.equal(currentLongHorizontal.uniqueGeneratedPageCount, 20, "29.7-minute horizontal narration should resolve to about 20 distinct generated pages");
assert.equal(currentLongHorizontal.maxUniquePages, 24, "15-30 minute personal-IP videos must stay inside the 24-page safety band by default");
assert.ok(currentLongHorizontal.microVisualBeatTarget > currentLongHorizontal.uniqueGeneratedPageCount, "subtitle cadence must remain available as in-page beats without creating more images");
assert.equal(currentLongHorizontal.repairVariantPolicy, "on-demand-qc-failures-only");
assert.equal(currentLongHorizontal.maxRepairGenerations, 4, "repair generation budget must be capped at 20% of the unique page count");

const punctuationDenseHorizontal = buildPersonalIpPageCapacityPlan({
  aspect: "16:9",
  topicGroupCount: 9,
  durationSeconds: 1281.287,
  charCount: 6530,
  contentUnitCount: 393,
  minCount: 4,
});

assert.equal(punctuationDenseHorizontal.uniqueGeneratedPageCount, 16, "punctuation-dense 22-minute narration must not create one image per short sentence");
assert.equal(punctuationDenseHorizontal.microVisualBeatTarget, 99, "the 393 semantic units should remain represented as 99 cheap in-page beats");

const userCapped = buildPersonalIpPageCapacityPlan({
  aspect: "16:9",
  topicGroupCount: 18,
  durationSeconds: 1780,
  charCount: 7627,
  contentUnitCount: 328,
  minCount: 4,
  requestedMaximum: 12,
});

assert.equal(userCapped.uniqueGeneratedPageCount, 12, "an explicit user maximum is a hard generation cap and must not be raised");
assert.equal(userCapped.requestedMaximumApplied, true);
assert.equal(userCapped.coverageStrategy, "semantic-packing-with-in-page-micro-beats");
assert.equal(userCapped.requestedMaximumRaisedToAutomatic, false);

const vertical = buildPersonalIpPageCapacityPlan({
  aspect: "9:16",
  topicGroupCount: 5,
  durationSeconds: 420,
  charCount: 2100,
  contentUnitCount: 48,
  minCount: 4,
});

assert.equal(vertical.pageCapacity.secondsPerPage, 60);
assert.equal(vertical.pageCapacity.charsPerPage, 300);
assert.ok(vertical.uniqueGeneratedPageCount <= 9, "3-8 minute personal-IP output must stay inside the 9-page safety band");

process.stdout.write(`${JSON.stringify({
  pass: true,
  currentLongHorizontal: currentLongHorizontal.uniqueGeneratedPageCount,
  punctuationDenseHorizontal: punctuationDenseHorizontal.uniqueGeneratedPageCount,
  userCapped: userCapped.uniqueGeneratedPageCount,
  vertical: vertical.uniqueGeneratedPageCount,
}, null, 2)}\n`);
