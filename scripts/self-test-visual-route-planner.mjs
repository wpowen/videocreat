#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, "..");
const WORKFLOW_SCRIPT = join(SKILL_ROOT, "scripts", "poc-video-workflow.mjs");

function parseArgs(argv) {
  const args = {
    outRoot: "/tmp/codex-video-visual-route-self-test",
    keepExisting: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--out-root") args.outRoot = resolve(argv[++index]);
    else if (item === "--keep-existing") args.keepExisting = true;
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function briefFor(id, text, overrides = {}) {
  return {
    title: id,
    language: "zh",
    audience: "视觉路由自测",
    objective: text,
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 18,
    videoType: "professional-explainer",
    imageSource: "image2-dryrun",
    style: "animated-infographic",
    rights: {
      text: "original local self-test brief",
      visuals: "prompt-only planner self-test",
      voice: "not rendered in cover-only self-test",
      music: "none",
      externalMedia: "none",
    },
    scenes: [
      {
        id: "route-signal",
        label: "路由信号",
        headline: [text],
        body: text,
        subtitle: text,
        palette: "blue",
      },
      {
        id: "route-proof",
        label: "路由证据",
        headline: ["Planner", "写入证据"],
        body: "Planner 应记录命中、排除和优先级原因。",
        subtitle: "Planner 应记录可审计的路由证据。",
        palette: "teal",
      },
      {
        id: "route-close",
        label: "路由收束",
        headline: ["单一路由", "稳定收束"],
        body: "每个场景只能有一个主路由。",
        subtitle: "每个场景只能有一个主路由。",
        palette: "gold",
      },
    ],
    narration: `${text} Planner 应记录可审计的路由证据。每个场景只能有一个主路由。`,
    ...overrides,
  };
}

const SERIES_CASES = [
  ["knowledge", "为一个主体制作档案、属性盘点、评分和结构化科普卡。", "knowledge-encyclopedia-card-v1"],
  ["strategy", "这是明确的教程：按第一步、第二步、第三步执行，并附检查清单和避坑项。", "strategy-guide-board-v1"],
  ["relationship", "解释五个人物与三个阵营之间的关系，包含联盟、冲突和因果关系边。", "relationship-map-poster-v1"],
  ["collection", "制作动物图鉴，逐个介绍水豚、海獭、狐獴和羊驼，每个物种一张卡。", "collection-atlas-card-v1"],
  ["editorial", "这是视频开场 hook 和章节分隔页，要用短标题完成主题揭示。", "editorial-cover-hook-v1"],
  ["surreal", "用超现实载体制造惊奇 hook，把抽象概念变成一个视觉隐喻并用于转场。", "surreal-carrier-poster-v1"],
  ["oriental", "中国文化题材，用水墨留白表现季节流逝，作为节奏呼吸和平静收尾。", "oriental-ink-atmosphere-v1"],
  ["interface", "讲解一个 SaaS 工具的产品功能、操作界面和工作流状态，没有可用真实截图。", "interface-mockup-plate-v1"],
  ["collage", "回顾同一个产品从初版到三次迭代的演进，用多状态前后对比和时间拼贴。", "photo-collage-grid-v1"],
];

const PERSONAL_IP_CASES = [
  {
    id: "personal-ip-zh",
    brief: briefFor("personal-ip-zh", "使用我的个人 IP 形象生成白底手绘图解视频。", { personalIp: true }),
    ipActive: true,
    ipPrimary: true,
  },
  {
    id: "personal-ip-en",
    brief: briefFor("personal-ip-en", "Use my personal IP creator persona as the presenter."),
    ipActive: true,
    ipPrimary: true,
  },
  {
    id: "personal-ip-object-on",
    brief: briefFor("personal-ip-object-on", "使用已授权的主讲人角色。", { personalIp: { enabled: true, name: "方法课主讲人" } }),
    ipActive: true,
    ipPrimary: true,
  },
  {
    id: "personal-ip-string-off",
    brief: briefFor("personal-ip-string-off", "做步骤教程和避坑清单。", { personalIp: "off" }),
    ipActive: false,
    expectedSeriesId: "strategy-guide-board-v1",
  },
  {
    id: "personal-ip-object-off",
    brief: briefFor("personal-ip-object-off", "做步骤教程和避坑清单。", { personalIp: { enabled: false } }),
    ipActive: false,
    expectedSeriesId: "strategy-guide-board-v1",
  },
  {
    id: "personal-ip-negated-zh",
    brief: briefFor("personal-ip-negated-zh", "不要个人 IP，改做主体档案、属性评分和科普结构。"),
    ipActive: false,
    expectedSeriesId: "knowledge-encyclopedia-card-v1",
  },
  {
    id: "personal-ip-negated-en",
    brief: briefFor("personal-ip-negated-en", "Do not use personal IP or creator persona. Build an ordered tutorial checklist instead."),
    ipActive: false,
    expectedSeriesId: "strategy-guide-board-v1",
  },
  {
    id: "personal-ip-wins-series-conflict",
    brief: briefFor("personal-ip-wins-series-conflict", "使用我的个人 IP 形象讲解教程。", {
      personalIp: true,
      visualSeriesId: "strategy-guide-board-v1",
    }),
    ipActive: true,
    ipPrimary: true,
    routeStatus: "personal-ip-wins",
  },
];

const ROUTING_EDGE_CASES = [
  {
    id: "explicit-visual-series-id",
    brief: briefFor("explicit-visual-series-id", "按指定视觉系列构建这一组场景。", {
      visualSeriesId: "relationship-map-poster-v1",
    }),
    ipActive: false,
    expectedSeriesId: "relationship-map-poster-v1",
    expectedSelectionMode: "explicit",
  },
  {
    id: "tutorial-mode-not-personal-ip",
    brief: briefFor("tutorial-mode-not-personal-ip", "按第一步和第二步完成操作，并输出检查清单。", {
      tutorialMode: true,
    }),
    ipActive: false,
    expectedSeriesId: "strategy-guide-board-v1",
  },
];

function runCase(testCase, outRoot) {
  const caseRoot = join(outRoot, testCase.id);
  const briefPath = join(outRoot, "briefs", `${testCase.id}.json`);
  writeJson(briefPath, testCase.brief);
  const result = spawnSync("node", [
    WORKFLOW_SCRIPT,
    "--brief", briefPath,
    "--out", caseRoot,
    "--cover-only",
    "--no-open-delivery-page",
    "--image-source", "image2-dryrun",
  ], {
    cwd: SKILL_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return { caseRoot, result };
}

function validateCase(testCase, run) {
  const failures = [];
  if (run.result.status !== 0) {
    failures.push(`workflow exited ${run.result.status}: ${run.result.stderr || run.result.stdout}`);
    return failures;
  }
  const ipPlan = readJson(join(run.caseRoot, "workflow", "ip-diagram-creator-plan.json"));
  const routePlanPath = join(run.caseRoot, "workflow", "visual-series-routing-plan.json");
  if (!existsSync(routePlanPath)) {
    failures.push("missing workflow/visual-series-routing-plan.json");
    return failures;
  }
  const routePlan = readJson(routePlanPath);
  if (typeof testCase.ipActive === "boolean" && ipPlan.active !== testCase.ipActive) {
    failures.push(`expected personal IP active=${testCase.ipActive}, got ${ipPlan.active}`);
  }
  if (typeof testCase.ipPrimary === "boolean" && ipPlan.primaryPlannerRoute !== testCase.ipPrimary) {
    failures.push(`expected personal IP primary=${testCase.ipPrimary}, got ${ipPlan.primaryPlannerRoute}`);
  }
  if (testCase.expectedSeriesId) {
    const selected = (routePlan.sceneDecisions || []).find((decision) => decision.selectedSeriesId === testCase.expectedSeriesId);
    if (!selected) failures.push(`expected visual series ${testCase.expectedSeriesId}`);
    else {
      if (selected.textPolicy !== "text-safe") failures.push(`expected text-safe, got ${selected.textPolicy}`);
      if (selected.seriesStatus !== "candidate") failures.push(`expected candidate status, got ${selected.seriesStatus}`);
      if (selected.decision !== "recommend-only") failures.push(`expected recommend-only, got ${selected.decision}`);
      if (selected.autoActivated !== false) failures.push("candidate series must not auto-activate final generation");
      if (testCase.expectedSelectionMode && selected.selectionMode !== testCase.expectedSelectionMode) {
        failures.push(`expected selection mode ${testCase.expectedSelectionMode}, got ${selected.selectionMode}`);
      }
    }
  }
  if (testCase.ipActive === true) {
    const selectedSeries = (routePlan.sceneDecisions || []).filter((decision) => decision.selectedSeriesId);
    if (selectedSeries.length) failures.push(`personal IP route must suppress visual-series selection, got ${selectedSeries.map((item) => item.selectedSeriesId).join(", ")}`);
  }
  if (testCase.routeStatus && routePlan.videoDecision?.precedenceWinner !== testCase.routeStatus) {
    failures.push(`expected precedence winner ${testCase.routeStatus}, got ${routePlan.videoDecision?.precedenceWinner}`);
  }
  return failures;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/self-test-visual-route-planner.mjs [--out-root <dir>] [--keep-existing]");
    return;
  }
  if (!args.keepExisting) rmSync(args.outRoot, { recursive: true, force: true });
  mkdirSync(args.outRoot, { recursive: true });
  const cases = [
    ...SERIES_CASES.map(([id, text, expectedSeriesId]) => ({
      id: `series-${id}`,
      brief: briefFor(`series-${id}`, text),
      ipActive: false,
      expectedSeriesId,
    })),
    ...PERSONAL_IP_CASES,
    ...ROUTING_EDGE_CASES,
  ];
  const results = [];
  for (const testCase of cases) {
    const run = runCase(testCase, args.outRoot);
    const failures = validateCase(testCase, run);
    results.push({ id: testCase.id, pass: failures.length === 0, failures });
  }
  const report = {
    pass: results.every((result) => result.pass),
    caseCount: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    results,
  };
  writeJson(join(args.outRoot, "self-test-report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main();
