#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const workflowScript = join(skillRoot, "scripts", "poc-video-workflow.mjs");
const outRoot = join(workspace, "research", "codex-video-workflow-poc", "caption-strategy-routing-self-test");
const briefsDir = join(outRoot, "briefs");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function runWorkflowCase(testCase) {
  const briefPath = join(briefsDir, `${testCase.id}.json`);
  const caseOut = join(outRoot, testCase.id);
  writeJson(briefPath, testCase.brief);
  if (existsSync(caseOut) && caseOut.startsWith(outRoot)) {
    rmSync(caseOut, { recursive: true, force: true });
  }
  const args = [
    workflowScript,
    "--brief", briefPath,
    "--out", caseOut,
    "--mode", "recommended",
    "--image-source", "image2-dryrun",
    "--cover-only",
    "--no-open-delivery-page",
  ];
  const stdout = execFileSync("node", args, {
    cwd: workspace,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const captionPlanPath = join(caseOut, "workflow", "caption-style-plan.json");
  const designPlanPath = join(caseOut, "workflow", "design-plan.json");
  return {
    id: testCase.id,
    briefPath,
    out: caseOut,
    stdoutTail: stdout.trim().split(/\n/).slice(-8),
    captionPlanPath,
    designPlanPath,
    captionPlan: readJson(captionPlanPath),
    designPlan: readJson(designPlanPath),
  };
}

function sceneById(plan, id) {
  return (plan.scenes || []).find((scene) => scene.sceneId === id);
}

function assertScene(result, expectation, failures) {
  const scene = sceneById(result.captionPlan, expectation.sceneId);
  expect(Boolean(scene), `${result.id}/${expectation.sceneId}: caption scene must exist`, failures);
  if (!scene) return null;
  expect(scene.sceneJob === expectation.sceneJob, `${result.id}/${expectation.sceneId}: expected sceneJob ${expectation.sceneJob}, got ${scene.sceneJob}`, failures);
  expect(expectation.groups.includes(scene.group), `${result.id}/${expectation.sceneId}: expected group in ${expectation.groups.join(", ")}, got ${scene.group}`, failures);
  if (expectation.rejectGroups) {
    expect(!expectation.rejectGroups.includes(scene.group), `${result.id}/${expectation.sceneId}: group ${scene.group} is a rejected fallback for this condition`, failures);
  }
  if (expectation.semanticAny?.length) {
    expect(expectation.semanticAny.some((type) => (scene.semanticCueTypes || []).includes(type)), `${result.id}/${expectation.sceneId}: expected one semantic type from ${expectation.semanticAny.join(", ")}, got ${(scene.semanticCueTypes || []).join(", ")}`, failures);
  }
  if (expectation.requireEmphasis) {
    expect((scene.emphasisPlan?.tokens || []).length > 0, `${result.id}/${expectation.sceneId}: expected keyword emphasis tokens`, failures);
  }
  if (expectation.verticalSafeArea) {
    expect(scene.platformProfile === "short-form-vertical", `${result.id}/${expectation.sceneId}: expected short-form vertical profile, got ${scene.platformProfile}`, failures);
    expect(/vh$/.test(String(scene.geometry?.bottomInset || "")), `${result.id}/${expectation.sceneId}: expected viewport-relative bottom inset`, failures);
  }
  expect(scene.safeArea === "bottom-caption-band", `${result.id}/${expectation.sceneId}: safeArea must remain bottom-caption-band`, failures);
  expect(scene.displayMode === "single-line-sequential", `${result.id}/${expectation.sceneId}: displayMode must remain single-line-sequential`, failures);
  expect(scene.layerClass?.includes(`caption-group-${scene.group}`), `${result.id}/${expectation.sceneId}: layerClass must bind selected group ${scene.group}`, failures);
  expect(scene.emphasisPlan?.enabledByDefault === true, `${result.id}/${expectation.sceneId}: keyword highlight must be enabled by default`, failures);
  expect(scene.emphasisPlan?.mode === "keyword-visual-emphasis", `${result.id}/${expectation.sceneId}: keyword emphasis mode must stay visual-only highlight`, failures);
  expect((scene.emphasisPlan?.allowedTreatments || []).includes("bold"), `${result.id}/${expectation.sceneId}: keyword emphasis must support bold`, failures);
  expect((scene.emphasisPlan?.allowedTreatments || []).includes("accentColor"), `${result.id}/${expectation.sceneId}: keyword emphasis must support color difference`, failures);
  return {
    sceneId: expectation.sceneId,
    expectedSceneJob: expectation.sceneJob,
    actualSceneJob: scene.sceneJob,
    expectedGroups: expectation.groups,
    actualGroup: scene.group,
    selectedStyleId: scene.selectedStyleId,
    fallbackStyleId: scene.fallbackStyleId,
    semanticCueTypes: scene.semanticCueTypes,
    emphasisTokens: scene.emphasisPlan?.tokens || [],
    reason: scene.reason,
  };
}

function staticStrategyAssertions(failures) {
  const catalog = readJson(join(skillRoot, "assets", "caption-style-catalog.json"));
  const workflowSource = readFileSync(workflowScript, "utf8");
  const strategy = readFileSync(join(skillRoot, "references", "creative-subtitle-strategy.md"), "utf8");
  const subtitleDesign = readFileSync(join(skillRoot, "references", "subtitle-design.md"), "utf8");
  const knownGroups = new Set(Object.keys(catalog.groups || {}));
  expect(catalog.status === "active-caption-style-catalog", "caption catalog must be active", failures);
  expect((catalog.styles || []).length >= 68, "caption catalog must keep the 68-style creative set", failures);
  for (const [sceneJob, groups] of Object.entries(catalog.plannerSelection?.groupPriorityBySceneJob || {})) {
    expect(Array.isArray(groups) && groups.length >= 2, `scene job ${sceneJob} must have fallback group priorities`, failures);
    for (const group of groups) {
      expect(knownGroups.has(group), `scene job ${sceneJob} references unknown caption group ${group}`, failures);
    }
  }
  for (const keyword of ["Opening hook", "Quote/proof scene", "Product/workflow scene", "Data/metric scene", "Strong image", "Bilingual/interview scene"]) {
    expect(strategy.includes(keyword), `creative subtitle strategy must document ${keyword}`, failures);
  }
  expect(/Timecode fidelity/.test(strategy) && /never creates new TTS cuts/.test(strategy), "strategy must preserve timecode fidelity", failures);
  expect(/Forbidden subtitle motion/.test(strategy) && /simultaneous line stacks/.test(strategy), "strategy must reject unsafe motion and stacked lines", failures);
  expect(/captionStylePlanPresent/.test(subtitleDesign) && /captionStylePlanEnforced/.test(subtitleDesign), "subtitle design QC must require plan presence and enforcement", failures);
  expect(/class="caption-cue"[^`]+class="caption-cue-text"/s.test(workflowSource), "caption renderer must wrap emphasized cue text in an inline caption-cue-text layer", failures);
  expect(/\.caption-cue\s*\{[^}]*animation-fill-mode:\s*none;/s.test(workflowSource), "caption cue animation must not use fill-mode that leaves first-frame text transparent", failures);
  expect(/@keyframes captionCue\s*\{\s*0%,\s*88%\s*\{\s*opacity:\s*1;/s.test(workflowSource), "caption cue keyframes must render text visible at the start of each cue", failures);
}

function markdownReport(report) {
  const lines = [
    "# Caption Strategy Routing Self-Test",
    "",
    `Status: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    "## What Was Tested",
    "",
    "- Scene state to subtitle job routing: hook, vertical short, product demo, data proof, image-first, bilingual/interview, voice, quote, and documentary.",
    "- Condition collisions: vertical product/data scenes must not be blindly routed to mobile captions; writing-method opening hooks must not be swallowed by documentary/editorial defaults.",
    "- Strategy correctness: catalog priorities, fallback groups, one-line display, visual-only keyword emphasis, and reduced-motion/readability contracts.",
    "",
    "## Results",
    "",
  ];
  for (const result of report.cases) {
    lines.push(`### ${result.id}`, "");
    for (const scene of result.scenes) {
      lines.push(`- ${scene.sceneId}: ${scene.actualSceneJob} -> ${scene.actualGroup}/${scene.selectedStyleId}; expected ${scene.expectedSceneJob} -> ${scene.expectedGroups.join(" or ")}.`);
    }
    lines.push("");
  }
  if (report.failures.length) {
    lines.push("## Failures", "");
    for (const failure of report.failures) lines.push(`- ${failure}`);
    lines.push("");
  }
  lines.push("## Evidence", "");
  for (const result of report.cases) {
    lines.push(`- ${result.id}: ${relative(workspace, result.captionPlanPath)}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  mkdirSync(briefsDir, { recursive: true });
  const failures = [];
  staticStrategyAssertions(failures);

  const testCases = [
    {
      id: "horizontal-semantic-matrix",
      brief: {
        title: "字幕策略横版语义矩阵",
        language: "zh",
        audience: "视频创作者",
        objective: "验证不同语义场景触发不同高级字幕类型",
        platform: "local-review-horizontal",
        aspectRatio: "16:9",
        durationSeconds: 56,
        videoType: "professional-explainer",
        imageSource: "image2-dryrun",
        scenes: [
          { id: "hook", label: "开场钩子", headline: ["为什么", "前三秒", "划走"], body: "反差开场", subtitle: "为什么观众总在前三秒划走？因为普通字幕只解释，高级字幕会组织注意力。" },
          { id: "product", label: "产品流程", headline: ["状态", "改变"], body: "按钮和状态反馈", subtitle: "点击发布后，状态必须从草稿变成已发布。", productSurface: { name: "Publish console" } },
          { id: "data", label: "数据证明", headline: ["18%", "24%"], body: "指标对照", subtitle: "完播率提升 18%，阅读阻力下降 24%。", chartData: [{ label: "completion", value: 18 }] },
          { id: "image", label: "强画面素材", headline: ["画面", "先说话"], body: "素材优先", subtitle: "画面已经说明现场，字幕只补充一句。", rawFootage: "authorized-local-broll.mp4" },
          { id: "bilingual", label: "双语翻译", headline: ["主字幕", "辅助翻译"], body: "English support line only", subtitle: "主字幕保持中文，English line only supports context." },
          { id: "voice", label: "播客旁白", headline: ["声音", "身份"], body: "保留声音身份", subtitle: "这段旁白保留声音身份，不需要强视觉抢戏。" },
          { id: "quote", label: "引用金句", headline: ["Quote"], body: "观点引用", subtitle: "“高级字幕不是装饰，是注意力的调度。”" }
        ],
        narration: "为什么观众总在前三秒划走？因为普通字幕只解释，高级字幕会组织注意力。点击发布后，状态必须从草稿变成已发布。完播率提升 18%，阅读阻力下降 24%。画面已经说明现场，字幕只补充一句。主字幕保持中文，English line only supports context. 这段旁白保留声音身份，不需要强视觉抢戏。“高级字幕不是装饰，是注意力的调度。”"
      },
      expectations: [
        { sceneId: "hook", sceneJob: "hook", groups: ["kinetic"], semanticAny: ["question"], requireEmphasis: true },
        { sceneId: "product", sceneJob: "productDemo", groups: ["ui"], semanticAny: ["spoken-caption", "step"], requireEmphasis: true },
        { sceneId: "data", sceneJob: "dataProof", groups: ["ui", "editorial"], semanticAny: ["metric"], requireEmphasis: true },
        { sceneId: "image", sceneJob: "imageFirst", groups: ["minimal"], requireEmphasis: true },
        { sceneId: "bilingual", sceneJob: "bilingual", groups: ["bilingual"], semanticAny: ["translation", "spoken-caption"], requireEmphasis: true },
        { sceneId: "voice", sceneJob: "voiceOrInterview", groups: ["audio"], requireEmphasis: true },
        { sceneId: "quote", sceneJob: "quote", groups: ["editorial", "glass"], semanticAny: ["quote"], requireEmphasis: true }
      ],
    },
    {
      id: "vertical-collision-matrix",
      brief: {
        title: "竖屏字幕触发冲突验证",
        language: "zh",
        audience: "短视频创作者",
        objective: "验证竖屏安全区不会吞掉产品、数据和素材语义",
        platform: "douyin",
        aspectRatio: "9:16",
        durationSeconds: 36,
        videoType: "short-form-explainer",
        imageSource: "image2-dryrun",
        scenes: [
          { id: "vertical-opening", label: "竖屏开场承诺", headline: ["第一秒", "先给承诺"], body: "移动端安全区", subtitle: "第一秒先给承诺，字幕要进入移动端安全区。" },
          { id: "vertical-generic", label: "竖屏普通口播", headline: ["阅读", "安全"], body: "移动端安全区", subtitle: "这一句只是移动端口播说明，不是数据、产品或素材说明。" },
          { id: "vertical-product", label: "竖屏产品演示", headline: ["按钮", "状态"], body: "App demo", subtitle: "点下生成按钮后，界面状态从等待变成完成。", productSurface: { name: "Mobile app" } },
          { id: "vertical-data", label: "竖屏数据证明", headline: ["42%", "留存"], body: "指标", subtitle: "留存率提升 42%，但字幕只强调关键数字。", chartData: [{ label: "retention", value: 42 }] },
          { id: "vertical-image", label: "竖屏强画面", headline: ["实拍", "现场"], body: "素材优先", subtitle: "实拍画面是主角，字幕必须降低遮挡。", sourceVideo: "authorized-vertical-shot.mp4" }
        ],
        narration: "第一秒先给承诺，字幕要进入移动端安全区。这一句只是移动端口播说明，不是数据、产品或素材说明。点下生成按钮后，界面状态从等待变成完成。留存率提升 42%，但字幕只强调关键数字。实拍画面是主角，字幕必须降低遮挡。"
      },
      expectations: [
        { sceneId: "vertical-opening", sceneJob: "hook", groups: ["mobile"], verticalSafeArea: true, requireEmphasis: true },
        { sceneId: "vertical-generic", sceneJob: "verticalShort", groups: ["mobile"], verticalSafeArea: true, requireEmphasis: true },
        { sceneId: "vertical-product", sceneJob: "productDemo", groups: ["ui"], rejectGroups: ["mobile"], verticalSafeArea: true, requireEmphasis: true },
        { sceneId: "vertical-data", sceneJob: "dataProof", groups: ["ui", "editorial"], rejectGroups: ["mobile"], semanticAny: ["metric"], verticalSafeArea: true, requireEmphasis: true },
        { sceneId: "vertical-image", sceneJob: "imageFirst", groups: ["minimal"], rejectGroups: ["mobile"], verticalSafeArea: true, requireEmphasis: true }
      ],
    },
    {
      id: "writing-hook-regression",
      brief: {
        title: "爆款小说字幕策略回归",
        language: "zh",
        audience: "写作者",
        objective: "验证 writing-method 里开场钩子不会被纪录/写作类型默认值覆盖",
        platform: "local-review-horizontal",
        aspectRatio: "16:9",
        durationSeconds: 30,
        videoType: "writing-method",
        imageSource: "image2-dryrun",
        scenes: [
          { id: "writing-hook", label: "开场钩子", headline: ["为什么", "读者", "往下滑"], body: "先给异常", subtitle: "为什么读者会往下滑？因为第一秒先给异常，不先解释设定。" },
          { id: "story-craft", label: "故事拆解", headline: ["欲望", "阻碍", "倒计时"], body: "故事结构", subtitle: "故事段落适合克制的编辑部字幕，承接写作语境。" },
          { id: "writing-quote", label: "写作金句", headline: ["下一秒"], body: "引用", subtitle: "“读者买的不是解释，是下一秒。”" }
        ],
        narration: "为什么读者会往下滑？因为第一秒先给异常，不先解释设定。故事段落适合克制的编辑部字幕，承接写作语境。“读者买的不是解释，是下一秒。”"
      },
      expectations: [
        { sceneId: "writing-hook", sceneJob: "hook", groups: ["kinetic"], semanticAny: ["question"], requireEmphasis: true },
        { sceneId: "story-craft", sceneJob: "documentary", groups: ["editorial", "minimal"], requireEmphasis: true },
        { sceneId: "writing-quote", sceneJob: "quote", groups: ["editorial", "glass"], semanticAny: ["quote"], requireEmphasis: true }
      ],
    }
  ];

  const caseReports = [];
  for (const testCase of testCases) {
    try {
      const result = runWorkflowCase(testCase);
      const sceneReports = testCase.expectations.map((expectation) => assertScene(result, expectation, failures)).filter(Boolean);
      expect(result.captionPlan.catalogReference === "assets/caption-style-catalog.json", `${testCase.id}: caption plan must reference catalog`, failures);
      expect(result.captionPlan.autoSubtitle?.enabledByDefault === true, `${testCase.id}: auto subtitle must be enabled by default`, failures);
      expect(result.captionPlan.autoSubtitle?.validation === "scripts/validate-caption-strategy-routing.mjs", `${testCase.id}: auto subtitle must record planner validation route`, failures);
      expect(result.captionPlan.keywordHighlight?.enabledByDefault === true, `${testCase.id}: keyword highlight must be enabled by default`, failures);
      expect((result.captionPlan.keywordHighlight?.defaultTreatments || []).includes("highlightBackground"), `${testCase.id}: keyword highlight must support highlight background`, failures);
      expect((result.captionPlan.styleCatalog || []).length >= 68, `${testCase.id}: caption plan must expose the 68-style catalog`, failures);
      expect((result.designPlan.pages || []).every((page) => page.captionStyle?.selectedStyleId), `${testCase.id}: design plan pages must carry selected caption style`, failures);
      caseReports.push({
        id: testCase.id,
        out: result.out,
        captionPlanPath: result.captionPlanPath,
        designPlanPath: result.designPlanPath,
        scenes: sceneReports,
      });
    } catch (error) {
      failures.push(`${testCase.id}: workflow execution failed: ${error.message}`);
    }
  }

  const report = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    purpose: "Validate state/scene to creative caption routing and test the strategy against collision cases.",
    cases: caseReports,
    failures,
  };
  writeJson(join(outRoot, "caption-strategy-routing-report.json"), report);
  writeFileSync(join(outRoot, "caption-strategy-routing-report.md"), markdownReport(report));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
