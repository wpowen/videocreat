#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(process.env.CODEX_VIDEO_WORKFLOW_TEST_ROOT || resolve(__dirname, ".."));
const out = join(workspace, "research", "codex-video-workflow-poc", "cover-content-routing-self-test");
const briefPath = join(out, "input-brief.json");

function fail(message) {
  throw new Error(message);
}

function main() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const brief = {
    title: "写小说实践：如何从灵感转化为小说主题",
    language: "zh",
    audience: "正在筛选小说题材、希望完成作品的小说作者",
    objective: "把十个原始灵感通过故事发动、读者承诺、展开能力和作者资源四层检查，筛成一个主项目和一个备用项目。",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 30,
    videoType: "tutorial-explainer",
    imageSource: "image2-dryrun",
    personalIp: true,
    audioGender: "female",
    scenes: [
      {
        id: "idea-pool",
        label: "灵感池",
        headline: ["十个灵感", "先别急着写"],
        body: "先建立十条人物加异常处境的原始灵感；候选人物可以包含欲望和误信念，但它们不能覆盖本期的选题决策主题。",
        subtitle: "先建立十条原始灵感，再进入筛选。"
      },
      {
        id: "four-gates",
        label: "四层筛选",
        headline: ["故事发动", "资源匹配"],
        body: "同时检查故事发动、读者承诺、展开能力和作者资源。",
        subtitle: "每个候选项目都要通过四层检查。"
      },
      {
        id: "decision",
        label: "选题决策",
        headline: ["主项目", "备用项目"],
        body: "最终确定一个主项目、一个备用项目和明确切换条件。",
        subtitle: "最后留下一个能写完的主项目和一个备用项目。"
      }
    ],
    narration: "先建立十条原始灵感，人物可以有欲望和误信念，但这一步仍然是在做选题决策。每个候选项目都要通过故事发动、读者承诺、展开能力和作者资源四层检查。最后留下一个能写完的主项目和一个备用项目。"
  };
  writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
  const result = spawnSync(process.execPath, [
    join(workspace, "scripts", "poc-video-workflow.mjs"),
    "--brief", briefPath,
    "--out", out,
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-delivery-page"
  ], { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) fail(`cover-only workflow failed:\n${result.stdout}\n${result.stderr}`);

  const design = JSON.parse(readFileSync(join(out, "workflow", "cover-design.json"), "utf8"));
  const requests = JSON.parse(readFileSync(join(out, "workflow", "context-image2-cover-requests.json"), "utf8"));
  const promptPlan = JSON.parse(readFileSync(join(out, "workflow", "cover-image2-prompts.json"), "utf8"));
  const coverQc = JSON.parse(readFileSync(join(out, "workflow", "cover-image2-qc.json"), "utf8"));
  const primary = requests.requests.find((request) => request.targetId === "youtube-1280x720");
  const prompt = String(primary?.prompt || "");
  const failures = [];
  if (design.hookText !== "灵感怎么选?") failures.push(`hookText=${design.hookText}`);
  if (design.payoffText !== "10个只留1个") failures.push(`payoffText=${design.payoffText}`);
  if (design.masterCoverConcept?.compositionTemplate !== "selection-funnel decision cover") failures.push(`template=${design.masterCoverConcept?.compositionTemplate}`);
  if (design.coverArtDirectionSystem?.methodologyVersion !== "cover-art-direction-system-v1") failures.push(`artDirectionVersion=${design.coverArtDirectionSystem?.methodologyVersion}`);
  if (design.coverArtDirectionSystem?.selectedStyleCount !== 1) failures.push(`selectedStyleCount=${design.coverArtDirectionSystem?.selectedStyleCount}`);
  if (!design.coverArtDirectionSystem?.selectionReason) failures.push("cover art-direction selection reason missing");
  const selectedStyleId = design.coverArtDirectionSystem?.selectedStyle?.id;
  if (!selectedStyleId) failures.push("cover art-direction selected style missing");
  if (requests.coverArtDirectionSystem?.selectedStyle?.id !== selectedStyleId) failures.push("request manifest art-direction style differs from cover design");
  if (!prompt.includes("正在筛选小说题材、希望把灵感变成可完成项目的小说作者")) failures.push("novel-writer audience missing");
  if (!prompt.includes("十张灵感卡进入四层筛选漏斗")) failures.push("selection-funnel proof missing");
  if (!prompt.includes("主项目") || !prompt.includes("备用项目")) failures.push("main/backup project proof missing");
  if (prompt.includes("想提升点击率、完播率和内容交付质量")) failures.push("generic content-creator audience leaked");
  if (prompt.includes("读者买的是承诺") || prompt.includes("情绪兑现票据")) failures.push("unrelated reader-promise cover route leaked");
  if (prompt.includes("改前") || prompt.includes("改后")) failures.push("generic before/after language leaked");
  if (prompt.includes("before-after proof") || prompt.includes("screen demo glass workspace")) failures.push("generic knowledge-cover visual preset leaked");
  if (prompt.length > 4500) failures.push(`imagegen prompt is too long: ${prompt.length} chars`);
  if (!prompt.includes("Use case: ads-marketing")) failures.push("system imagegen taxonomy slug missing");
  if (!prompt.includes("Asset type: platform-submission video cover")) failures.push("system imagegen asset type missing");
  if (!prompt.includes("Text (verbatim):")) failures.push("verbatim text contract missing");
  if (!prompt.includes(`Art direction style: ${selectedStyleId}`)) failures.push("selected art-direction style missing from prompt");
  if (!prompt.includes("Use exactly one style atom")) failures.push("single-style prompt invariant missing");
  const primaryPalette = design.platformPaletteSystems?.find((item) => item.targetId === "youtube-1280x720");
  if (primaryPalette?.methodologyVersion !== "cover-semantic-color-system-v1") failures.push(`coverColorVersion=${primaryPalette?.methodologyVersion}`);
  if (primaryPalette?.semanticFamilyId !== "literary-plum") failures.push(`coverColorFamily=${primaryPalette?.semanticFamilyId}`);
  if (primaryPalette?.surfaceMode !== "muted") failures.push(`coverSurfaceMode=${primaryPalette?.surfaceMode}`);
  if (!primaryPalette?.selectionReason || !primaryPalette?.backgroundPolicy) failures.push("semantic cover color decision evidence missing");
  if (!prompt.includes("semantic family literary-plum")) failures.push("semantic color family missing from prompt");
  if (!prompt.includes("No automatic full-canvas warm yellow/cream")) failures.push("warm-paper anti-sameness rule missing from prompt");
  if (/cinema-amber|#f7f0e2|#efe4d1/.test(prompt)) failures.push("legacy yellow-paper palette leaked into the production prompt");
  for (const internalPhrase of ["Prompt-library adaptation", "Methodology driver", "Primary click motivation", "UI quality bars"]) {
    if (prompt.includes(internalPhrase)) failures.push(`internal prompt methodology leaked: ${internalPhrase}`);
  }
  if (requests.requests.length !== 9) failures.push(`default cover run requested ${requests.requests.length} platform covers instead of all 9 planned targets`);
  const promptByTarget = new Map((promptPlan.prompts || []).map((item) => [String(item.targetId || "").replace(/-image2-integrated-cover$/, ""), item]));
  const paletteByTarget = new Map((design.platformPaletteSystems || []).map((item) => [item.targetId, item]));
  for (const request of requests.requests) {
    const targetPrompt = String(request.prompt || "");
    const promptItem = promptByTarget.get(request.targetId);
    const palette = paletteByTarget.get(request.targetId);
    if (!promptItem) failures.push(`${request.targetId}: prompt plan item missing`);
    if (targetPrompt.length > 4500) failures.push(`${request.targetId}: imagegen prompt is too long: ${targetPrompt.length} chars`);
    if (request.coverArtDirectionStyleId !== selectedStyleId
      || promptItem?.coverArtDirectionSystem?.selectedStyle?.id !== selectedStyleId
      || promptItem?.coverArtDirectionStyle?.id !== selectedStyleId) {
      failures.push(`${request.targetId}: selected art-direction style is not stable across request and prompt plan`);
    }
    if (palette?.methodologyVersion !== "cover-semantic-color-system-v1"
      || palette?.semanticFamilyId !== "literary-plum"
      || palette?.surfaceMode !== "muted"
      || !palette?.selectionReason
      || !palette?.backgroundPolicy) {
      failures.push(`${request.targetId}: semantic color decision is incomplete`);
    }
    for (const requiredToken of [
      `Art direction style: ${selectedStyleId}`,
      "Use exactly one style atom",
      "semantic family literary-plum",
      "surface muted",
      "No automatic full-canvas warm yellow/cream",
    ]) {
      if (!targetPrompt.includes(requiredToken)) failures.push(`${request.targetId}: prompt missing ${requiredToken}`);
    }
    if (/cinema-amber|#f7f0e2|#efe4d1/.test(targetPrompt)) failures.push(`${request.targetId}: legacy yellow-paper palette leaked`);
  }
  const assessmentTargetIds = new Set((coverQc.promptAssessments || []).map((item) => String(item.targetId || "").replace(/-image2-integrated-cover$/, "")));
  if (assessmentTargetIds.size !== requests.requests.length
    || requests.requests.some((request) => !assessmentTargetIds.has(request.targetId))) {
    failures.push("cover QC prompt assessments do not cover the complete nine-target request set");
  }
  if (requests.requestCountContract?.expectedRequestCount !== 9
    || requests.requestCountContract?.actualRequestCount !== 9
    || requests.requestCountContract?.pass !== true) {
    failures.push(`cover request-count contract is incomplete: ${JSON.stringify(requests.requestCountContract)}`);
  }
  if (requests.parallelGenerationPolicy?.defaultMaxConcurrency !== 9
    || requests.requestCountContract?.concurrencyIsThroughputOnly !== true
    || !/throughput only|never cap or slice/i.test(requests.parallelGenerationPolicy?.rule || "")) {
    failures.push("cover concurrency is no longer proven independent from total request count");
  }
  if (requests.generationContract?.skill !== "system-imagegen") failures.push(`cover skill route=${requests.generationContract?.skill}`);
  if (requests.generationContract?.executionMode !== "built-in-image_gen") failures.push(`cover executionMode=${requests.generationContract?.executionMode}`);
  if (!Array.isArray(primary?.inputImages) || !primary.inputImages.some((image) => image.role === "main-anchor" && image.path)) {
    failures.push("personal-IP cover request is missing an explicit main-anchor input image");
  }
  if (failures.length) fail(`cover content routing regression:\n- ${failures.join("\n- ")}`);
  console.log(JSON.stringify({ ok: true, out, hookText: design.hookText, payoffText: design.payoffText, template: design.masterCoverConcept.compositionTemplate }, null, 2));
}

main();
