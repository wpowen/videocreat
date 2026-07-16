#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv[2] || join(root, "research", "personal-ip-no-downgrade-self-test"));
const briefPath = join(out, "fixture-brief.json");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(briefPath, JSON.stringify({
  title: "个人 IP + 动画：阻塞不降级",
  objective: "用个人 IP + 动画生成短视频；缺少母版时必须停止，不能切换到其他渲染器。",
  language: "zh-CN",
  platform: "local-review-horizontal",
  aspectRatio: "16:9",
  durationSeconds: 6,
  generationMode: "full-auto",
  personalIpAnimation: "semantic-layers",
  personalIpAnimationAuthorization: {
    authorizedByUser: true,
    mode: "semantic-layers",
    source: "用户明确要求：用个人 IP + 动画生成短视频。",
  },
  scenes: [
    { id: "hook", label: "建立压力", headline: ["先给压力", "再给未知"], body: "第一步建立未完成感。", subtitle: "先建立压力。", palette: "blue" },
    { id: "path", label: "路径推进", headline: ["语义分层", "独占所有权"], body: "第二步验证图层合同。", subtitle: "再验证图层。", palette: "orange" },
    { id: "resolve", label: "行动收束", headline: ["保持终态", "不允许降级"], body: "缺少母版就停止。", subtitle: "缺少母版就停止。", palette: "gold" },
  ],
  narration: "先建立压力。再验证图层。缺少母版就停止。",
  rights: {
    text: "original self-test",
    visuals: "local deterministic planning only",
    voice: "not reached because route blocks before audio",
    music: "none",
    externalMedia: "none",
  },
}, null, 2) + "\n");

const result = spawnSync("node", [
  join(root, "scripts", "poc-video-workflow.mjs"),
  "--brief", briefPath,
  "--out", out,
  "--generation-mode", "full-auto",
  "--image-source", "image2-dryrun",
  "--allow-degraded-renderer",
  "--no-open-output",
], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});

assert.notEqual(result.status, 0, "missing personal-IP master must block the full render");
assert.match(`${result.stdout}\n${result.stderr}`, /Personal-IP semantic-layer route blocked at pre-cover-full-render/);
const blockedPath = join(out, "workflow", "personal-ip-semantic-layer-blocked.json");
assert.ok(existsSync(blockedPath), "semantic blocked manifest must be written");
const blocked = JSON.parse(readFileSync(blockedPath, "utf8"));
assert.equal(blocked.blocked, "personal-ip-semantic-layer-master-required");
assert.equal(blocked.routeIsolation?.fallbackAllowed, false);
assert.ok(blocked.routeIsolation?.forbiddenFallbacks?.includes("default-html-animation"));
assert.ok(blocked.routeIsolation?.forbiddenFallbacks?.includes("plain-personal-ip-native-pages"));
assert.ok(!existsSync(join(out, "renders", "final.mp4")), "blocked route must not emit a final MP4");
assert.ok(!existsSync(join(out, "delivery-manifest.json")), "blocked route must not emit a delivery manifest");
assert.ok(!existsSync(join(out, "workflow", "html-video-render.json")), "blocked route must not enter the default HTML renderer");
assert.ok(!existsSync(join(out, "workflow", "native-page-render-config.json")), "blocked route must not enter the plain personal-IP renderer");
assert.ok(existsSync(join(out, "workflow", "cover-parallel-execution.json")), "cover planning must remain available in parallel even when the personal-IP video lane blocks");

console.log(JSON.stringify({
  pass: true,
  route: "personal-ip-semantic-layers-svg-html-video",
  stage: blocked.stage,
  fallbackAllowed: blocked.routeIsolation.fallbackAllowed,
  output: out,
}, null, 2));
