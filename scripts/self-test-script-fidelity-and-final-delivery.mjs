#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  buildFinalDeliveryPathContract,
  buildScriptFidelityAudit,
  resolveCanonicalNarration,
} from "./lib/script-and-delivery-contract.mjs";

const root = mkdtempSync(join(tmpdir(), "codex-video-script-delivery-"));
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

const providedScript = "第一句必须原样保留。\n\n第二句也不能被场景摘要替换！";
const canonical = resolveCanonicalNarration({
  brief: {
    title: "严格口播回归",
    script: providedScript,
    scenes: [
      { id: "a", subtitle: "错误摘要甲。" },
      { id: "b", subtitle: "错误摘要乙。" },
      { id: "c", subtitle: "错误摘要丙。" },
    ],
  },
});
assert.equal(canonical.text, providedScript);
assert.equal(canonical.source, "brief.script");
assert.equal(canonical.explicit, true);

const nestedCanonical = resolveCanonicalNarration({
  brief: { sourceMaterial: { kind: "voiceover-script", script: providedScript } },
});
assert.equal(nestedCanonical.text, providedScript);
assert.equal(nestedCanonical.source, "brief.sourceMaterial.script");

const nestedScriptFile = join(root, "nested-script.txt");
writeFileSync(nestedScriptFile, `${providedScript}\n`);
const nestedPathCanonical = resolveCanonicalNarration({
  brief: { sourceMaterial: { kind: "voiceover-script", scriptPath: "nested-script.txt" } },
  briefDirectory: root,
});
assert.equal(nestedPathCanonical.text, providedScript);
assert.equal(nestedPathCanonical.source, "brief.sourceMaterial.scriptPath");

assert.throws(() => resolveCanonicalNarration({
  brief: {
    narration: "版本甲。",
    script: "版本乙。",
  },
}), /conflicting authoritative narration/i);

