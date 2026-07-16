#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadPlaywright } from "./load-playwright.mjs";

const { chromium } = loadPlaywright();

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || !argv[index + 1]) throw new Error(`Invalid argument near ${key}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = argv[index + 1];
    index += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const htmlPath = resolve(args.html);
const config = JSON.parse(readFileSync(resolve(args.config), "utf8"));
const width = Number(config.width);
const height = Number(config.height);
const totalDuration = Math.max(0.001, Number(config.totalDuration || config.frames?.at(-1)?.end || 0));
const framesDir = resolve(config.framesDir);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);
  const awaitImageDecode = async () => {
    await page.waitForFunction(() => {
      const image = document.querySelector("#native-page");
      return image?.complete === true && Number(image.naturalWidth || 0) > 0;
    });
    await page.evaluate(async () => {
      const image = document.querySelector("#native-page");
      if (image?.decode) await image.decode();
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    });
  };
  await awaitImageDecode();
  for (const frame of config.frames || []) {
    const progress = Math.max(0, Math.min(1, Number(frame.start || 0) / totalDuration));
    await page.evaluate((value) => window.motion.setProgress(value), progress);
    await awaitImageDecode();
    await page.screenshot({
      path: resolve(framesDir, `${frame.id}.png`),
      type: "png",
      animations: "disabled",
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  renderer: "personal-ip-layered.html",
  frameCount: config.frames?.length || 0,
  width,
  height,
  framesDir,
}));
