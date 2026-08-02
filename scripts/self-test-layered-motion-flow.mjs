#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { loadPlaywright } from "./lib/load-playwright.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const output = resolve(process.argv[2] || join(root, "research", "layered-motion-flow-self-test"));
const { chromium } = loadPlaywright();

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const result = spawnSync("node", [
  join(root, "scripts", "poc-video-workflow.mjs"),
  "--brief", join(root, "assets", "examples", "layered-semantic-motion-brief.json"),
  "--out", output,
  "--cover-only",
  "--image-source", "image2-dryrun",
  "--no-open-delivery-page"
], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

assert.equal(result.status, 0, result.stderr || result.stdout);

const planPath = join(output, "workflow", "layered-motion-plan.json");
const configPath = join(output, "workflow", "semi-auto-config.json");
const htmlPath = join(output, "semi-auto-config.html");
assert.ok(existsSync(planPath), "layered motion plan is missing");
assert.ok(existsSync(configPath), "semi-auto config model is missing");
assert.ok(existsSync(htmlPath), "semi-auto config HTML is missing");

const plan = JSON.parse(readFileSync(planPath, "utf8"));
const config = JSON.parse(readFileSync(configPath, "utf8"));
assert.equal(plan.status, "active");
assert.equal(plan.mode, "semantic-path");
assert.equal(plan.trigger.source, "brief.layeredMotion");
assert.equal(plan.personalIpPolicy, "preserve-native-page-as-immutable-base");
assert.ok(plan.scenePlans.some((scene) => scene.sceneId === "upgrade-route" && scene.active));
assert.ok(plan.zBands.motion < plan.zBands.content);
assert.ok(plan.zBands.content < plan.zBands.subtitle);
assert.equal(config.layeredMotion.mode, "semantic-path");
assert.equal(config.layeredMotion.active, true);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(3400);
const audit = await page.evaluate(() => {
  const preview = document.querySelector("[data-layered-motion-preview]");
  const stage = preview?.querySelector(".layered-preview-stage");
  const line = preview?.querySelector(".layered-preview-line");
  const cards = [...(preview?.querySelectorAll(".layered-preview-card") || [])];
  const stageRect = stage?.getBoundingClientRect();
  const clippedCards = stageRect ? cards.filter((card) => {
    const rect = card.getBoundingClientRect();
    return rect.left < stageRect.left || rect.right > stageRect.right || rect.top < stageRect.top || rect.bottom > stageRect.bottom;
  }).length : cards.length;
  return {
    previewExists: Boolean(preview),
    lineExists: Boolean(line),
    cardCount: cards.length,
    lineZ: line ? Number(getComputedStyle(line).zIndex) || 0 : null,
    minCardZ: cards.length ? Math.min(...cards.map((card) => Number(getComputedStyle(card).zIndex) || 0)) : null,
    visibleCardCount: cards.filter((card) => Number(getComputedStyle(card).opacity) > 0.99).length,
    clippedCards,
    animationIterations: [...new Set(cards.map((card) => getComputedStyle(card).animationIterationCount))],
    title: preview?.querySelector("strong")?.textContent || ""
  };
});
await page.screenshot({ path: join(output, "layered-motion-config-preview.png"), fullPage: true });
await page.locator("[data-layered-motion-preview]").screenshot({ path: join(output, "layered-motion-preview.png") });
await browser.close();

assert.equal(audit.previewExists, true);
assert.equal(audit.lineExists, true);
assert.ok(audit.cardCount >= 4);
assert.equal(audit.visibleCardCount, audit.cardCount, "final animation state must keep every card visible");
assert.equal(audit.clippedCards, 0, "layered preview contains clipped cards");
assert.deepEqual(audit.animationIterations, ["1"], "content reveal must settle instead of looping and hiding content again");
assert.ok(audit.lineZ < audit.minCardZ, "animated path may cover content cards");
assert.match(audit.title, /分层|路径/);

const naturalOutput = join(output, "natural-language-trigger");
const naturalBriefPath = join(output, "natural-language-brief.json");
const naturalBrief = JSON.parse(readFileSync(join(root, "assets", "examples", "layered-semantic-motion-brief.json"), "utf8"));
delete naturalBrief.layeredMotion;
naturalBrief.title = "自然语言触发分层路径动效";
naturalBrief.objective = "不要做成静态 PPT，请按层展示步骤，用动画线沿着升级路径逐步绘制。";
writeFileSync(naturalBriefPath, `${JSON.stringify(naturalBrief, null, 2)}\n`);
const naturalResult = spawnSync("node", [
  join(root, "scripts", "poc-video-workflow.mjs"),
  "--brief", naturalBriefPath,
  "--out", naturalOutput,
  "--cover-only",
  "--image-source", "image2-dryrun",
  "--no-open-delivery-page"
], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
assert.equal(naturalResult.status, 0, naturalResult.stderr || naturalResult.stdout);
const naturalPlan = JSON.parse(readFileSync(join(naturalOutput, "workflow", "layered-motion-plan.json"), "utf8"));
assert.equal(naturalPlan.status, "active");
assert.equal(naturalPlan.mode, "semantic-path");
assert.equal(naturalPlan.trigger.source, "natural-language-signal");

console.log(JSON.stringify({
  pass: true,
  output,
  plan: planPath,
  config: configPath,
  html: htmlPath,
  screenshot: join(output, "layered-motion-config-preview.png"),
  previewScreenshot: join(output, "layered-motion-preview.png"),
  audit,
  naturalLanguageTrigger: {
    output: naturalOutput,
    status: naturalPlan.status,
    mode: naturalPlan.mode,
    source: naturalPlan.trigger.source
  }
}, null, 2));
