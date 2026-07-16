#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workflowScript = join(dirname(fileURLToPath(import.meta.url)), "poc-video-workflow.mjs");
const root = mkdtempSync(join(tmpdir(), "long-form-adaptive-routing-"));
const briefPath = join(root, "brief.json");
const out = join(root, "package");
const fallbackBriefPath = join(root, "fallback-brief.json");
const fallbackOut = join(root, "fallback-package");
const punctuationDenseBriefPath = join(root, "punctuation-dense-brief.json");
const punctuationDenseOut = join(root, "punctuation-dense-package");
const cueCounts = [10, 8, 10, 11, 8, 8, 8, 10, 9, 10, 10, 11];
const voiceoverSegments = [];
const scenes = cueCounts.map((cueCount, sceneIndex) => {
  const cues = Array.from({ length: cueCount }, (_, cueIndex) => ({
    id: `cue-${sceneIndex + 1}-${cueIndex + 1}`,
    sceneId: `source-scene-${sceneIndex + 1}`,
    text: `第${sceneIndex + 1}章第${cueIndex + 1}个连续口播要点，解释人物欲望、误信念和关键选择。`,
  }));
  voiceoverSegments.push(...cues);
  return {
    id: `source-scene-${sceneIndex + 1}`,
    label: `源章节 ${sceneIndex + 1}`,
    headline: [`人物方法 ${sceneIndex + 1}`],
    narration: cues.map((cue) => cue.text).join(""),
    subtitle: `源章节 ${sceneIndex + 1} 的核心结论`,
  };
});
const narration = voiceoverSegments.map((cue) => cue.text).join("");
writeFileSync(briefPath, `${JSON.stringify({
  title: "35分钟静态个人IP自适应页数",
  objective: "验证静态个人IP不会重复统计口播，也不会被48页截断",
  canvas: { width: 1920, height: 1080 },
  durationSeconds: 2133.117,
  subtitleCueCount: 113,
  narration,
  voiceoverSegments,
  scenes,
  personalIp: { name: "通用女性知识主讲人", allowGenericFallback: true, maxImageCount: 48 },
  personalIpAnimation: "off",
  generationMode: "full-auto",
}, null, 2)}\n`, "utf8");

