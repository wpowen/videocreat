#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildPresentationRouteLock } from "./lib/presentation-route-lock.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv[2] || join(root, "research", "personal-ip-route-and-continuation-self-test"));

const plainBrief = {
  title: "个人 IP 横屏口播",
  objective: "用女性个人 IP 原生图解页讲清三个步骤。",
  visualMode: "个人 IP",
  primaryVisualSystem: "ip-diagram-creator",
  personalIp: { enabled: true, name: "通用女性知识主讲人", allowGenericFallback: true },
  personalIpAnimation: "off",
};
const plainLock = buildPresentationRouteLock({ brief: plainBrief });
assert.equal(plainLock.pass, true);
assert.equal(plainLock.resolvedRouteId, "personal-ip-native-final-pages");

const unauthorizedSemantic = buildPresentationRouteLock({
  brief: {
    ...plainBrief,
    visualMode: "个人 IP + 动画",
    personalIpAnimation: "semantic-layers",
  },
});
assert.equal(unauthorizedSemantic.pass, false);
assert.ok(unauthorizedSemantic.violations.includes("personal-ip-semantic-route-not-user-authorized"));

const unauthorizedEscalationRetry = buildPresentationRouteLock({
  brief: {
    ...plainBrief,
    visualMode: "个人 IP + 动画",
    personalIpAnimation: "semantic-layers",
  },
  previous: plainLock,
});
assert.equal(unauthorizedEscalationRetry.pass, false);
assert.equal(unauthorizedEscalationRetry.resolvedRouteId, "personal-ip-native-final-pages");
assert.ok(unauthorizedEscalationRetry.violations.includes("presentation-route-change-not-user-authorized"));

const authorizedSemantic = buildPresentationRouteLock({
  brief: {
    ...plainBrief,
    visualMode: "个人 IP + 动画",
    personalIpAnimation: "semantic-layers",
    personalIpAnimationAuthorization: {
      authorizedByUser: true,
      mode: "semantic-layers",
      source: "用户明确要求：请生成个人 IP + 动画横屏视频。",
    },
  },
});
assert.equal(authorizedSemantic.pass, true);
assert.equal(authorizedSemantic.resolvedRouteId, "personal-ip-semantic-layers-svg-html-video");

const unauthorizedRetryMutation = buildPresentationRouteLock({
  brief: plainBrief,
  previous: authorizedSemantic,
});
assert.equal(unauthorizedRetryMutation.pass, false);
assert.equal(unauthorizedRetryMutation.resolvedRouteId, "personal-ip-semantic-layers-svg-html-video");
assert.ok(unauthorizedRetryMutation.violations.includes("presentation-route-change-not-user-authorized"));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const briefPath = join(out, "fixture-brief.json");
writeFileSync(briefPath, `${JSON.stringify({
  ...plainBrief,
  language: "zh-CN",
  platform: "local-review",
  aspectRatio: "16:9",
  durationSeconds: 8,
  generationMode: "full-auto",
  audioGender: "female",
  scenes: [
    { id: "step-1", label: "第一步", headline: ["先听见表层问题"], body: "记录角色嘴上说了什么。", subtitle: "第一步，先听见表层问题。" },
    { id: "step-2", label: "第二步", headline: ["再识别关系诉求"], body: "找到角色真正想确认的位置。", subtitle: "第二步，再识别关系诉求。" },
    { id: "step-3", label: "第三步", headline: ["最后改变场景"], body: "让回答改变关系与行动。", subtitle: "第三步，让回答改变场景。" },
  ],
  narration: "第一步，先听见表层问题。第二步，再识别关系诉求。第三步，让回答改变场景。",
  rights: {
    text: "original self-test",
    visuals: "pending Context Image2 generation",
    voice: "not reached before native-page gate",
    music: "none",
    externalMedia: "none",
  },
}, null, 2)}\n`, "utf8");

const result = spawnSync(process.execPath, [
  join(root, "scripts", "poc-video-workflow.mjs"),
  "--brief", briefPath,
  "--out", out,
  "--generation-mode", "full-auto",
  "--image-source", "image2-dryrun",
  "--scene-image-policy", "off",
  "--free-stock-policy", "off",
  "--no-open-output",
], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

assert.notEqual(result.status, 0, "missing native pages must stop before audio/render");
assert.match(`${result.stdout}\n${result.stderr}`, /Personal-IP native-final route blocked at pre-cover-full-render/);
const readJson = (relativePath) => JSON.parse(readFileSync(join(out, relativePath), "utf8"));
const routeLock = readJson("workflow/presentation-route-lock.json");
assert.equal(routeLock.resolvedRouteId, "personal-ip-native-final-pages");
assert.equal(routeLock.pass, true);

const nativeRequests = readJson("workflow/context-image2-persona-page-requests.json");
assert.ok(nativeRequests.requests.length >= 4, "native page gate must prepare the complete Context Image2 request set");
assert.ok(nativeRequests.requests.every((request) => request.provider === "codex-context-image2" && request.tool === "image_gen"));

const coverRequests = readJson("workflow/context-image2-cover-requests.json");
const coverDispatch = readJson("workflow/cover-image2-dispatch-plan.json");
assert.equal(coverDispatch.jobs.length, coverRequests.pendingRequestCount);
assert.equal(coverDispatch.jobs.length, coverRequests.requests.length);

const coverLane = readJson("workflow/cover-parallel-execution.json");
assert.equal(coverLane.status, "generation-required");
assert.equal(coverLane.planningComplete, true);
assert.equal(coverLane.coversVerified, false);

const continuation = readJson("workflow/full-auto-continuation.json");
assert.equal(continuation.status, "agent-action-required");
assert.equal(continuation.terminalForUser, false);
assert.equal(continuation.routeMutationForbidden, true);
assert.deepEqual(continuation.pendingLanes.map((lane) => lane.id).sort(), ["personal-ip-native-pages", "platform-covers"]);
assert.ok(!existsSync(join(out, "renders", "final.mp4")), "gate must stop before expensive render");
assert.ok(!existsSync(join(out, "workflow", "voice-subtitle-manifest.json")), "gate must stop before TTS/audio generation");

console.log(JSON.stringify({
  pass: true,
  route: routeLock.resolvedRouteId,
  nativePageJobs: nativeRequests.requests.length,
  coverJobs: coverDispatch.jobs.length,
  continuation: continuation.status,
  out,
}, null, 2));
