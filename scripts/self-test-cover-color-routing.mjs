#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(process.env.CODEX_VIDEO_WORKFLOW_TEST_ROOT || resolve(__dirname, ".."));
const root = join(workspace, "research", "codex-video-workflow-poc", "cover-color-routing-self-test");

const cases = [
  {
    id: "civic-route-muted",
    title: "一条航线，重画一座城",
    objective: "解释交通时间变化如何重新分配城市机会。",
    narration: "地图距离没有变化，但新的航线缩短了可达时间，也重新分配了城市机会。",
    styleId: "tactile-document-collage",
    expectedFamily: "civic-blueprint",
    expectedSurface: "muted",
    expectedBackground: "#294755",
  },
  {
    id: "ai-product-light",
    title: "AI 产品进入推理时代",
    objective: "解释 AI 产品从生成结果转向持续推理的变化。",
    narration: "新一代 AI 产品不只生成答案，还会规划、检查并持续修正任务。",
    styleId: "analytical-magazine-system",
    expectedFamily: "digital-violet",
    expectedSurface: "light",
    expectedBackground: "#f0f1ff",
  },
  {
    id: "climate-impact-dark",
    title: "海洋升温正在改写风暴",
    objective: "解释海洋热量如何改变风暴风险。",
    narration: "海洋吸收更多热量后，风暴获得了不同的能量条件，沿海风险随之改变。",
    styleId: "monumental-chinese-type",
    expectedFamily: "living-earth",
    expectedSurface: "dark",
    expectedBackground: "#102118",
  },
  {
    id: "narration-fallback-lab",
    title: "这一次真的不一样",
    objective: "解释材料实验中的微观结构机制。",
    narration: "研究人员通过材料实验观察微观结构变化，并解释它如何改变工程性能。",
    styleId: "research-mechanism-plate",
    expectedFamily: "lab-cyan",
    expectedSurface: "light",
    expectedBackground: "#edf8f8",
  },
];

function fail(message) {
  throw new Error(message);
}

function main() {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const results = [];
  for (const testCase of cases) {
    const out = join(root, testCase.id);
    const briefPath = join(out, "input-brief.json");
    mkdirSync(out, { recursive: true });
    const brief = {
      title: testCase.title,
      objective: testCase.objective,
      narration: testCase.narration,
      language: "zh",
      platform: "local-review-horizontal",
      aspectRatio: "16:9",
      videoType: "editorial-explainer",
      imageSource: "image2-dryrun",
      coverStyleId: testCase.styleId,
      coverPrimaryOnly: true,
      coverAllPlatforms: false,
      coverScopeAuthorization: {
        authorizedByUser: true,
        mode: "explicit-primary-only",
        requestedTargetIds: ["youtube-1280x720"],
        source: "Regression test for content-aware cover color routing.",
      },
      scenes: ["context", "change", "result"].map((stage, index) => ({
        id: `${stage}-${index + 1}`,
        label: `${testCase.title}-${index + 1}`,
        headline: [index === 0 ? testCase.title : index === 1 ? "变化发生" : "结果显现"],
        body: testCase.objective,
        subtitle: index === 0 ? testCase.title : testCase.objective,
      })),
    };
    writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
    const run = spawnSync(process.execPath, [
      join(workspace, "scripts", "poc-video-workflow.mjs"),
      "--brief", briefPath,
      "--out", out,
      "--cover-only",
      "--image-source", "image2-dryrun",
      "--no-open-delivery-page",
    ], { cwd: workspace, encoding: "utf8" });
    if (run.status !== 0) fail(`${testCase.id} failed:\n${run.stdout}\n${run.stderr}`);
    const design = JSON.parse(readFileSync(join(out, "workflow", "cover-design.json"), "utf8"));
    const requests = JSON.parse(readFileSync(join(out, "workflow", "context-image2-cover-requests.json"), "utf8"));
    const palette = design.platformPaletteSystems?.find((item) => item.targetId === "youtube-1280x720");
    const prompt = String(requests.requests?.[0]?.prompt || "");
    const mismatches = [];
    if (palette?.methodologyVersion !== "cover-semantic-color-system-v1") mismatches.push(`version=${palette?.methodologyVersion}`);
    if (palette?.semanticFamilyId !== testCase.expectedFamily) mismatches.push(`family=${palette?.semanticFamilyId}`);
    if (palette?.surfaceMode !== testCase.expectedSurface) mismatches.push(`surface=${palette?.surfaceMode}`);
    if (palette?.background !== testCase.expectedBackground) mismatches.push(`background=${palette?.background}`);
    if (requests.requests?.length !== 1) mismatches.push(`requests=${requests.requests?.length}`);
    if (!prompt.includes(`semantic family ${testCase.expectedFamily}`)) mismatches.push("prompt-family-missing");
    if (/cinema-amber|#f7f0e2|#efe4d1/.test(prompt)) mismatches.push("legacy-warm-paper-leak");
    if (!prompt.includes("No automatic full-canvas warm yellow/cream")) mismatches.push("anti-sameness-rule-missing");
    if (mismatches.length) fail(`${testCase.id}: ${mismatches.join(", ")}`);
    results.push({
      id: testCase.id,
      styleId: testCase.styleId,
      semanticFamilyId: palette.semanticFamilyId,
      surfaceMode: palette.surfaceMode,
      background: palette.background,
      accent: palette.accent,
      accent2: palette.accent2,
    });
  }
  if (new Set(results.map((item) => item.semanticFamilyId)).size !== results.length) fail("semantic color families are not topic-distinct");
  if (new Set(results.map((item) => item.background)).size !== results.length) fail("cover backgrounds collapsed to one repeated color");
  const invalidOut = join(root, "invalid-explicit-family");
  const invalidBriefPath = join(invalidOut, "input-brief.json");
  mkdirSync(invalidOut, { recursive: true });
  const invalidCase = cases[0];
  writeFileSync(invalidBriefPath, `${JSON.stringify({
    title: invalidCase.title,
    objective: invalidCase.objective,
    narration: invalidCase.narration,
    language: "zh",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    videoType: "editorial-explainer",
    imageSource: "image2-dryrun",
    coverStyleId: invalidCase.styleId,
    coverColorFamilyId: "unknown-yellow-default",
    scenes: ["context", "change", "result"].map((stage, index) => ({
      id: `${stage}-${index + 1}`,
      label: `${invalidCase.title}-${index + 1}`,
      headline: [invalidCase.title],
      body: invalidCase.objective,
      subtitle: invalidCase.objective,
    })),
  }, null, 2)}\n`);
  const invalidRun = spawnSync(process.execPath, [
    join(workspace, "scripts", "poc-video-workflow.mjs"),
    "--brief", invalidBriefPath,
    "--out", invalidOut,
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-delivery-page",
  ], { cwd: workspace, encoding: "utf8" });
  if (invalidRun.status === 0 || !`${invalidRun.stdout}\n${invalidRun.stderr}`.includes("Unsupported cover color family: unknown-yellow-default")) {
    fail("unknown explicit cover color family did not fail closed");
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main();
