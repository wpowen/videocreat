#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, "..");
const out = path.join(skillRoot, "research", "character-choice-cover-routing-self-test");
const briefPath = path.join(out, "brief.json");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(briefPath, JSON.stringify({
  title: "小说实践：让你小说人物活起来",
  language: "zh",
  platform: "local-review-horizontal",
  generationMode: "full-auto",
  narration: "人物不是资料卡。欲望让他行动，误信念让他连续做出错误选择，对手再用资源实施反制。",
  scenes: [
    {
      id: "character-choice-system-01",
      label: "人物欲望与误信念",
      headline: ["欲望推动行动", "误信念逼出选择"],
      body: "欲望、目标、需要、误信念",
      subtitle: "七张表建立人物选择系统。",
      narration: "人物越想保护一样东西，越可能用错误方法亲手把它推远。",
    },
    {
      id: "character-choice-system-02",
      label: "人物欲望与目标",
      headline: ["先写想要什么", "再写失去什么"],
      body: "欲望推动人物主动行动",
      subtitle: "目标必须落到可执行的当下行动。",
      narration: "人物先要有当下最想得到的东西，以及得不到就会失去的代价。",
    },
    {
      id: "character-choice-system-03",
      label: "误信念与选择",
      headline: ["错误理解世界", "连续做错选择"],
      body: "误信念制造稳定的行为偏差",
      subtitle: "错误选择必须符合人物自己的逻辑。",
      narration: "误信念让人物用自己认为正确的方法，持续把事情推向更坏的方向。",
    },
  ],
}, null, 2));

const run = spawnSync(process.execPath, [
  path.join(here, "poc-video-workflow.mjs"),
  "--brief", briefPath,
  "--out", out,
  "--cover-only",
  "--generation-mode", "full-auto",
  "--image-source", "local",
  "--no-open-output",
], {
  cwd: skillRoot,
  env: { ...process.env, CODEX_VIDEO_WORKFLOW_HEADLESS: "1" },
  encoding: "utf8",
});

if (run.status !== 0) {
  throw new Error(`cover-only workflow failed\n${run.stdout}\n${run.stderr}`);
}

const requests = JSON.parse(fs.readFileSync(path.join(out, "workflow", "context-image2-cover-requests.json"), "utf8"));
const prompt = requests.requests?.[0]?.prompt || "";
for (const expected of ["人物活起来", "欲望 + 误信念 + 选择", "七张表，写出会主动犯错和反制的人物"]) {
  if (!prompt.includes(expected)) throw new Error(`missing character-choice cover copy: ${expected}`);
}
for (const forbidden of ["承诺才留人", "为什么宏大设定留不住人"]) {
  if (prompt.includes(forbidden)) throw new Error(`stale generic novel cover copy leaked: ${forbidden}`);
}

console.log("character-choice cover routing self-test passed");