const integrationBriefPath = join(root, "script-field-brief.json");
const integrationOut = join(root, "script-field-package");
writeFileSync(integrationBriefPath, `${JSON.stringify({
  title: "主流程严格口播回归",
  objective: "验证主流程不会让场景摘要替换用户原稿",
  language: "zh",
  imageSource: "local",
  script: providedScript,
  scenes: [
    { id: "scene-1", label: "错误甲", subtitle: "错误摘要甲。" },
    { id: "scene-2", label: "错误乙", subtitle: "错误摘要乙。" },
    { id: "scene-3", label: "错误丙", subtitle: "错误摘要丙。" },
  ],
}, null, 2)}\n`);
const integrationRun = spawnSync(process.execPath, [
  join(scriptDirectory, "poc-video-workflow.mjs"),
  "--brief", integrationBriefPath,
  "--out", integrationOut,
  "--cover-only",
  "--image-source", "local",
  "--no-open-output",
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(integrationRun.status, 0, integrationRun.stderr || integrationRun.stdout);
assert.equal(readFileSync(join(integrationOut, "script", "narration.txt"), "utf8").trimEnd(), providedScript);
assert.equal(JSON.parse(readFileSync(join(integrationOut, "brief.json"), "utf8")).narration, providedScript);
const integrationDesignPlan = JSON.parse(readFileSync(join(integrationOut, "workflow", "design-plan.json"), "utf8"));
const integrationVisibleText = integrationDesignPlan.pages.map((page) => [
  ...(Array.isArray(page.frame?.headline) ? page.frame.headline : [page.frame?.headline]),
  page.frame?.body,
  page.frame?.subtitle,
].filter(Boolean).join(" ")).join(" ");
assert.doesNotMatch(integrationVisibleText, /错误摘要|错误甲|错误乙|错误丙/);
assert.equal(
  integrationDesignPlan.pages.map((page) => page.frame?.body || "").join("").replace(/\s/g, ""),
  providedScript.replace(/\s/g, ""),
);

const frameSegments = [
  { frameId: "a", text: "第一句必须原样保留。" },
  { frameId: "b", text: "第二句也不能被场景摘要替换！" },
];
const cueSegments = frameSegments.map((segment, index) => ({
  ...segment,
  index: index + 1,
}));
const fidelity = buildScriptFidelityAudit({
  canonical,
  narration: providedScript,
  spokenNarration: "第一句必须原样保留。\n第二句也不能被场景摘要替换！",
  frameSegments,
  cueSegments,
  visualSceneNarration: frameSegments.map((segment) => segment.text),
});
assert.equal(fidelity.pass, true);
assert.deepEqual(fidelity.failures, []);
assert.equal(fidelity.checks.sourceEqualsNarrationExactly, true);
assert.equal(fidelity.checks.spokenNarrationPreservesSourceText, true);
assert.equal(fidelity.checks.visualSceneNarrationPreservesSourceText, true);

const changedCue = buildScriptFidelityAudit({
  canonical,
  narration: providedScript,
  spokenNarration: providedScript,
  frameSegments,
  cueSegments: [
    cueSegments[0],
    { ...cueSegments[1], text: "第二句被改写了！" },
  ],
  visualSceneNarration: frameSegments.map((segment) => segment.text),
});
assert.equal(changedCue.pass, false);
assert.ok(changedCue.failures.includes("cueSegmentsPreserveSpokenNarration"));

const englishCanonical = resolveCanonicalNarration({
  brief: { script: "This workflow is not able to rewrite the source." },
});
const englishWhitespaceMutation = buildScriptFidelityAudit({
  canonical: englishCanonical,
  narration: englishCanonical.text,
  spokenNarration: "This workflow is notable to rewrite the source.",
  frameSegments: [{ text: "This workflow is notable to rewrite the source." }],
  cueSegments: [{ text: "This workflow is notable to rewrite the source." }],
  visualSceneNarration: ["This workflow is notable to rewrite the source."],
});
assert.equal(englishWhitespaceMutation.pass, false, "spaces between English tokens are content and must not be discarded");
assert.equal(englishWhitespaceMutation.checks.spokenNarrationPreservesSourceText, false);

const packageRoot = join(root, "package");
mkdirSync(join(packageRoot, "renders"), { recursive: true });
writeFileSync(join(packageRoot, "renders", "final.mp4"), "rendered-video");
writeFileSync(join(packageRoot, "final.mp4"), "rendered-video");
writeFileSync(join(packageRoot, "严格口播回归.mp4"), "rendered-video");

const delivery = buildFinalDeliveryPathContract({
  out: packageRoot,
  finalCopy: "严格口播回归.mp4",
  compatibilityFinalCopy: "final.mp4",
  renderArtifact: "renders/final.mp4",
  promotedToFinalDelivery: true,
});
assert.equal(delivery.pass, true);
assert.equal(delivery.finalOutputDirectory, realpathSync(packageRoot));
assert.equal(delivery.finalVideoPath, realpathSync(join(packageRoot, "严格口播回归.mp4")));
assert.equal(delivery.finalVideoRelativePath, "严格口播回归.mp4");
assert.equal(delivery.renderArtifactPath, realpathSync(join(packageRoot, "renders", "final.mp4")));
assert.notEqual(delivery.finalVideoPath, delivery.renderArtifactPath);

writeFileSync(join(packageRoot, "严格口播回归.mp4"), "tampered-video");
assert.throws(() => buildFinalDeliveryPathContract({
  out: packageRoot,
  finalCopy: "严格口播回归.mp4",
  compatibilityFinalCopy: "final.mp4",
  renderArtifact: "renders/final.mp4",
  promotedToFinalDelivery: true,
}), /does not match the QC-verified render artifact/i, "same-size tampering must fail hash verification");
writeFileSync(join(packageRoot, "严格口播回归.mp4"), "rendered-video");

assert.throws(() => buildFinalDeliveryPathContract({
  out: packageRoot,
  finalCopy: "不存在.mp4",
  compatibilityFinalCopy: "final.mp4",
  renderArtifact: "renders/final.mp4",
  promotedToFinalDelivery: true,
}), /final delivery video does not exist/i);
assert.throws(() => buildFinalDeliveryPathContract({
  out: packageRoot,
  finalCopy: "../outside.mp4",
  compatibilityFinalCopy: "final.mp4",
  renderArtifact: "renders/final.mp4",
  promotedToFinalDelivery: true,
}), /inside the output directory/i);

const outsideVideo = join(root, "outside.mp4");
writeFileSync(outsideVideo, "rendered-video");
symlinkSync(outsideVideo, join(packageRoot, "symlinked-final.mp4"));
assert.throws(() => buildFinalDeliveryPathContract({
  out: packageRoot,
  finalCopy: "symlinked-final.mp4",
  compatibilityFinalCopy: "final.mp4",
  renderArtifact: "renders/final.mp4",
  promotedToFinalDelivery: true,
}), /resolve to a file inside the output directory/i, "symlinked delivery files must not escape the package");

const reviewOnly = buildFinalDeliveryPathContract({
  out: packageRoot,
  finalCopy: null,
  compatibilityFinalCopy: null,
  renderArtifact: "renders/final.mp4",
  promotedToFinalDelivery: false,
});
assert.equal(reviewOnly.pass, true);
assert.equal(reviewOnly.finalOutputDirectory, null);
assert.equal(reviewOnly.finalVideoPath, null);
assert.equal(reviewOnly.workingOutputDirectory, realpathSync(packageRoot));
assert.equal(reviewOnly.reviewVideoPath, realpathSync(join(packageRoot, "renders", "final.mp4")));

console.log(JSON.stringify({
  pass: true,
  canonicalSource: canonical.source,
  finalOutputDirectory: delivery.finalOutputDirectory,
  finalVideoPath: delivery.finalVideoPath,
}, null, 2));

rmSync(root, { recursive: true, force: true });