try {
  const result = spawnSync(process.execPath, [
    workflowScript,
    "--brief", briefPath,
    "--out", out,
    "--generation-mode", "full-auto",
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-output",
  ], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

  const plan = JSON.parse(readFileSync(join(out, "workflow", "ip-diagram-creator-plan.json"), "utf8"));
  const policy = plan.imageCountPolicy.nativeSourcePageCountPolicy;
  assert.equal(policy.contentMetrics.unitCount, 113, "structured cues must be the canonical source instead of being added to scenes and full narration");
  assert.equal(policy.contentMetrics.charCount, Array.from(narration.replace(/\s/g, "")).length, "script characters must not be counted repeatedly across source tiers");
  assert.equal(policy.contentMetrics.durationBasedTarget, 24);
  assert.equal(policy.resolvedImageCount, 24);
  assert.equal(policy.requestedMaxImageCount, 48);
  assert.equal(policy.maxImageCountUnderAutomaticPolicy, false);
  assert.equal(policy.maxImageCountRaisedToAutomaticPolicy, false);
  assert.equal(policy.maximumPolicy, "duration-band-default-user-maximum-hard-cap");
  assert.equal(plan.imageCountPolicy.rawScriptUnitCount, 113);
  assert.equal(plan.imageCountPolicy.scriptUnitCount, 24, "native main image jobs must be capacity-packed instead of generating one page per subtitle cue");
  assert.equal(plan.imageCountPolicy.mainSceneImageJobs, 24);
  assert.equal(plan.imageCountPolicy.sceneVariantsPerScriptUnit, 0);
  assert.equal(plan.imageCountPolicy.supplementalSceneVariantCount, 0);
  assert.equal(plan.imageCountPolicy.targetTotal, 24);
  assert.equal(plan.imageCountPolicy.maxRepairGenerations, 5);

  const punctuationDenseNarration = Array.from(
    { length: 393 },
    (_, index) => `微句${String(index + 1).padStart(3, "0")}解释人物选择与代价关系。`,
  ).join("");
  writeFileSync(punctuationDenseBriefPath, `${JSON.stringify({
    title: "22分钟高标点密度个人IP页数回归",
    objective: "短句只驱动页内节拍，不能机械生成99张独立图片",
    canvas: { width: 1920, height: 1080 },
    durationSeconds: 1281.287,
    narration: punctuationDenseNarration,
    scenes: Array.from({ length: 9 }, (_, index) => ({
      id: `topic-${index + 1}`,
      label: `结构化主题 ${index + 1}`,
      narration: `第${index + 1}个结构化主题必须保留独立视觉覆盖。`,
    })),
    personalIp: { name: "通用女性知识主讲人", allowGenericFallback: true },
    personalIpAnimation: "off",
    generationMode: "full-auto",
  }, null, 2)}\n`, "utf8");
  const punctuationDenseResult = spawnSync(process.execPath, [
    workflowScript,
    "--brief", punctuationDenseBriefPath,
    "--out", punctuationDenseOut,
    "--generation-mode", "full-auto",
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-output",
  ], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  if (punctuationDenseResult.status !== 0) throw new Error(`${punctuationDenseResult.stdout}\n${punctuationDenseResult.stderr}`);
  const punctuationDensePlan = JSON.parse(readFileSync(join(punctuationDenseOut, "workflow", "ip-diagram-creator-plan.json"), "utf8"));
  const punctuationDensePolicy = punctuationDensePlan.imageCountPolicy.nativeSourcePageCountPolicy;
  const punctuationDenseAdaptiveScenePlan = JSON.parse(readFileSync(join(punctuationDenseOut, "workflow", "adaptive-content-scene-plan.json"), "utf8"));
  assert.equal(punctuationDensePolicy.contentMetrics.unitCount, 393);
  assert.equal(punctuationDensePolicy.contentMetrics.durationBasedTarget, 15);
  assert.equal(punctuationDensePolicy.contentMetrics.contentMatchTarget, 99, "393 micro beats remain represented in planner metadata");
  assert.equal(punctuationDensePolicy.resolvedImageCount, 16, JSON.stringify(punctuationDensePolicy.contentMetrics));
  assert.equal(punctuationDensePlan.imageCountPolicy.mainSceneImageJobs, 16);
  assert.equal(punctuationDensePlan.imageCountPolicy.targetTotal, 16);
  assert.equal(punctuationDensePlan.imageCountPolicy.maxRepairGenerations, 4);
  assert.equal(punctuationDenseAdaptiveScenePlan.countPlan.resolvedCount, 43, "cheap design/motion scenes may stay denser than the 16 unique native Image2 pages");

  const adaptiveScenePlan = JSON.parse(readFileSync(join(out, "workflow", "adaptive-content-scene-plan.json"), "utf8"));
  assert.equal(adaptiveScenePlan.countPlan.resolvedCount, 72);
  assert.equal(adaptiveScenePlan.allSourceScenesRepresented, true);
  assert.equal(adaptiveScenePlan.sourceCoveragePreserved, true);

  const fallbackNarration = Array.from({ length: 580 }, (_, index) => `微句${index + 1}说明人物选择。`).join("");
  writeFileSync(fallbackBriefPath, `${JSON.stringify({
    title: "35分钟全文回退去重",
    objective: "只有全文和字幕数量元数据时也不能把标点切分数误当成页面数",
    canvas: { width: 1920, height: 1080 },
    durationSeconds: 2133.117,
    subtitleCueCount: 113,
    narration: fallbackNarration,
    scenes: scenes.map((scene) => ({ ...scene, narration: fallbackNarration.slice(0, 80) })),
    personalIp: { name: "通用女性知识主讲人", allowGenericFallback: true, maxImageCount: 48 },
    personalIpAnimation: "off",
    generationMode: "full-auto",
  }, null, 2)}\n`, "utf8");
  const fallbackResult = spawnSync(process.execPath, [
    workflowScript,
    "--brief", fallbackBriefPath,
    "--out", fallbackOut,
    "--generation-mode", "full-auto",
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-output",
  ], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  if (fallbackResult.status !== 0) throw new Error(`${fallbackResult.stdout}\n${fallbackResult.stderr}`);
  const fallbackPlan = JSON.parse(readFileSync(join(fallbackOut, "workflow", "ip-diagram-creator-plan.json"), "utf8"));
  const fallbackPolicy = fallbackPlan.imageCountPolicy.nativeSourcePageCountPolicy;
  assert.equal(fallbackPolicy.contentMetrics.unitCount, 113, JSON.stringify({
    policy: fallbackPolicy,
    imageCountPolicy: {
      scriptUnitCount: fallbackPlan.imageCountPolicy.scriptUnitCount,
      scriptUnitSource: fallbackPlan.imageCountPolicy.scriptUnitSource,
    },
  }));
  assert.equal(fallbackPolicy.contentMetrics.charCount, Array.from(fallbackNarration.replace(/\s/g, "")).length, JSON.stringify({
    scriptUnitCount: fallbackPlan.imageCountPolicy.scriptUnits?.length,
    lastUnits: fallbackPlan.imageCountPolicy.scriptUnits?.slice(-3),
  }));
  assert.equal(fallbackPolicy.resolvedImageCount, 24, "580 punctuation splits must not inflate a 35-minute plan above the page-capacity target");

  process.stdout.write(`${JSON.stringify({
    pass: true,
    canonicalScriptUnits: policy.contentMetrics.unitCount,
    staticPersonalIpPages: policy.resolvedImageCount,
    staticPersonalIpMainJobs: plan.imageCountPolicy.mainSceneImageJobs,
    defaultAnimationScenes: adaptiveScenePlan.countPlan.resolvedCount,
    fallbackFullTextUnits: fallbackPolicy.contentMetrics.unitCount,
    fallbackStaticPages: fallbackPolicy.resolvedImageCount,
    punctuationDenseUnits: punctuationDensePolicy.contentMetrics.unitCount,
    punctuationDenseMicroBeats: punctuationDensePolicy.contentMetrics.contentMatchTarget,
    punctuationDenseUniquePages: punctuationDensePolicy.resolvedImageCount,
  }, null, 2)}\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
