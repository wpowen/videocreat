#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Resolve the sibling script from this file's own directory so the self-test
// runs from any CWD, matching the other self-tests (not repo-root-only).
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "plan-vertical-personal-ip-image.mjs");
const REQUIRED_ANCHORS = ["圆框眼镜", "橙色", "深色短外套"];

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${process.execPath} ${args.join(" ")}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function runNodeExpectFailure(args) {
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status === 0) {
    throw new Error(`Command unexpectedly passed: ${process.execPath} ${args.join(" ")}\n${result.stdout}`);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function testAspect(root, aspect, prefix) {
  const out = join(root, prefix);
  runNode([
    SCRIPT,
    "--out", out,
    "--aspect", aspect,
    "--title", "主题不是金句",
    "--core-idea", "小说主题不是一句漂亮金句，而是能被整本书反复拷问的价值命题。",
    "--required-text", "主题不是金句;价值命题;人物承受;冲突拷问;结局判决;小说的脊梁",
    "--agent-jobs", "搬走金句卡片;举起价值命题;标记冲突问题;递交结局判决",
  ]);

  const qc = readJson(join(out, "workflow", `${prefix}-personal-ip-image-qc.json`));
  const contract = readJson(join(out, "workflow", `${prefix}-personal-ip-image-contract.json`));
  const countPlan = readJson(join(out, "workflow", "personal-ip-image-count-plan.json"));
  const imageJobs = readJson(join(out, "workflow", `${prefix}-personal-ip-image-image-jobs.json`));
  const registry = readJson(join(out, "workflow", "personal-ip-asset-registry.json"));
  const promptIndex = readFileSync(join(out, "prompts", `${prefix}-personal-ip-image-prompt-index.md`), "utf8");
  const firstPrompt = readFileSync(join(out, "prompts", `${prefix}-personal-ip-image-pages`, "page-01-prompt.txt"), "utf8");
  const failures = [];

  assert(qc.pass === true, `${prefix}: QC did not pass`, failures);
  assert(countPlan.minImageCount >= 4, `${prefix}: min image count should be at least 4`, failures);
  assert(countPlan.maxImageCount >= countPlan.minImageCount, `${prefix}: max image count below min`, failures);
  assert(countPlan.resolvedImageCount >= countPlan.minImageCount, `${prefix}: resolved image count below min`, failures);
  assert(countPlan.resolvedImageCount <= countPlan.maxImageCount, `${prefix}: resolved image count above max`, failures);
  assert(countPlan.singleImageRejectedByDefault === true, `${prefix}: single image should be rejected by default`, failures);
  assert(Array.isArray(countPlan.slots) && countPlan.slots.length === countPlan.resolvedImageCount, `${prefix}: count plan slots do not match resolved count`, failures);
  assert(Array.isArray(imageJobs.jobs) && imageJobs.jobs.length === countPlan.resolvedImageCount, `${prefix}: image jobs do not match resolved count`, failures);
  assert(qc.checks?.imageCountWithinRange === true, `${prefix}: QC missing image count range check`, failures);
  assert(qc.checks?.promptsMatchPlannedImageCount === true, `${prefix}: QC missing prompt count check`, failures);
  assert(contract.imageQuantityPolicy?.resolvedImageCount === countPlan.resolvedImageCount, `${prefix}: contract image quantity policy is stale`, failures);
  assert(registry.status === "ready-default-persona" || registry.status === "ready-existing-persona", `${prefix}: registry did not resolve a ready fixed persona`, failures);
  assert(registry.personaId === "generic-host-male", `${prefix}: default route should resolve generic-host-male`, failures);
  assert(Boolean(registry.manifestPath) && existsSync(registry.manifestPath), `${prefix}: fixed persona manifest is missing`, failures);
  assert(Boolean(registry.mainAnchorPath) && existsSync(registry.mainAnchorPath), `${prefix}: fixed persona main anchor is missing`, failures);
  assert(contract.personaPolicy?.fixedPersonaManifestRequiredForPersonalIpFinal === true, `${prefix}: contract does not require fixed persona manifest`, failures);
  assert(qc.checks?.fixedPersonaManifestPresent === true, `${prefix}: QC missing fixedPersonaManifestPresent`, failures);
  assert(qc.checks?.fixedPersonaMainAnchorPresent === true, `${prefix}: QC missing fixedPersonaMainAnchorPresent`, failures);
  assert(qc.checks?.fixedPersonaStorageOutsidePublicSkill === true, `${prefix}: persona storage policy failed`, failures);
  if (prefix === "vertical") {
    assert(contract.mobileSafeAreas?.topBlankPx === 220, `${prefix}: contract missing 220px top mobile safe area`, failures);
    assert(contract.mobileSafeAreas?.bottomCaptionPx === 320, `${prefix}: contract missing bottom caption safe area`, failures);
    assert(qc.checks?.verticalTopSafeAreaPrompted === true, `${prefix}: QC missing vertical top safe-area prompt check`, failures);
    assert(qc.checks?.verticalBottomSubtitleSafeAreaPrompted === true, `${prefix}: QC missing vertical bottom subtitle safe-area prompt check`, failures);
    assert(firstPrompt.includes("top 220px") && firstPrompt.includes("phone status/navigation bars"), `${prefix}: prompt missing explicit mobile top safe-area instructions`, failures);
  }
  assert(promptIndex.includes(`requires ${countPlan.resolvedImageCount} generated images`), `${prefix}: prompt index missing image count`, failures);
  assert(firstPrompt.includes("Fixed personal-IP persona reference (mandatory):"), `${prefix}: prompt missing fixed persona section`, failures);
  assert(firstPrompt.includes(registry.manifestPath), `${prefix}: prompt missing manifest path`, failures);
  assert(REQUIRED_ANCHORS.some((anchor) => firstPrompt.includes(anchor)), `${prefix}: prompt missing visual anchor text`, failures);
  assert(!firstPrompt.includes("template-fallback") && !firstPrompt.includes("ip-persona-svg"), `${prefix}: prompt includes retired fallback markers`, failures);

  return failures;
}

function testContentMatchedCount(root) {
  const out = join(root, "content-matched-count");
  const content = Array.from({ length: 18 }, (_, index) => {
    const order = index + 1;
    return `第${order}段：个人 IP 图解页需要承接这一段口播的核心意思，画面只处理一个连续讲解动作，不能把整段稿子塞进一张总览图`;
  }).join("。");
  runNode([
    SCRIPT,
    "--out", out,
    "--aspect", "16:9",
    "--title", "长稿数量匹配测试",
    "--content", content,
    "--required-text", "口播匹配;连续讲解;单页单任务;清楚解释",
    "--agent-jobs", "拆出口播段落;匹配页面任务;检查是否过密;递交清晰页面",
  ]);

  const countPlan = readJson(join(out, "workflow", "personal-ip-image-count-plan.json"));
  const imageJobs = readJson(join(out, "workflow", "horizontal-personal-ip-image-image-jobs.json"));
  const failures = [];

  assert(countPlan.maxImageCount === 48, "default max image count should be the reasonable guardrail 48", failures);
  assert(countPlan.resolvedImageCount > 12, "long content should not be capped at 12 images", failures);
  assert(countPlan.resolvedImageCount < countPlan.maxImageCount, "long content should not blindly fill the max image count", failures);
  assert(countPlan.contentMetrics?.contentMatchCeiling >= countPlan.resolvedImageCount, "resolved count should be bounded by matchable narration beats", failures);
  assert(imageJobs.jobs.length === countPlan.resolvedImageCount, "image jobs do not match content-matched count", failures);

  return failures;
}

function main() {
  const root = mkdtempSync(join(tmpdir(), "personal-ip-image-flow-"));
  try {
    const failures = [
      ...testAspect(root, "16:9", "horizontal"),
      ...testAspect(root, "9:16", "vertical"),
      ...testContentMatchedCount(root),
    ];
    const mismatchError = runNodeExpectFailure([
      SCRIPT,
      "--out", join(root, "mismatch"),
      "--aspect", "16:9",
      "--title", "单图不应通过",
      "--core-idea", "个人 IP 视频不能只用一张图覆盖所有口播。",
      "--source-image", SCRIPT,
    ]);
    if (!mismatchError.includes("source image count mismatch")) {
      failures.push("single source image did not fail with the expected count mismatch");
    }
    if (failures.length) {
      console.error(JSON.stringify({ pass: false, failures }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ pass: true, root }, null, 2));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main();
