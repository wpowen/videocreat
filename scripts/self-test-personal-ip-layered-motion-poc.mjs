#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPlaywright } from "./lib/load-playwright.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const poc = resolve(process.argv[2] || join(root, "research", "personal-ip-layered-motion-poc-20260712"));
const html = join(poc, "index.html");
const routePath = join(poc, "workflow", "presentation-route.json");
const imagePath = join(poc, "assets", "personal-ip-native-page.png");

assert.ok(existsSync(html), "interactive HTML is missing");
assert.ok(existsSync(routePath), "presentation route artifact is missing");
assert.ok(existsSync(imagePath), "native personal-IP page is missing");
const route = JSON.parse(readFileSync(routePath, "utf8"));
assert.equal(route.preset, "personal-ip-motion");
assert.equal(route.personalIpImmutableBase, true);
assert.equal(route.subtitleTopmost, true);
assert.equal(route.motionPolicy, "semantic-foreground-only");

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
await page.waitForFunction(() => {
  const image = document.querySelector(".native-page");
  return image?.complete && image.naturalWidth > 0;
});

async function snapshot(progress) {
  await page.evaluate((value) => window.personalIpMotion.setProgress(value), progress);
  return page.evaluate(() => {
    const stage = document.querySelector("[data-personal-ip-motion-stage]");
    const image = document.querySelector(".native-page");
    const motion = document.querySelector(".semantic-motion");
    const subtitle = document.querySelector(".subtitle");
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const style = (node) => getComputedStyle(node);
    const stageRect = rect(stage);
    const imageRect = rect(image);
    const motionRect = rect(motion);
    const subtitleRect = rect(subtitle);
    return {
      stageRect,
      imageRect,
      motionRect,
      subtitleRect,
      imageTransform: style(image).transform,
      imageObjectFit: style(image).objectFit,
      imageNaturalSize: [image.naturalWidth, image.naturalHeight],
      z: {
        image: Number(style(image).zIndex),
        motion: Number(style(motion).zIndex),
        subtitle: Number(style(subtitle).zIndex)
      },
      subtitleOpacity: Number(style(subtitle).opacity),
      pathOffsets: [...document.querySelectorAll(".trace")].map((path) => Number.parseFloat(style(path).strokeDashoffset)),
      ringOpacity: [...document.querySelectorAll(".focus-ring")].map((ring) => Number(style(ring).opacity))
    };
  });
}

const start = await snapshot(0);
const middle = await snapshot(.55);
const end = await snapshot(1);

assert.ok(start.imageNaturalSize[0] > 900 && start.imageNaturalSize[1] > 1600, "native page source resolution is too small");
assert.ok(Math.abs((start.imageNaturalSize[0] / start.imageNaturalSize[1]) - (9 / 16)) < .002, "native page source is not a 9:16 page");
assert.equal(start.imageObjectFit, "cover");
assert.equal(start.imageTransform, middle.imageTransform);
assert.equal(middle.imageTransform, end.imageTransform);
for (const key of ["left", "top", "right", "bottom", "width", "height"]) {
  assert.equal(start.imageRect[key], middle.imageRect[key], `native page ${key} changed at middle progress`);
  assert.equal(middle.imageRect[key], end.imageRect[key], `native page ${key} changed at final progress`);
}
assert.ok(start.z.image < start.z.motion && start.z.motion < start.z.subtitle, "layer order is invalid");
assert.equal(end.subtitleOpacity, 1, "subtitle must be fully visible in the final state");
assert.ok(start.pathOffsets.every((value) => value >= .99), "paths should begin hidden");
assert.ok(end.pathOffsets.every((value) => value <= .01), "paths should be fully drawn in the final state");
assert.ok(middle.ringOpacity[0] > middle.ringOpacity[3], "semantic node rings should activate in reading order");
assert.ok(end.ringOpacity.every((value) => value > .3), "semantic node rings should remain subtly visible in the final state");

const inside = (outer, inner) => inner.left >= outer.left - .5 && inner.top >= outer.top - .5 && inner.right <= outer.right + .5 && inner.bottom <= outer.bottom + .5;
assert.ok(inside(end.stageRect, end.imageRect), "native page is clipped outside the stage");
assert.ok(inside(end.stageRect, end.motionRect), "semantic animation escapes the stage");
assert.ok(inside(end.stageRect, end.subtitleRect), "subtitle escapes the stage");

await page.screenshot({ path: join(poc, "personal-ip-motion-final.png"), fullPage: true });
await page.locator("[data-personal-ip-motion-stage]").screenshot({ path: join(poc, "personal-ip-motion-stage-final.png") });
await page.evaluate(() => window.personalIpMotion.setProgress(.55));
await page.locator("[data-personal-ip-motion-stage]").screenshot({ path: join(poc, "personal-ip-motion-stage-middle.png") });
await browser.close();

mkdirSync(join(poc, "logs"), { recursive: true });
const report = {
  pass: true,
  html,
  route: routePath,
  screenshots: {
    full: join(poc, "personal-ip-motion-final.png"),
    middle: join(poc, "personal-ip-motion-stage-middle.png"),
    final: join(poc, "personal-ip-motion-stage-final.png")
  },
  checks: {
    immutableNativeBase: true,
    stableBaseRect: true,
    stableBaseTransform: true,
    semanticMotionInsideStage: true,
    subtitleTopmost: true,
    finalStateComplete: true
  }
};
writeFileSync(join(poc, "logs", "personal-ip-layered-motion-qc.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
