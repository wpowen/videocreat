#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildContentDrivenSemanticLayers } from "./lib/personal-ip-semantic-layout-renderer.mjs";
import { validateDisplayedTextInventory, validatePersonalIpMasterAnalysis } from "./lib/personal-ip-master-analysis.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const workflow = readFileSync(resolve(root, "scripts/poc-video-workflow.mjs"), "utf8");
const skill = readFileSync(resolve(root, "SKILL.md"), "utf8");
const ownershipReference = readFileSync(resolve(root, "references/personal-ip-animation-layer-ownership.md"), "utf8");
const exporter = readFileSync(resolve(root, "scripts/export-personal-ip-semantic-layered-video.mjs"), "utf8");

const masterAnalysis = {
  status: "passed-vision-review",
  inspectorType: "vision",
  masterSha256: "master-sha",
  canvas: { width: 1080, height: 1920 },
  inspectionEvidence: { summary: "Verified layout zones and visual system against the selected master.", checkedAt: "2026-07-16T00:00:00.000Z" },
  objectInventory: [
    { id: "headline-zone", bounds: { x: 40, y: 60, width: 700, height: 240 } },
    { id: "content-zone", bounds: { x: 40, y: 340, width: 1000, height: 1280 } },
    { id: "persona-zone", bounds: { x: 720, y: 80, width: 320, height: 520 } },
  ],
  roleBindings: { headline: "headline-zone", "content-group": "content-zone", "personal-ip": "persona-zone" },
  styleTokens: { palette: ["#fef7ed", "#18232d", "#f0642c", "#3f6ed8"], typography: "serif headline and sans body", material: "paper cards", composition: "headline above content with presenter flank" },
};
const validatedMasterAnalysis = validatePersonalIpMasterAnalysis({ analysis: masterAnalysis, masterSha256: "master-sha", width: 1080, height: 1920 });
assert.equal(validatedMasterAnalysis.validation.pass, true);
assert.throws(() => validatePersonalIpMasterAnalysis({ analysis: masterAnalysis, masterSha256: "unrelated-master", width: 1080, height: 1920 }), /masterSha256/);
assert.throws(() => validatePersonalIpMasterAnalysis({ analysis: { ...masterAnalysis, roleBindings: {} }, masterSha256: "master-sha", width: 1080, height: 1920 }), /role bindings/i);
assert.throws(() => validateDisplayedTextInventory([]), /explicit source-bound/i);
assert.throws(() => validateDisplayedTextInventory([{ text: "钩子升级路径" }]), /text and source/i);
assert.deepEqual(validateDisplayedTextInventory([{ sceneId: "scene-1", field: "scene.title", text: "钩子升级路径", source: "brief.scenes[0].title" }]), [{ sceneId: "scene-1", field: "scene.title", text: "钩子升级路径", source: "brief.scenes[0].title" }]);

const layers = buildContentDrivenSemanticLayers({
  canvas: { width: 1080, height: 1920, aspectRatio: "9:16" },
  personaData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+Xw4P5QAAAABJRU5ErkJggg==",
  masterVisualAnalysis: validatedMasterAnalysis,
  scenes: [{
    id: "hook-upgrade-path",
    title: "钩子升级路径",
    subtitle: "压力、信息差、时间压力逐级升级",
    takeaway: "每一步都必须改变读者预期",
    moduleLabel: "写小说方法论",
    contentKind: "method-path",
    layoutVariant: "method-path",
    hookItems: [
      { label: "压力", body: "先制造未完成感" },
      { label: "信息差", body: "再控制答案释放" },
    ],
    routeItems: [
      { label: "倒计时", body: "时间开始收紧" },
      { label: "误导", body: "答案发生偏转" },
      { label: "揭示", body: "最终改变判断" },
    ],
  }],
});

const layerMap = new Map(layers.map(([id, role, z, body]) => [id, { role, z, body }]));
const expectedLayerIds = [
  "00-background",
  "30-content-path",
  "10-headline",
  "20-content-main",
  "40-annotation",
  "50-persona",
  "60-agent",
  "100-caption",
];

