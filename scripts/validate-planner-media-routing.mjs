#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const outDir = resolve(process.argv[2] || "research/codex-video-workflow-poc/media-routing-self-test");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function file(path, failures) {
  const full = join(outDir, path);
  expect(existsSync(full), `missing ${path}`, failures);
  return full;
}

const failures = [];
const mediaPath = file("workflow/media-routing-plan.json", failures);
const imageStrategyPath = file("workflow/image-generation-strategy.json", failures);
const imagePromptsPath = file("workflow/image2-prompts.json", failures);
const visualManifestPath = file("workflow/visual-asset-manifest.json", failures);
const freeStockPlanPath = file("workflow/free-stock-material-plan.json", failures);
const freeStockLedgerPath = file("workflow/free-stock-asset-ledger.json", failures);
const qcPath = join(outDir, "logs", "qc.json");

let summary = {};
try {
  if (!failures.length) {
    const media = readJson(mediaPath);
    const strategy = readJson(imageStrategyPath);
    const prompts = readJson(imagePromptsPath);
    const manifest = readJson(visualManifestPath);
    const freeStockPlan = readJson(freeStockPlanPath);
    const freeStockLedger = readJson(freeStockLedgerPath);
    const routes = Array.isArray(media.sceneRoutes) ? media.sceneRoutes : [];
    const promptRows = Array.isArray(prompts.prompts) ? prompts.prompts : [];
    const assets = Array.isArray(manifest.insertedVisualAssets) ? manifest.insertedVisualAssets : [];
    const freeStockAssets = Array.isArray(freeStockLedger.assets) ? freeStockLedger.assets : [];
    const attempts = Array.isArray(freeStockPlan.attempts) ? freeStockPlan.attempts : [];
    const imagePolicy = media.policies?.sceneImageGenerationPolicy;
    const freeStockPolicy = media.policies?.freeStockMaterialPolicy;
    const imageRequired = imagePolicy === "required";
    const freeStockRequired = media.policies?.freeStockMaterialRequired === true;
    const freeStockOff = freeStockPolicy === "off";
    const freeStockBlocked = ["blocked-engine-error", "blocked-no-licensed-material", "blocked-not-executed"].includes(freeStockPlan.status);
    const bitmapAssets = assets.filter((asset) => ["image2", "codex-builtin"].includes(asset.selectedSource));

    expect(media.schemaVersion === 1, "media-routing-plan schemaVersion must be 1", failures);
    expect(media.stage === "pre-render-media-routing-plan", "media-routing-plan stage mismatch", failures);
    expect(["ready", "blocked"].includes(media.status), "media-routing-plan must expose ready/blocked status", failures);
    expect(Boolean(imagePolicy), "missing scene image generation policy", failures);
    expect(Boolean(freeStockPolicy), "missing free-stock material policy", failures);
    expect(media.providerRoutes?.image2?.strategyPath === "workflow/image-generation-strategy.json", "media plan must point to image-generation-strategy.json", failures);
    expect(media.providerRoutes?.image2?.promptsPath === "workflow/image2-prompts.json", "media plan must point to image2-prompts.json", failures);
    expect(media.providerRoutes?.freeStock?.planPath === "workflow/free-stock-material-plan.json", "media plan must point to free-stock-material-plan.json", failures);
    expect(media.providerRoutes?.freeStock?.ledgerPath === "workflow/free-stock-asset-ledger.json", "media plan must point to free-stock-asset-ledger.json", failures);
    expect(routes.length > 0, "media plan must include per-scene routes", failures);
    expect(routes.length === assets.length, "media route count must match visual asset count", failures);
    expect(routes.length === promptRows.length, "media route count must match image2 prompt count", failures);
    expect(routes.every((route) => route.query && Array.isArray(route.keywords) && route.keywords.length > 0), "each media route must carry a search query and keywords", failures);
    expect(routes.every((route) => route.image2?.promptPath === "workflow/image2-prompts.json"), "each media route must reference image2 prompts", failures);
    expect(routes.every((route) => typeof route.image2?.executionStatus === "string"), "each media route must expose image2 execution status", failures);
    expect(routes.every((route) => typeof route.freeStock?.executionStatus === "string"), "each media route must expose free-stock execution status", failures);
    expect(strategy.schemaVersion === 1 && Array.isArray(strategy.sceneRoutes), "image-generation-strategy must include scene routes", failures);
    expect(strategy.sceneRoutes.length === routes.length, "image strategy route count must match media route count", failures);
    expect(freeStockPlan.schemaVersion === 1 && freeStockPlan.stage === "free-stock-material-retrieval", "free-stock material plan schema/stage mismatch", failures);
    expect(freeStockLedger.schemaVersion === 1 && Array.isArray(freeStockLedger.assets), "free-stock ledger schema mismatch", failures);
    expect(
      attempts.length > 0
        || freeStockAssets.length > 0
        || freeStockBlocked
        || (freeStockOff && freeStockPlan.status === "off" && freeStockLedger.status === "empty"),
      "free-stock route must record provider attempts, selected assets, a blocking engine error, or explicit off/empty artifacts",
      failures
    );
    if (imageRequired) {
      expect(media.policies.realImageProviderActive === true, "required scene image policy needs image2 or codex-builtin provider", failures);
      expect(bitmapAssets.length > 0, "required scene image policy needs at least one inserted image2/codex bitmap", failures);
    }
    if (freeStockRequired) {
      expect(freeStockAssets.length > 0, "required free-stock policy needs at least one selected normalized asset", failures);
      expect(media.status !== "blocked", "required media routes must not remain blocked", failures);
    }
    if (existsSync(qcPath)) {
      const qc = readJson(qcPath);
      expect(qc.checks?.mediaRoutingPlanPresent === true, "logs/qc.json must pass mediaRoutingPlanPresent", failures);
    }
    summary = {
      outDir,
      status: media.status,
      imagePolicy,
      freeStockPolicy,
      routeCount: routes.length,
      imageMode: prompts.mode,
      bitmapAssetCount: bitmapAssets.length,
      freeStockAttemptCount: attempts.length,
      freeStockAssetCount: freeStockAssets.length,
      blockers: media.blockers || [],
    };
  }
} catch (error) {
  failures.push(error.stack || error.message);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, outDir, failures, summary }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
