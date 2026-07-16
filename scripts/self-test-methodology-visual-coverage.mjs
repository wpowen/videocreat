#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workflowScript = join(dirname(fileURLToPath(import.meta.url)), "poc-video-workflow.mjs");
const root = mkdtempSync(join(tmpdir(), "methodology-visual-coverage-"));
const briefPath = join(root, "brief.json");
const sourcePath = join(root, "methodology.md");
const out = join(root, "package");
const fullOut = join(root, "full-package");
const audioPath = join(root, "provided-audio.m4a");
const narration = "人物活起来的关键，是欲望推动行动。误信念制造错误选择。最后由关键选择完成变化。";
const methodology = [
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
  "常用词来自专业流程：",
  "确认、归属、记录、处理、权限、风险。",
].join("\n");
writeFileSync(sourcePath, `${methodology}\n`, "utf8");
writeFileSync(briefPath, `${JSON.stringify({
  title: "小说实践：让你小说人物活起来",
  objective: "把课程方法论中的步骤和评分表呈现在画面上",
  canvas: { width: 1920, height: 1080 },
  narration,
  sourceMaterial: { kind: "methodology-courseware", path: sourcePath },
  scenes: [
    { id: "desire", label: "欲望", narration: "人物活起来的关键，是欲望推动行动。" },
    { id: "misbelief", label: "误信念", narration: "误信念制造错误选择。" },
    { id: "choice", label: "关键选择", narration: "最后由关键选择完成变化。" },
  ],
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

  const coverage = JSON.parse(readFileSync(join(out, "workflow", "methodology-visual-coverage.json"), "utf8"));
  const designPlan = JSON.parse(readFileSync(join(out, "workflow", "design-plan.json"), "utf8"));
  const renderedNarration = readFileSync(join(out, "script", "narration.txt"), "utf8").trim();
  assert.equal(coverage.status, "pass");
  assert.equal(coverage.missingUnitCount, 0);
  assert.ok(coverage.requiredUnitCount >= 8);
  assert.ok(!coverage.matches.some((unit) => unit.text === "常用词来自专业流程："), "contextual lead-ins ending at a colon must not become standalone methodology gates");
  assert.ok(designPlan.pages.length >= Math.ceil(coverage.requiredUnitCount / 4), "methodology units should increase the visual scene floor by layout capacity, not force one unit per page");
  assert.equal(designPlan.pages.length, 3, "a short three-scene narration should not expand to one page per methodology row");
  assert.equal(renderedNarration, narration, "visual-only methodology units must not be injected into spoken narration");
  const methodologyTexts = designPlan.pages.map((page) => [page.frame?.methodologyText, page.frame?.body].filter(Boolean).join(" "));
  assert.ok(methodologyTexts.some((text) => /主动性/.test(text)), JSON.stringify(methodologyTexts));
  assert.ok(methodologyTexts.some((text) => /选择必须付费/.test(text)), JSON.stringify(methodologyTexts));

  const audioResult = spawnSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=8",
    "-c:a", "aac", "-b:a", "192k", audioPath,
  ], { encoding: "utf8" });
  if (audioResult.status !== 0) throw new Error(audioResult.stderr || audioResult.stdout);
  const fullResult = spawnSync(process.execPath, [
    workflowScript,
    "--brief", briefPath,
    "--out", fullOut,
    "--generation-mode", "full-auto",
    "--provided-audio", audioPath,
    "--image-source", "local",
    "--scene-image-policy", "off",
    "--free-stock-policy", "off",
    "--no-open-output",
  ], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  if (![0, 2].includes(fullResult.status)) throw new Error(`${fullResult.stdout}\n${fullResult.stderr}`);
  const routeFinalCoverage = JSON.parse(readFileSync(join(fullOut, "workflow", "methodology-visual-coverage.json"), "utf8"));
  const audioReplan = JSON.parse(readFileSync(join(fullOut, "workflow", "audio-duration-scene-replan.json"), "utf8"));
  assert.equal(routeFinalCoverage.status, "pass");
  assert.equal(routeFinalCoverage.evidenceStage, "post-route-materialization");
  assert.equal(routeFinalCoverage.evidenceKind, "route-final-rendered-html-frames");
  assert.ok(routeFinalCoverage.materializedVisualSceneCount >= 3);
  assert.equal(audioReplan.status, "converged");
  assert.equal(audioReplan.actualDurationSeconds > 7, true);

  process.stdout.write(`${JSON.stringify({
    pass: true,
    requiredMethodologyUnits: coverage.requiredUnitCount,
    visualSceneCount: designPlan.pages.length,
    spokenNarrationUnchanged: renderedNarration === narration,
    routeFinalEvidence: routeFinalCoverage.evidenceKind,
    audioDurationReplan: audioReplan.status,
  }, null, 2)}\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
