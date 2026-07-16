#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = skillRoot;
const workflowScript = join(skillRoot, "scripts", "poc-video-workflow.mjs");

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function brief() {
  return {
    title: "Generation mode default regression",
    language: "zh",
    audience: "workflow verifier",
    objective: "验证用户未明确选择半自动时，视频工作流默认继续全自动流程。",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 18,
    videoType: "professional-explainer",
    imageSource: "image2-dryrun",
    rights: {
      text: "local self-test brief",
      visuals: "local deterministic HTML/SVG",
      voice: "not rendered in cover-only test",
      music: "none",
      externalMedia: "none",
    },
    scenes: [
      { id: "hook", label: "Hook", headline: ["No semi-auto request", "Use full-auto"], body: "Missing mode must not stop at configuration.", subtitle: "未明确半自动，就继续全自动。", palette: "blue" },
      { id: "proof", label: "Proof", headline: ["Explicit only", "Semi-auto"], body: "Only explicit semi-auto requests may stop for configuration.", subtitle: "只有明确半自动，才进入配置页。", palette: "gold" },
      { id: "close", label: "Close", headline: ["One command", "Final delivery"], body: "The default path remains the end-to-end generation workflow.", subtitle: "默认路径保持一键生成。", palette: "green" },
    ],
    narration: "未明确半自动，就继续全自动。只有明确半自动，才进入配置页。默认路径保持一键生成。",
  };
}

function runCase({ id, outRoot, mode }) {
  const caseRoot = join(outRoot, id);
  const briefPath = join(caseRoot, "brief.json");
  const out = join(caseRoot, "package");
  writeJson(briefPath, brief());
  const args = [
    workflowScript,
    "--brief", briefPath,
    "--out", out,
    "--cover-only",
    "--no-open-delivery-page",
    "--image-source", "image2-dryrun",
  ];
  if (mode) args.push("--generation-mode", mode);
  const result = spawnSync(process.execPath, args, {
    cwd: workspace,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return { id, out, result };
}

function validateImplicitFullAuto(run) {
  const failures = [];
  if (run.result.status !== 0) {
    failures.push(`implicit mode workflow failed: ${run.result.stderr || run.result.stdout}`);
    return failures;
  }
  const manifest = readJson(join(run.out, "delivery-manifest.json"));
  const contract = readJson(join(run.out, "workflow", "generation-mode-contract.json"));
  if (manifest.mode !== "cover-only") failures.push(`implicit mode stopped at ${manifest.mode}; expected cover-only proof of the full-auto branch`);
  if (manifest.generationMode !== "full-auto") failures.push(`implicit generationMode=${manifest.generationMode}; expected full-auto`);
  if (contract.selectedMode !== "full-auto") failures.push(`implicit selectedMode=${contract.selectedMode}; expected full-auto`);
  if (contract.defaultMode !== "full-auto") failures.push(`defaultMode=${contract.defaultMode}; expected full-auto`);
  if (contract.modeSelectionRule?.default !== "full-auto-render") failures.push(`modeSelectionRule.default=${contract.modeSelectionRule?.default}; expected full-auto-render`);
  if (contract.fullAutoContinuationPolicy?.stopAtConfiguration !== false) failures.push("full-auto continuation policy must forbid configuration stop");
  if (contract.fullAutoContinuationPolicy?.recoverablePlannerBlockersAreTerminal !== false) failures.push("recoverable full-auto planner blockers must not be terminal");
  if (!/generate and ingest every planned image_gen page/i.test(contract.fullAutoContinuationPolicy?.personalIpNativePagePolicy || "")) failures.push("full-auto continuation policy must require automatic personal-IP native page generation and ingest");
  if (existsSync(join(run.out, "semi-auto-config.html"))) failures.push("implicit mode unexpectedly generated semi-auto-config.html");
  return failures;
}

function validateExplicitSemiAuto(run) {
  const failures = [];
  if (run.result.status !== 0) {
    failures.push(`explicit semi-auto workflow failed: ${run.result.stderr || run.result.stdout}`);
    return failures;
  }
  const manifest = readJson(join(run.out, "delivery-manifest.json"));
  const contract = readJson(join(run.out, "workflow", "generation-mode-contract.json"));
  if (manifest.mode !== "semi-auto-config") failures.push(`explicit semi-auto mode=${manifest.mode}; expected semi-auto-config`);
  if (manifest.generationMode !== "semi-auto") failures.push(`explicit semi-auto generationMode=${manifest.generationMode}; expected semi-auto`);
  if (contract.selectedMode !== "semi-auto") failures.push(`explicit semi-auto selectedMode=${contract.selectedMode}; expected semi-auto`);
  if (!existsSync(join(run.out, "semi-auto-config.html"))) failures.push("explicit semi-auto did not generate semi-auto-config.html");
  return failures;
}

function main() {
  const outRoot = resolve(process.argv[2] || join(skillRoot, "research", "codex-video-workflow-poc", "generation-mode-default-self-test"));
  rmSync(outRoot, { recursive: true, force: true });
  ensureDir(outRoot);
  const implicit = runCase({ id: "implicit-full-auto", outRoot });
  const explicitSemi = runCase({ id: "explicit-semi-auto", outRoot, mode: "semi-auto" });
  const rows = [
    { id: implicit.id, failures: validateImplicitFullAuto(implicit) },
    { id: explicitSemi.id, failures: validateExplicitSemiAuto(explicitSemi) },
  ].map((row) => ({ ...row, ok: row.failures.length === 0 }));
  const report = { ok: rows.every((row) => row.ok), rows, outRoot };
  writeJson(join(outRoot, "report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
