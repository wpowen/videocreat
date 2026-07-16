#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enrichNativePageCountPolicyWithSourcePlan,
  resolveNativePageCountPolicy,
} from "./render-ip-diagram-native-pages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv[2] || join(root, "research", "native-page-adaptive-policy-self-test"));
const workflow = join(out, "workflow");
rmSync(out, { recursive: true, force: true });
mkdirSync(workflow, { recursive: true });

const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const manifestPath = join(workflow, "manifest.json");
writeJson(manifestPath, {
  imageCountPlan: "workflow/personal-ip-image-count-plan.json",
});
writeJson(join(workflow, "personal-ip-image-count-plan.json"), {
  schemaVersion: 3,
  minImageCount: 4,
  maxImageCount: 12,
  resolvedImageCount: 12,
  maximumPolicy: "duration-band-default-user-maximum-hard-cap",
  requestedMaximumApplied: true,
  contentMetrics: {
    automaticTarget: 20,
    durationBasedTarget: 20,
    subtitleCueBasedTarget: 29,
  },
});

const twelvePagePolicy = resolveNativePageCountPolicy({ personalIp: "on", maxPageCount: "12" }, 12);
assert.equal(twelvePagePolicy.withinRange, true, "the exact user-capped page set must pass");
assert.equal(twelvePagePolicy.maxPageCount, 12, "the explicit maximum must be hard");
assert.equal(twelvePagePolicy.requestedMaxPageCount, 12);
assert.equal(twelvePagePolicy.requestedMaximumAdvisoryOnly, false);

const enrichedTwelve = enrichNativePageCountPolicyWithSourcePlan(twelvePagePolicy, { manifestPath });
assert.equal(enrichedTwelve.sourceImageCountPlanRequiredCount, 12, "capacity plans must use resolved unique pages rather than the unconstrained automatic target");
assert.equal(enrichedTwelve.withinRequiredCount, true, "12 pages must satisfy the user-capped source plan");

const twentyPagePolicy = resolveNativePageCountPolicy({ personalIp: "on", maxPageCount: "12" }, 20);
const enrichedTwenty = enrichNativePageCountPolicyWithSourcePlan(twentyPagePolicy, { manifestPath });
assert.equal(enrichedTwenty.withinRange, false, "pages above the explicit maximum must fail");
assert.equal(enrichedTwenty.withinRequiredCount, false, "extra stale pages must not satisfy the exact source plan");

writeJson(join(workflow, "personal-ip-image-count-plan.json"), {
  schemaVersion: 1,
  minImageCount: 4,
  maxImageCount: 48,
  contentMetrics: {
    durationBasedTarget: 72,
    subtitleCueBasedTarget: 29,
    contentClarityTarget: 18,
  },
});
const legacySeventyTwoPagePolicy = resolveNativePageCountPolicy({ personalIp: "on" }, 72);
const legacyDriverOnly = enrichNativePageCountPolicyWithSourcePlan(legacySeventyTwoPagePolicy, { manifestPath });
assert.equal(legacyDriverOnly.sourceImageCountPlanRequiredCount, 72, "driver-only legacy plans must retain their strongest automatic floor");

const belowMinimum = resolveNativePageCountPolicy({ personalIp: "on", maxPageCount: "48" }, 3);
assert.equal(belowMinimum.withinRange, false, "the four-page minimum remains a hard floor");

console.log(JSON.stringify({
  pass: true,
  requestedMaximum: twelvePagePolicy.requestedMaxPageCount,
  hardMaximum: twelvePagePolicy.maxPageCount,
  requiredCount: enrichedTwelve.sourceImageCountPlanRequiredCount,
  acceptedPageCount: enrichedTwelve.actualPageCount,
  rejectedExtraCount: enrichedTwenty.actualPageCount,
}, null, 2));
