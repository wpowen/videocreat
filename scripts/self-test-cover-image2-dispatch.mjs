#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCoverImage2DispatchPlan,
  executeCoverImage2DispatchPlan,
  extractApprovedVisibleText,
} from "../skills/codex-video-cover-generation/scripts/lib/cover-image2-dispatch.mjs";
import { COVER_SKILL_PARITY_FILES, resolveStandaloneCoverSkillRoot } from "./lib/cover-skill-runtime.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(__dirname, "..");

function fail(message) {
  throw new Error(message);
}

function makeManifest({ completedTargetIds = [] } = {}) {
  const completed = new Set(completedTargetIds);
  const requests = Array.from({ length: 9 }, (_, index) => {
    const number = index + 1;
    const targetId = `cover-target-${number}`;
    return {
      targetId,
      promptTargetId: `${targetId}-image2-integrated-cover`,
      status: completed.has(targetId) ? "completed" : "pending",
      provider: "codex-context-image2",
      tool: "image_gen",
      width: 1000 + number,
      height: 600 + number,
      ratio: "16:9",
      prompt: [
        `Target ${number}`,
        "Text (verbatim):",
        `- \"主标题${number}\"`,
        `- \"副标题${number}\"`,
        `Approved text whitelist: 「主标题${number}」、「副标题${number}」.`,
      ].join("\n"),
      inputImages: [{ role: "main-anchor", path: `/tmp/anchor-${number}.png` }],
      expectedOutput: `cover/context-image2-${targetId}.png`,
      promptSha256: `prompt-${number}`,
      parallelSafe: true,
    };
  });
  return {
    schemaVersion: 1,
    requestCountContract: {
      mode: "all-planned-platform-targets",
      plannedTargetCount: 9,
      expectedRequestCount: 9,
      actualRequestCount: 9,
      requestedTargetIds: requests.map((request) => request.targetId),
      actualTargetIds: requests.map((request) => request.targetId),
      pass: true,
    },
    requests,
  };
}

