#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, "..");
const out = path.join(skillRoot, "research", "cover-only-state-preservation-self-test");
const briefPath = path.join(out, "brief.json");
const protectedFiles = [
  "brief.json",
  "delivery.html",
  "workflow/design-plan.json",
  "workflow/methodology-visual-coverage.json",
  "script/narration.txt",
];
const hash = (file) => createHash("sha256").update(fs.readFileSync(path.join(out, file))).digest("hex");

fs.rmSync(out, { recursive: true, force: true });
for (const directory of ["renders", "workflow", "script", "logs"]) {
  fs.mkdirSync(path.join(out, directory), { recursive: true });
}
const brief = {
  title: "小说实践：让人物活起来",
  language: "zh",
  platform: "local-review-horizontal",
  generationMode: "full-auto",
  narration: "人物欲望推动行动，误信念逼出错误选择，后果再迫使人物改变。",
  scenes: [
    { id: "scene-01", headline: "人物欲望", subtitle: "先写人物想得到什么。", narration: "先写人物想得到什么。" },
    { id: "scene-02", headline: "人物误信念", subtitle: "再写人物为什么会选错。", narration: "再写人物为什么会选错。" },
    { id: "scene-03", headline: "选择与后果", subtitle: "让后果迫使人物改变。", narration: "让后果迫使人物改变。" },
  ],
};
fs.writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
fs.writeFileSync(path.join(out, "renders", "final.mp4"), "existing-render-sentinel");
fs.writeFileSync(path.join(out, "delivery-manifest.json"), '{"mode":"video","renderer":"personal-ip-semantic-layers-svg-html-video"}\n');
fs.writeFileSync(path.join(out, "review-manifest.json"), '{"mode":"video-review","sentinel":true}\n');
fs.writeFileSync(path.join(out, "delivery.html"), "<html>existing video delivery</html>\n");
fs.writeFileSync(path.join(out, "workflow", "design-plan.json"), '{"sentinel":"video-design"}\n');
fs.writeFileSync(path.join(out, "workflow", "methodology-visual-coverage.json"), '{"status":"pass","missingUnitCount":0,"sentinel":true}\n');
fs.writeFileSync(path.join(out, "script", "narration.txt"), "existing timed narration\n");
fs.writeFileSync(path.join(out, "logs", "qc.json"), '{"pass":false,"sentinel":"awaiting-cover"}\n');
const before = Object.fromEntries(protectedFiles.map((file) => [file, hash(file)]));

const run = spawnSync(process.execPath, [
  path.join(here, "poc-video-workflow.mjs"),
  "--brief", briefPath,
  "--out", out,
  "--cover-only",
  "--generation-mode", "full-auto",
  "--image-source", "local",
  "--no-open-output",
], {
  cwd: skillRoot,
  env: { ...process.env, CODEX_VIDEO_WORKFLOW_HEADLESS: "1" },
  encoding: "utf8",
});

if (run.status !== 0) throw new Error(`cover-only update failed\n${run.stdout}\n${run.stderr}`);
if (!run.stdout.includes('"preservedExistingVideoPackage": true')) {
  throw new Error(`cover-only update did not report preservation\n${run.stdout}`);
}
for (const file of protectedFiles) {
  if (hash(file) !== before[file]) throw new Error(`cover-only update mutated protected video state: ${file}`);
}
const requests = JSON.parse(fs.readFileSync(path.join(out, "workflow", "context-image2-cover-requests.json"), "utf8"));
const primaryRequest = requests.requests?.find((request) => request.targetId === requests.primaryPlatformUploadCoverTargetId);
if (requests.requests?.length !== 9 || !primaryRequest?.prompt.includes("人物活起来")) {
  throw new Error("cover-only update did not refresh the canonical cover request");
}
const delivery = JSON.parse(fs.readFileSync(path.join(out, "delivery-manifest.json"), "utf8"));
const qc = JSON.parse(fs.readFileSync(path.join(out, "logs", "qc.json"), "utf8"));
if (delivery.publishingReady !== false || delivery.coverStatus?.pendingRequestCount !== 9) {
  throw new Error("cover-only update preserved stale publish-ready delivery state after replacing the cover request");
}
if (qc.pass !== false || qc.publishingReady !== false || qc.status !== "pending-cover-generation") {
  throw new Error("cover-only update preserved stale QC publishing state after replacing the cover request");
}

console.log("cover-only existing-video state preservation self-test passed");
