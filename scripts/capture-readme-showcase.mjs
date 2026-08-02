#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromiumLaunchOptions, loadPlaywright } from "./lib/load-playwright.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:4173";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    out: join(ROOT, "media/showcase/core-demo"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--base-url") options.baseUrl = argv[++index].replace(/\/$/, "");
    else if (argv[index] === "--out") options.out = resolve(argv[++index]);
    else if (argv[index] === "--help") {
      console.log("Usage: node scripts/capture-readme-showcase.mjs [--base-url URL] [--out DIR]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return options;
}

async function captureSection(page, selector, outputPath) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  await locator.screenshot({ path: outputPath, animations: "disabled" });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.out, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(chromiumLaunchOptions(chromium));
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const configUrl = `${options.baseUrl}/media/showcase/core-demo/semi-auto-config.html`;
  await page.goto(configUrl, { waitUntil: "networkidle" });

  const zhSections = [
    ["#base", "config-base-zh.png"],
    ["#motion", "config-motion-all-families.png"],
    ["#color", "config-color-gallery.png"],
    ["#caption", "config-caption-gallery.png"],
    ["#materials", "config-material-routing.png"],
    ["#cover", "config-cover-workbench.png"],
    ["#voice", "config-voice-localization.png"],
    ["#page-edit", "config-page-editor.png"],
  ];
  for (const [selector, filename] of zhSections) {
    await captureSection(page, selector, join(options.out, filename));
  }

  await page.locator('[data-config-locale="en"]').click();
  await page.waitForTimeout(200);
  for (const [selector, filename] of [
    ["#base", "config-base-en.png"],
    ["#motion", "config-motion-en.png"],
    ["#caption", "config-caption-en.png"],
    ["#cover", "config-cover-en.png"],
  ]) {
    await captureSection(page, selector, join(options.out, filename));
  }

  for (const [pagePath, filename, viewport] of [
    ["motion-style-template-review.html", "motion-style-review-horizontal.png", { width: 1440, height: 960 }],
    ["vertical-motion-style-template-review.html", "motion-style-review-vertical.png", { width: 1080, height: 960 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${options.baseUrl}/media/showcase/core-demo/${pagePath}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(options.out, filename), fullPage: false, animations: "disabled" });
  }

  await browser.close();
  console.log(JSON.stringify({ outputDirectory: options.out, captured: zhSections.length + 6 }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