async function main() {
  const runtimeRoot = mkdtempSync(join(tmpdir(), "cover-skill-runtime-"));
  try {
    const localMirror = join(runtimeRoot, "main-skill", "skills", "codex-video-cover-generation");
    const globalMirror = join(runtimeRoot, "codex-home", "skills", "codex-video-cover-generation");
    cpSync(join(workspace, "skills", "codex-video-cover-generation"), localMirror, { recursive: true });
    cpSync(localMirror, globalMirror, { recursive: true });
    const resolvedGlobal = resolveStandaloneCoverSkillRoot({
      mainSkillRoot: join(runtimeRoot, "main-skill"),
      env: { HOME: runtimeRoot, CODEX_HOME: join(runtimeRoot, "codex-home") },
    });
    if (resolvedGlobal !== globalMirror) fail(`global standalone cover Skill must own runtime execution: ${resolvedGlobal}`);
    writeFileSync(join(localMirror, COVER_SKILL_PARITY_FILES[0]), "drift\n");
    try {
      resolveStandaloneCoverSkillRoot({
        mainSkillRoot: join(runtimeRoot, "main-skill"),
        env: { HOME: runtimeRoot, CODEX_HOME: join(runtimeRoot, "codex-home") },
      });
      fail("cover Skill mirror drift was not rejected");
    } catch (error) {
      if (!/runtime drift detected/i.test(error.message)) throw error;
    }
  } finally {
    rmSync(runtimeRoot, { recursive: true, force: true });
  }

  const allPendingPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest(),
    topicDir: "/tmp/cover-topic",
    createdAt: "2026-07-15T00:00:00.000Z",
  });
  if (allPendingPlan.jobs.length !== 9) fail(`expected all 9 pending targets, got ${allPendingPlan.jobs.length}`);
  if (allPendingPlan.concurrency !== 9) fail(`expected one-wave concurrency 9, got ${allPendingPlan.concurrency}`);
  if (allPendingPlan.pendingTargetCount !== 9 || allPendingPlan.plannedTargetCount !== 9) {
    fail(`dispatch count contract is incomplete: ${JSON.stringify(allPendingPlan, null, 2)}`);
  }
  if (new Set(allPendingPlan.jobs.map((job) => job.targetId)).size !== 9) fail("dispatch plan contains duplicate targets");
  if (allPendingPlan.jobs.some((job) => job.approvedVisibleText.length !== 2)) {
    fail(`target-bound text whitelist was not extracted: ${JSON.stringify(allPendingPlan.jobs, null, 2)}`);
  }

  const resumedPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest({ completedTargetIds: ["cover-target-1"] }),
    topicDir: "/tmp/cover-topic",
    requestedConcurrency: 4,
  });
  if (resumedPlan.jobs.length !== 8) fail(`resume must include every pending target, got ${resumedPlan.jobs.length}`);
  if (resumedPlan.concurrency !== 4) fail(`explicit throughput concurrency should be 4, got ${resumedPlan.concurrency}`);
  if (resumedPlan.jobs.some((job) => job.targetId === "cover-target-1")) fail("completed target was regenerated");
  if (!resumedPlan.targetCountPreserved) fail("throughput concurrency incorrectly changed total request scope");

  const resolvers = [];
  const started = [];
  const executionPromise = executeCoverImage2DispatchPlan({
    plan: allPendingPlan,
    generate: (job) => new Promise((resolveJob) => {
      started.push(job.targetId);
      resolvers.push(() => resolveJob({ imagePath: `/tmp/${job.targetId}.png` }));
    }),
  });
  await new Promise((resolveTick) => setImmediate(resolveTick));
  if (started.length !== 9) fail(`all 9 jobs were not submitted before waiting; started ${started.length}`);
  resolvers.forEach((resolveJob) => resolveJob());
  const execution = await executionPromise;
  if (!execution.coversGenerated || execution.succeededCount !== 9 || execution.failedCount !== 0) {
    fail(`one-wave execution did not complete successfully: ${JSON.stringify(execution, null, 2)}`);
  }

  const isolatedFailure = await executeCoverImage2DispatchPlan({
    plan: allPendingPlan,
    generate: async (job) => {
      if (job.targetId === "cover-target-5") throw new Error("synthetic image2 failure");
      return { imagePath: `/tmp/${job.targetId}.png` };
    },
  });
  if (isolatedFailure.succeededCount !== 8 || isolatedFailure.failedCount !== 1) {
    fail(`one target failure was not isolated: ${JSON.stringify(isolatedFailure, null, 2)}`);
  }
  if (isolatedFailure.failedTargetIds.join(",") !== "cover-target-5") {
    fail(`wrong failed target set: ${isolatedFailure.failedTargetIds.join(",")}`);
  }
  if (isolatedFailure.coversGenerated) fail("partial Image2 generation was reported as complete");

  const extracted = extractApprovedVisibleText([
    "Text (verbatim):",
    "- \"黄金开篇\"",
    "- \"第一章留人公式\"",
    "Constraints: no extra text.",
  ].join("\n"));
  if (JSON.stringify(extracted) !== JSON.stringify(["黄金开篇", "第一章留人公式"])) {
    fail(`visible text extraction drifted: ${JSON.stringify(extracted)}`);
  }

  const runtimeContractPath = join(workspace, "skills", "codex-video-cover-generation", "references", "image2-dispatch-runtime.md");
  const runtimeContract = readFileSync(runtimeContractPath, "utf8");
  if (!runtimeContract.includes("Promise.allSettled")) fail("runtime contract does not require failure-isolated concurrent dispatch");
  if (/\[0:4\]|slice\s*\(\s*0\s*,\s*4\s*\)/.test(runtimeContract)) fail("runtime contract still permits four-item slicing");
  if (!runtimeContract.includes("all pending jobs")) fail("runtime contract does not explicitly submit the full pending set");

  const skillSource = readFileSync(join(workspace, "skills", "codex-video-cover-generation", "SKILL.md"), "utf8");
  for (const required of [
    "prepare-cover-image2-dispatch.mjs",
    "image2-dispatch-runtime.md",
    "ingest-codex-image2-cover-batch.mjs",
    "coversGenerated",
    "coversVerified",
  ]) {
    if (!skillSource.includes(required)) fail(`standalone cover Skill is missing ${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    plannedTargetCount: allPendingPlan.plannedTargetCount,
    pendingTargetCount: allPendingPlan.pendingTargetCount,
    defaultConcurrency: allPendingPlan.concurrency,
    allSubmittedBeforeWait: started.length,
    isolatedFailureTargetIds: isolatedFailure.failedTargetIds,
  }, null, 2));
}

await main();