assert.deepEqual([...layerMap.keys()], expectedLayerIds, "personal-IP animation must export the complete semantic layer stack");
assert.equal(layerMap.get("100-caption")?.role, "subtitle-overlay", "subtitle must remain the topmost layer");
for (const id of expectedLayerIds.filter((id) => id !== "50-persona")) {
  assert.doesNotMatch(layerMap.get(id)?.body || "", /<image\b/i, `${id} must not hide page content inside a bitmap`);
}
assert.match(layerMap.get("10-headline")?.body || "", /<text\b/i, "headline must be deterministic SVG text");
assert.match(layerMap.get("10-headline")?.body || "", /data-master-object-id="headline-zone"/, "headline geometry must consume the inspected master role binding");
assert.match(layerMap.get("20-content-main")?.body || "", /data-master-object-id="content-zone"/, "content geometry must consume the inspected master role binding");
assert.match(layerMap.get("50-persona")?.body || "", /data-master-object-id="persona-zone"/, "persona geometry must consume the inspected master role binding");
assert.match(layerMap.get("00-background")?.body || "", /#fef7ed/i, "rendered palette must consume the inspected master style tokens");
assert.match(layerMap.get("20-content-main")?.body || "", /data-scene-main/i, "content cards must be a real semantic layer");
assert.match(layerMap.get("30-content-path")?.body || "", /<path\b/i, "relationship/path motion must be a real vector layer");
assert.ok(layerMap.get("30-content-path")?.z < layerMap.get("20-content-main")?.z, "relationship/path layer must stay below content");
assert.ok(expectedLayerIds.indexOf("30-content-path") < expectedLayerIds.indexOf("20-content-main"), "runtime SVG order must paint paths before content");
assert.match(layerMap.get("60-agent")?.body || "", /data-agent/i, "supporting Agent must be independently renderable");

assert.match(
  workflow,
  /function personalIpSemanticLayerRouteSelected[\s\S]*?semanticLayerVideoPlan[\s\S]*?selectedNow\s*===\s*true/,
  "explicit personal-IP animation must select the semantic SVG/HTML route",
);
assert.doesNotMatch(
  workflow,
  /function personalIpSemanticLayerRouteSelected[\s\S]{0,500}?return false;/,
  "semantic route may not be permanently disabled",
);
assert.doesNotMatch(
  workflow,
  /function renderWithPersonalIpSemanticLayers[\s\S]{0,500}?Retired personal-IP semantic template route/,
  "semantic renderer may not fail as a retired route",
);
assert.match(workflow, /flatCompositeBaseForbidden:\s*true/, "semantic route must reject a flattened page as the animation source");
assert.match(workflow, /function assertPersonalIpSemanticLayerNotBlocked[\s\S]*?must not downgrade to the default HTML renderer/, "blocked personal-IP animation may not fall back to another route");
assert.match(workflow, /personal-ip-layer-ownership-audit\.json/, "semantic route must promote the ownership audit into the final package");

assert.match(skill, /个人 IP \+ 动画[\s\S]*语义(?:内容)?分层/i, "Skill must describe the real semantic-layer route");
assert.match(skill, /背景[\s、,/]+标题[\s、,/]+内容/i, "Skill must name independently owned visual layers");
assert.match(skill, /(?:禁止|不得)[^\n]{0,100}(?:整页|全屏)[^\n]{0,100}(?:底图|位图|base)/i, "Skill must reject a full-page bitmap as final content owner");
assert.match(skill, /原子内容单元|atomic content-unit/i, "Skill must keep interlocked flat-master objects in one motion unit");
assert.match(ownershipReference, /Every non-background source pixel may have at most one runtime owner/i, "ownership contract must require exclusive source pixels");
assert.match(ownershipReference, /do not downgrade to default HTML animation/i, "ownership contract must isolate the route from existing modes");
assert.match(exporter, /if \(!qc\.pass\) process\.exitCode = 2/, "semantic exporter must exit nonzero when final QC fails");

console.log(JSON.stringify({
  pass: true,
  route: "personal-ip-semantic-layers-svg-html-video",
  layerIds: expectedLayerIds,
  bitmapPolicy: "persona-only-transparent-raster-allowed",
}, null, 2));
