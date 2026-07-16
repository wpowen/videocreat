#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "plan-image2-series-pages.mjs");
const root = mkdtempSync(join(tmpdir(), "image2-series-adaptive-count-"));

function run(extraArgs, outName, content = "人物要有欲望。误信念制造错误选择。关键选择暴露代价。") {
  const out = join(root, outName);
  const result = spawnSync(process.execPath, [
    script,
    "--series", "knowledge-encyclopedia-card-v1",
    "--out", out,
    "--aspect", "16:9",
    "--title", "自适应视觉系列",
    "--topic", "小说人物欲望与误信念",
    "--content", content,
    ...extraArgs,
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  return JSON.parse(readFileSync(join(out, "workflow", "image2-series-image-count-plan.json"), "utf8"));
}

try {
  const shortPlan = run([], "short");
  assert.equal(shortPlan.maximumPolicy, "adaptive-no-default-cap");
  assert.equal(shortPlan.requestedMaxImageCount, null);
  assert.equal(shortPlan.resolvedImageCount, 4);

  const longContent = Array.from({ length: 113 }, (_, index) => `第${index + 1}个连续口播要点解释人物欲望、误信念与选择代价。`).join("");
  const longPlan = run([
    "--duration-seconds", "2133.117",
    "--subtitle-cue-count", "113",
    "--max-image-count", "12",
  ], "long", longContent);
  assert.equal(longPlan.contentMetrics.durationBasedTarget, 72);
  assert.equal(longPlan.resolvedImageCount, 72);
  assert.equal(longPlan.maxImageCountUnderAutomaticPolicy, true);
  assert.equal(longPlan.maxImageCountRaisedToAutomaticPolicy, true);
  assert.equal(longPlan.maxImageCount, 72);
  assert.equal(new Set(longPlan.slots.map((slot) => slot.contentBeat)).size, 72, "long Image2 plans must not repeat content beats with modulo fallback");

  process.stdout.write(`${JSON.stringify({ pass: true, short: shortPlan.resolvedImageCount, long: longPlan.resolvedImageCount }, null, 2)}\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
