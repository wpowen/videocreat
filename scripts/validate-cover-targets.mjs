#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const outDir = join(workspace, "research/codex-video-workflow-poc/cover-target-validation");

function read(relativePath) {
  return readFileSync(join(skillRoot, relativePath), "utf8");
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const failures = [];
  const script = read("scripts/poc-video-workflow.mjs");
  const skill = read("SKILL.md");
  const coverDesign = read("references/cover-design.md");
  const qualityGates = read("references/quality-gates.md");
  const readme = read("README.md");

  const requiredScriptPatterns = [
    ["video-internal cover target", /id:\s*"video-opening"[\s\S]*?usage:\s*"in-video"[\s\S]*?cover-video-opening/],
    ["YouTube 16:9 target", /id:\s*"youtube-long"[\s\S]*?ratio:\s*"16:9"[\s\S]*?cover-youtube-16x9/],
    ["Bilibili 4:3 target", /id:\s*"bilibili-4x3"[\s\S]*?ratio:\s*"4:3"[\s\S]*?cover-bilibili-4x3/],
    ["Bilibili 16:9 safe target", /id:\s*"bilibili-16x9-safe"[\s\S]*?ratio:\s*"16:9"[\s\S]*?cover-bilibili-16x9-safe/],
    ["Douyin TikTok 9:16 target", /id:\s*"douyin-tiktok-vertical"[\s\S]*?ratio:\s*"9:16"[\s\S]*?cover-douyin-tiktok-9x16/],
    ["X video-match target", /id:\s*"x-video-match"[\s\S]*?usage:\s*"standalone-upload-video-match"/],
    ["X square target", /id:\s*"x-square-feed"[\s\S]*?ratio:\s*"1:1"[\s\S]*?cover-x-square/],
    ["cover click logic fields", /viewerDecision[\s\S]*?curiosityGap[\s\S]*?hookText[\s\S]*?payoffText/],
    ["video ratio QC", /videoInternalCover\.ratio\s*===\s*aspectRatio\(1920,\s*1080\)/],
    ["cover-only CLI mode", /args\["cover-only"\][\s\S]*?mode:\s*"cover-only"[\s\S]*?standaloneCovers/],
  ];
  for (const [label, pattern] of requiredScriptPatterns) {
    expect(pattern.test(script), `script missing ${label}`, failures);
  }

  expect(!/YouTube \/ Bilibili 16:9/.test(script), "visible platform/spec labels must not be rendered into cover SVG", failures);
  expect(/Bilibili `4:3`/.test(skill), "SKILL.md must require Bilibili 4:3 standalone cover", failures);
  expect(/--cover-only/.test(skill), "SKILL.md must document cover-only output mode", failures);
  expect(/video-internal opening cover/.test(skill), "SKILL.md must separate video-internal cover from platform crops", failures);
  expect(/Bilibili \| 4:3 standalone cover/.test(coverDesign), "cover-design.md must document Bilibili 4:3 platform logic", failures);
  expect(/Video opening frame \| Match final MP4 ratio/.test(coverDesign), "cover-design.md must document video opening cover ratio", failures);
  expect(/Bilibili `4:3`/.test(qualityGates), "quality-gates.md must require Bilibili 4:3 output", failures);
  expect(/cover-bilibili-4x3\.svg/.test(readme), "README must list Bilibili 4:3 cover output", failures);
  expect(/--cover-only/.test(readme), "README must document cover-only CLI usage", failures);

  mkdirSync(outDir, { recursive: true });
  const report = {
    ok: failures.length === 0,
    requiredTargets: [
      "cover-video-opening-16x9.svg",
      "cover-youtube-16x9.svg",
      "cover-bilibili-4x3.svg",
      "cover-bilibili-16x9-safe.svg",
      "cover-douyin-tiktok-9x16.svg",
      "cover-x-video-match-16x9.svg",
      "cover-x-square.svg",
    ],
    policy: {
      standaloneCoversArePlatformSpecific: true,
      videoInternalCoverMatchesMp4Ratio: true,
      coverMustExposeClickLogic: true,
      visiblePlatformLabelsRejected: true,
      coverOnlyModeRequired: true,
    },
    checkedFiles: [
      "scripts/poc-video-workflow.mjs",
      "SKILL.md",
      "references/cover-design.md",
      "references/quality-gates.md",
      "README.md",
    ],
    failures,
  };
  writeFileSync(join(outDir, "cover-target-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
