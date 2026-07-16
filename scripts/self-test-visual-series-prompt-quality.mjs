#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PLANNER = join(ROOT, "plan-image2-series-pages.mjs");
const SERIES = [
  ["knowledge-encyclopedia-card-v1", "build-knowledge-encyclopedia"],
  ["strategy-guide-board-v1", "build-strategy-guide"],
  ["relationship-map-poster-v1", "build-relationship-map"],
  ["collection-atlas-card-v1", "build-collection-atlas"],
  ["editorial-cover-hook-v1", "build-editorial-hook"],
  ["surreal-carrier-poster-v1", "build-surreal-carrier"],
  ["oriental-ink-atmosphere-v1", "build-oriental-ink"],
  ["interface-mockup-plate-v1", "build-interface-plate"],
  ["photo-collage-grid-v1", "build-progression-collage"],
];
const requiredSections = ["OUTPUT INTENT", "CONTENT CONTRACT", "SPATIAL MAP AND READING ORDER", "SERIES STYLE LOCK", "PHYSICAL VISUAL SYSTEM", "EXACT TEXT WHITELIST", "REJECT", "FINAL QC"];
const root = mkdtempSync(join(tmpdir(), "visual-series-prompt-quality-"));
const failures = [];
const layoutFamilies = new Set();

try {
  for (const [seriesId, skillId] of SERIES) {
    const out = join(root, seriesId);
    const run = spawnSync(process.execPath, [PLANNER,
      "--series", seriesId,
      "--out", out,
      "--topic", `结构化测试：${seriesId}`,
      "--content", "一个明确主题。一个关键机制。一个验证结论。",
      "--aspect", "16:9",
      "--text-policy", "text-safe",
      "--allow-single-image", "true",
      "--min-image-count", "1",
      "--target-image-count", "1",
    ], { encoding: "utf8" });
    if (run.status !== 0) {
      failures.push(`${seriesId}: planner failed: ${run.stderr || run.stdout}`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(join(out, "workflow", "image2-series-manifest.json"), "utf8"));
    const qc = JSON.parse(readFileSync(join(out, "workflow", "image2-series-qc.json"), "utf8"));
    const prompt = readFileSync(join(out, "prompts", `${seriesId}-pages`, "page-01-prompt.txt"), "utf8");
    if (!qc.pass) failures.push(`${seriesId}: QC failed`);
    if (manifest.leafSkill?.skillId !== skillId) failures.push(`${seriesId}: wrong leaf skill ${manifest.leafSkill?.skillId}`);
    for (const section of requiredSections) if (!prompt.includes(section)) failures.push(`${seriesId}: missing ${section}`);
    if (!prompt.includes("independent-visual-series-structured-contract-v2")) failures.push(`${seriesId}: prompt method missing`);
    if (!prompt.includes(`Leaf Skill: ${skillId}`)) failures.push(`${seriesId}: leaf skill not recorded`);
    if (/\{[^}\n]+\}/.test(prompt)) failures.push(`${seriesId}: unresolved placeholder`);
    const layout = prompt.match(/Layout family: ([^\n]+)/)?.[1];
    if (!layout) failures.push(`${seriesId}: layout family missing`);
    else layoutFamilies.add(layout);
  }
  if (layoutFamilies.size < 8) failures.push(`layout isolation too weak: expected at least 8 distinct first-page families, got ${layoutFamilies.size}`);
  console.log(JSON.stringify({ pass: failures.length === 0, seriesCount: SERIES.length, distinctLayoutFamilies: layoutFamilies.size, failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} finally {
  rmSync(root, { recursive: true, force: true });
}
