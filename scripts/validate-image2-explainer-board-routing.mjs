#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const outDir = resolve(process.argv[2] || "research/codex-video-workflow-poc/image2-explainer-board-self-test");
const expectedPresetId = "image2-explainer-board-v1";
const presetContract = JSON.parse(readFileSync(new URL("../assets/visual-presets/image2-explainer-board-v1.json", import.meta.url), "utf8"));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function requiredJson(relPath, failures) {
  const fullPath = join(outDir, relPath);
  expect(existsSync(fullPath), `missing ${relPath}`, failures);
  return existsSync(fullPath) ? readJson(fullPath) : null;
}

const failures = [];
const strategy = requiredJson("workflow/image-generation-strategy.json", failures);
const prompts = requiredJson("workflow/image2-prompts.json", failures);
const media = requiredJson("workflow/media-routing-plan.json", failures);
const design = requiredJson("workflow/design-plan.json", failures);
const visualAudit = requiredJson("workflow/visual-relevance-audit.json", failures);
const presetLock = requiredJson("workflow/visual-preset-lock.json", failures);
const qcPath = join(outDir, "logs/qc.json");
const qc = existsSync(qcPath) ? readJson(qcPath) : null;

if (!failures.length) {
  const sceneRoutes = Array.isArray(strategy.sceneRoutes) ? strategy.sceneRoutes : [];
  const promptRows = Array.isArray(prompts.prompts) ? prompts.prompts : [];
  const mediaRoutes = Array.isArray(media.sceneRoutes) ? media.sceneRoutes : [];
  const designPages = Array.isArray(design.pages) ? design.pages : [];
  const visualRows = Array.isArray(visualAudit.scenes) ? visualAudit.scenes : [];
  const explainerRoutes = sceneRoutes.filter((route) => route.explainerBoard?.active);
  const explainerPrompts = promptRows.filter((row) => row.explainerBoard?.active || row.visualAssetDecision?.explainerBoard?.active);
  const joinedPrompts = explainerPrompts.map((row) => row.prompt || "").join("\n---\n");

  expect(presetContract.presetId === expectedPresetId, "asset preset contract must define image2-explainer-board-v1", failures);
  expect(strategy.schemaVersion === 1, "image-generation-strategy schemaVersion must be 1", failures);
  expect(Number(strategy.plannerPolicy?.explainerBoardSceneCount || 0) > 0, "strategy must count at least one explainer-board scene", failures);
  expect(strategy.plannerPolicy?.lockedVisualPresetId === expectedPresetId, "strategy plannerPolicy must lock the approved explainer-board preset", failures);
  expect(Array.isArray(strategy.activeVisualPresets) && strategy.activeVisualPresets.some((preset) => preset.id === expectedPresetId), "strategy.activeVisualPresets must include image2-explainer-board-v1", failures);
  expect(presetLock.status === "active", "visual-preset-lock must be active for this self-test", failures);
  expect(Array.isArray(presetLock.activePresetIds) && presetLock.activePresetIds.includes(expectedPresetId), "visual-preset-lock must include the approved preset id", failures);
  expect(Array.isArray(presetLock.rejectList) && presetLock.rejectList.some((item) => /empty right-side card/i.test(item)), "visual-preset-lock must reject empty right-side cards", failures);
  expect(explainerRoutes.length > 0, "strategy.sceneRoutes must include active explainerBoard routes", failures);
  expect(explainerRoutes.every((route) => route.explainerBoard?.presetId === expectedPresetId), "all active explainer routes must carry the approved preset id", failures);
  expect(explainerPrompts.length > 0, "image2-prompts must include active explainerBoard prompt rows", failures);
  expect(explainerPrompts.every((row) => row.visualPresetId === expectedPresetId && row.promptMethodology?.visualPresetId === expectedPresetId), "all active explainer prompt rows must carry the approved preset id", failures);
  expect(mediaRoutes.some((route) => route.image2?.explainerBoard?.active), "media-routing-plan must expose image2.explainerBoard", failures);
  expect(mediaRoutes.some((route) => route.image2?.explainerBoard?.presetId === expectedPresetId), "media-routing-plan must expose the approved preset id", failures);
  expect(designPages.some((page) => page.visualAssetDecision?.explainerBoard?.active), "design-plan must persist visualAssetDecision.explainerBoard", failures);
  expect(designPages.every((page) => !page.visualAssetDecision?.explainerBoard?.active || page.visualAssetDecision.explainerBoard.presetId === expectedPresetId), "design-plan active explainer pages must carry the approved preset id", failures);
  expect(visualRows.some((row) => row.visualAssetDecision?.explainerBoard?.active), "visual-relevance-audit must persist explainerBoard decision", failures);
  expect(/讲解型信息图分镜底图/.test(joinedPrompts), "prompt must request an explainer-board storyboard plate", failures);
  expect(/分镜拆分/.test(joinedPrompts), "prompt must include a storyboard split plan", failures);
  expect(/不要生成中文正文/.test(joinedPrompts), "prompt must forbid baked-in Chinese body text", failures);
  expect(/空白标签牌/.test(joinedPrompts), "prompt must use blank label plaques instead of readable generated text", failures);
  expect(!/Irasutoya|霞关|Kasumigaseki/i.test(joinedPrompts), "final image prompts must not name copied style/source references", failures);
  if (prompts.mode === "image2-dryrun") {
    expect(explainerRoutes.every((route) => route.visualAssetDecision?.blockedReason), "dryrun explainer routes must record prompt-only blocker", failures);
    expect(Number(strategy.plannerPolicy?.explainerBoardBitmapSceneCount || 0) === 0, "dryrun must not claim explainer-board bitmap insertion", failures);
  }
  if (qc) {
    for (const check of presetContract.qcGuardrails || []) {
      expect(qc.checks?.[check] === true, `QC guardrail ${check} must pass for the approved preset`, failures);
    }
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, outDir, failures }, null, 2));
  process.exit(1);
}

const count = Number(strategy.plannerPolicy?.explainerBoardSceneCount || 0);
console.log(JSON.stringify({
  ok: true,
  outDir,
  mode: prompts.mode,
  presetId: expectedPresetId,
  explainerBoardSceneCount: count,
  explainerBoardBitmapSceneCount: Number(strategy.plannerPolicy?.explainerBoardBitmapSceneCount || 0),
}, null, 2));
