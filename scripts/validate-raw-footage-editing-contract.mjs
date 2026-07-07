#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/validate-raw-footage-editing-contract.mjs --out <output-dir> [--brief <brief.json>]",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--help" || item === "-h") args.help = true;
    else if (item === "--out") args.out = argv[++i];
    else if (item === "--brief") args.brief = argv[++i];
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function requireFile(outDir, relativePath, failures) {
  const path = join(outDir, relativePath);
  expect(existsSync(path), `missing ${relativePath}`, failures);
  return path;
}

function briefHasRawFootage(brief) {
  return Boolean(brief.rawFootageDir || brief.rawFootage || brief.sourceVideoPath || brief.sourceVideoDir)
    || (Array.isArray(brief.sourceVideos) && brief.sourceVideos.length > 0)
    || (Array.isArray(brief.clips) && brief.clips.some((clip) => clip.path || clip.url))
    || (Array.isArray(brief.scenes) && brief.scenes.some((scene) => scene.sourceVideo || scene.rawFootage || scene.clipPath));
}

function capabilityById(contract, id) {
  return (contract.capabilities || []).find((capability) => capability.id === id);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const outDir = resolve(args.out);
  const briefPath = args.brief ? resolve(args.brief) : join(outDir, "brief.json");
  const failures = [];
  const brief = existsSync(briefPath) ? readJson(briefPath) : {};

  if (!briefHasRawFootage(brief)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "brief has no raw footage signal" }, null, 2));
    return;
  }

  const pluginPath = requireFile(outDir, "workflow/plugin-routing-contract.json", failures);
  const externalPath = requireFile(outDir, "workflow/external-capability-fusion-plan.json", failures);
  const qualityPath = requireFile(outDir, "workflow/quality-consistency-contract.json", failures);
  const qcPath = join(outDir, "logs/qc.json");
  const inventoryPath = requireFile(outDir, "workflow/raw-footage-inventory.json", failures);
  const transcriptIndexPath = requireFile(outDir, "workflow/raw-transcript-index.json", failures);
  const takesPackedPath = requireFile(outDir, "workflow/takes-packed.md", failures);
  const wordBoundaryPath = requireFile(outDir, "workflow/word-boundary-map.json", failures);
  const edlPath = requireFile(outDir, "workflow/edit-decision-list.json", failures);
  const cutQcPath = requireFile(outDir, "workflow/cut-boundary-qc.json", failures);
  const normalizationPath = requireFile(outDir, "workflow/source-media-normalization-plan.json", failures);

  if (!failures.length) {
    const plugin = readJson(pluginPath);
    const external = readJson(externalPath);
    const quality = readJson(qualityPath);
    const qc = existsSync(qcPath) ? readJson(qcPath) : null;
    const inventory = readJson(inventoryPath);
    const transcriptIndex = readJson(transcriptIndexPath);
    const takesPacked = readFileSync(takesPackedPath, "utf8");
    const wordBoundary = readJson(wordBoundaryPath);
    const edl = readJson(edlPath);
    const cutQc = readJson(cutQcPath);
    const normalization = readJson(normalizationPath);

    const pluginCapability = capabilityById(plugin, "video-use-style-footage-editing");
    const externalCapability = capabilityById(external, "raw-footage-editing");
    expect(pluginCapability?.active === true, "video-use-style-footage-editing plugin capability must be active", failures);
    expect(externalCapability?.active === true, "raw-footage-editing external capability must be active", failures);

    const evidencePaths = externalCapability?.requiredEvidence || [];
    for (const artifact of [
      "workflow/raw-footage-inventory.json",
      "workflow/raw-transcript-index.json",
      "workflow/takes-packed.md",
      "workflow/word-boundary-map.json",
      "workflow/edit-decision-list.json",
      "workflow/cut-boundary-qc.json",
      "workflow/source-media-normalization-plan.json",
    ]) {
      expect(evidencePaths.includes(artifact), `external capability must require ${artifact}`, failures);
      expect((quality.requiredArtifacts || []).includes(artifact), `quality contract must require ${artifact}`, failures);
    }

    expect((quality.hardGates || []).includes("rawFootageEditingContractPresent"), "quality contract must gate rawFootageEditingContractPresent", failures);
    if (qc) {
      expect(qc.checks?.rawFootageEditingContractPresent === true, "logs/qc.json must pass rawFootageEditingContractPresent", failures);
    }

    expect(inventory.schemaVersion === 1, "raw-footage-inventory schemaVersion must be 1", failures);
    expect(Array.isArray(inventory.entries) && inventory.entries.length > 0, "raw-footage-inventory must list source entries", failures);
    expect(/authorized|licensed/i.test(inventory.rightsPolicy || ""), "raw-footage inventory must state rights policy", failures);

    expect(transcriptIndex.schemaVersion === 1, "raw-transcript-index schemaVersion must be 1", failures);
    expect(transcriptIndex.primaryReadingSurface === "workflow/takes-packed.md", "transcript index must point to takes-packed.md", failures);
    expect(transcriptIndex.wordBoundaryMap === "workflow/word-boundary-map.json", "transcript index must point to word-boundary-map.json", failures);
    expect(/explicit-opt-in-only/.test(transcriptIndex.providerPolicy?.cloudTranscription || ""), "cloud ASR must remain explicit opt-in only", failures);
    expect(/word-level/i.test(transcriptIndex.requiredGranularity || ""), "transcript index must require word-level timestamps for executable cuts", failures);
    expect(/Required line shape/.test(takesPacked), "takes-packed.md must document the packed transcript line shape", failures);

    expect(wordBoundary.schemaVersion === 1, "word-boundary-map schemaVersion must be 1", failures);
    expect(wordBoundary.boundaryRules?.neverCutInsideWord === true, "word-boundary-map must enforce never-cut-inside-word", failures);
    expect(Number(wordBoundary.boundaryRules?.paddingWindowMs?.min) === 30, "word-boundary padding min must be 30ms", failures);
    expect(Number(wordBoundary.boundaryRules?.paddingWindowMs?.max) === 200, "word-boundary padding max must be 200ms", failures);
    expect(wordBoundary.renderOrderRules?.perSegmentExtractThenConcat === true, "render order must require per-segment extract then concat", failures);
    expect(wordBoundary.renderOrderRules?.boundaryAudioFadeMs === 30, "render order must require 30ms boundary audio fades", failures);
    expect(wordBoundary.renderOrderRules?.overlayPtsShiftRequired === true, "render order must require overlay PTS shifting", failures);
    expect(wordBoundary.renderOrderRules?.subtitlesAppliedLast === true, "render order must require subtitles last", failures);
    expect(/output-timeline/i.test(wordBoundary.renderOrderRules?.subtitleTimeline || ""), "render order must require output-timeline subtitle offsets", failures);

    expect(edl.schemaVersion === 1, "edit-decision-list schemaVersion must be 1", failures);
    expect(edl.transcriptDependency === "workflow/raw-transcript-index.json", "EDL must depend on raw transcript index", failures);
    expect(edl.wordBoundaryDependency === "workflow/word-boundary-map.json", "EDL must depend on word-boundary map", failures);
    expect(Array.isArray(edl.decisions) && edl.decisions.length > 0, "EDL must contain decisions", failures);
    expect(edl.decisions.every((decision) => decision.cutPaddingMs?.allowedMin === 30 && decision.cutPaddingMs?.allowedMax === 200), "EDL decisions must carry cut padding bounds", failures);
    expect(edl.decisions.every((decision) => /word/i.test(decision.cutPolicy || "")), "EDL decisions must mention word-boundary cut policy", failures);

    expect(cutQc.schemaVersion === 1, "cut-boundary-qc schemaVersion must be 1", failures);
    expect(cutQc.maxSelfEvalPasses === 3, "cut-boundary QC must cap self-eval at 3 passes", failures);
    expect(Number(cutQc.reviewWindowSeconds) === 1.5, "cut-boundary QC must define a 1.5s review window", failures);
    expect((cutQc.requiredEvidence || []).some((item) => /cut boundary/i.test(item)), "cut-boundary QC must require cut-boundary evidence", failures);
    expect((cutQc.checks || []).some((item) => /subtitles are applied last/i.test(item)), "cut-boundary QC must check subtitles-last ordering", failures);
    expect((cutQc.checks || []).some((item) => /PTS/i.test(item)), "cut-boundary QC must check overlay PTS alignment", failures);

    expect(normalization.schemaVersion === 1, "source-media-normalization-plan schemaVersion must be 1", failures);
    expect((normalization.perSegmentRules || []).some((rule) => /probe every selected source/i.test(rule)), "normalization plan must require source probes", failures);
    expect((normalization.perSegmentRules || []).some((rule) => /color correction per segment/i.test(rule)), "normalization plan must require per-segment color correction when needed", failures);
  }

  if (failures.length > 0) {
    console.error("Raw footage editing contract validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    out: outDir,
    contract: "workflow/raw-footage-inventory.json",
    validator: "validate-raw-footage-editing-contract.mjs",
  }, null, 2));
}

main();
