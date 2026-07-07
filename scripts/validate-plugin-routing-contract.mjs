#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/validate-plugin-routing-contract.mjs --out <output-dir> [--brief <brief.json>]",
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

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function requireFile(outDir, relativePath, failures) {
  const file = join(outDir, relativePath);
  expect(existsSync(file), `missing ${relativePath}`, failures);
  return file;
}

function capabilityById(contract, id) {
  return (contract.capabilities || []).find((capability) => capability.id === id);
}

function hasExistingEvidence(outDir, capability) {
  const paths = Array.isArray(capability?.evidencePaths) ? capability.evidencePaths : [];
  return paths.length > 0 && paths.every((path) => existsSync(join(outDir, path)));
}

function briefNeedsDataViz(brief) {
  return (brief.scenes || []).some((scene) => scene.chartData);
}

function briefNeedsProductDesign(brief) {
  return Boolean(brief.productSurface || brief.productFlow || brief.uiFlow)
    || (brief.scenes || []).some((scene) => scene.productSurface || scene.uiFlow);
}

function briefHasRawFootage(brief) {
  return Boolean(brief.rawFootageDir || brief.rawFootage || brief.sourceVideoPath || brief.sourceVideoDir)
    || (Array.isArray(brief.sourceVideos) && brief.sourceVideos.length > 0)
    || (Array.isArray(brief.clips) && brief.clips.some((clip) => clip.path || clip.url))
    || (Array.isArray(brief.scenes) && brief.scenes.some((scene) => scene.sourceVideo || scene.rawFootage || scene.clipPath));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const outDir = resolve(args.out);
  const failures = [];
  const contractPath = requireFile(outDir, "workflow/plugin-routing-contract.json", failures);
  const qualityPath = requireFile(outDir, "workflow/quality-consistency-contract.json", failures);
  const qcPath = requireFile(outDir, "logs/qc.json", failures);
  const toolPath = requireFile(outDir, "workflow/tool-candidate-selection.json", failures);

  const briefPath = args.brief ? resolve(args.brief) : join(outDir, "brief.json");
  const brief = existsSync(briefPath) ? readJson(briefPath) : {};

  if (failures.length === 0) {
    const contract = readJson(contractPath);
    const quality = readJson(qualityPath);
    const qc = readJson(qcPath);
    const toolSelection = readJson(toolPath);

    expect(contract.schemaVersion === 1, "plugin-routing-contract.json schemaVersion must be 1", failures);
    expect(contract.status === "required-framework-bound-plugin-gate", "plugin-routing-contract.json must be a required framework gate", failures);
    expect(contract.governor === "codex-video-workflow", "plugin routing must be governed by codex-video-workflow", failures);
    expect(contract.rule === "plugins-are-capabilities-not-quality-substitutes", "plugin routing must declare plugins as bounded capabilities", failures);
    expect(Array.isArray(contract.capabilities) && contract.capabilities.length >= 5, "plugin routing must list core capabilities", failures);

    const codex = capabilityById(contract, "codex-video-workflow");
    expect(codex?.role === "orchestrator", "codex-video-workflow must be the orchestrator capability", failures);
    expect(codex?.active === true, "codex-video-workflow must be active", failures);
    expect(hasExistingEvidence(outDir, codex), "codex-video-workflow evidence paths must exist", failures);

    for (const id of ["hyperframes", "gsap", "hyperframes-cli", "remotion"]) {
      const capability = capabilityById(contract, id);
      expect(Boolean(capability), `missing capability ${id}`, failures);
      expect(capability?.boundedByFramework === true, `${id} must be bounded by the framework`, failures);
      expect(capability?.directQualitySubstitute === false, `${id} must not be treated as a quality substitute`, failures);
      expect(Array.isArray(capability?.frameworkControls) && capability.frameworkControls.includes("workflow/quality-consistency-contract.json"), `${id} must reference the quality contract`, failures);
    }
    const remotion = capabilityById(contract, "remotion");
    expect(remotion?.active === true, "remotion capability must be active as the frame-driven motion primitive source", failures);
    expect((remotion?.evidencePaths || []).includes("workflow/motion-template-selection.json"), "remotion capability must point to motion-template-selection.json", failures);
    expect((remotion?.evidencePaths || []).includes("workflow/motion-grammar-plan.json"), "remotion capability must point to motion-grammar-plan.json", failures);

    const dataViz = capabilityById(contract, "build-web-data-visualization");
    expect(Boolean(dataViz), "missing build-web-data-visualization capability", failures);
    if (briefNeedsDataViz(brief)) {
      expect(dataViz.active === true, "data visualization capability must be active when scenes contain chartData", failures);
      expect(hasExistingEvidence(outDir, dataViz), "data visualization evidence paths must exist", failures);
    }

    const productDesign = capabilityById(contract, "product-design");
    if (briefNeedsProductDesign(brief)) {
      expect(productDesign?.active === true, "product-design capability must be active when the brief contains product/UI surface fields", failures);
      expect(hasExistingEvidence(outDir, productDesign), "product-design evidence paths must exist", failures);
    }

    const creative = capabilityById(contract, "creative-production");
    expect(creative?.active === true, "creative-production must be active for visual identity and cover direction", failures);
    expect(hasExistingEvidence(outDir, creative), "creative-production evidence paths must exist", failures);

    const videoUse = capabilityById(contract, "video-use-style-footage-editing");
    if (briefHasRawFootage(brief)) {
      expect(videoUse?.active === true, "video-use-style-footage-editing must be active when raw footage is supplied", failures);
      for (const artifact of [
        "workflow/raw-footage-inventory.json",
        "workflow/raw-transcript-index.json",
        "workflow/takes-packed.md",
        "workflow/word-boundary-map.json",
        "workflow/edit-decision-list.json",
        "workflow/cut-boundary-qc.json",
        "workflow/source-media-normalization-plan.json",
      ]) {
        expect(existsSync(join(outDir, artifact)), `raw-footage capability evidence missing: ${artifact}`, failures);
      }
    }

    const ipDiagram = capabilityById(contract, "ip-diagram-creator");
    expect(Boolean(ipDiagram), "missing ip-diagram-creator capability", failures);
    if (contract.routingSignals?.hasIpDiagramCreator === true || ipDiagram?.active === true) {
      expect(ipDiagram?.active === true, "ip-diagram-creator capability must be active when routing signals require it", failures);
      expect(ipDiagram?.boundedByFramework === true, "ip-diagram-creator must be bounded by the framework", failures);
      expect(ipDiagram?.directQualitySubstitute === false, "ip-diagram-creator must not be treated as a quality substitute", failures);
      expect(hasExistingEvidence(outDir, ipDiagram), "ip-diagram-creator evidence paths must exist", failures);

      const ipPlanPath = requireFile(outDir, "workflow/ip-diagram-creator-plan.json", failures);
      const ipJobsPath = requireFile(outDir, "workflow/ip-diagram-creator-native-jobs.json", failures);
      const ipAuditPath = requireFile(outDir, "workflow/ip-diagram-layout-audit.json", failures);
      if (existsSync(ipPlanPath) && existsSync(ipJobsPath) && existsSync(ipAuditPath)) {
        const ipPlan = readJson(ipPlanPath);
        const ipJobs = readJson(ipJobsPath);
        const ipAudit = readJson(ipAuditPath);
        const sceneAssignments = Array.isArray(ipPlan.sceneAssignments) ? ipPlan.sceneAssignments : [];

        expect(ipPlan.schemaVersion === 1, "ip-diagram-creator-plan.json schemaVersion must be 1", failures);
        expect(ipPlan.active === true, "ip-diagram-creator-plan.json must be active when capability is active", failures);
        expect(Boolean(ipPlan.sourceRepo) && Boolean(ipPlan.sourceCommit), "ip-diagram-creator plan must record source repo and commit", failures);
        expect(Array.isArray(ipPlan.executionModes) && ipPlan.executionModes.length >= 4, "ip-diagram-creator plan must expose execution modes", failures);
        expect(sceneAssignments.length > 0, "ip-diagram-creator plan must include scene assignments", failures);
        if (ipPlan.primaryPlannerRoute === true) {
          expect(ipPlan.plannerDriver?.id === "ip-diagram-creator", "primary ip-diagram route must record plannerDriver", failures);
          expect(Array.isArray(ipPlan.pageCards) && ipPlan.pageCards.length === sceneAssignments.length, "primary ip-diagram route must include one page card per scene assignment", failures);
        }

        expect(ipJobs.schemaVersion === 1, "ip-diagram-creator-native-jobs.json schemaVersion must be 1", failures);
        expect(ipJobs.sourceLicense === "MIT", "ip-diagram native jobs must preserve MIT source license", failures);
        expect(Boolean(ipJobs.sourceRepo) && Boolean(ipJobs.sourceCommit), "ip-diagram native jobs must record source repo and commit", failures);
        expect(Array.isArray(ipJobs.jobs) && ipJobs.jobs.length === sceneAssignments.length, "ip-diagram native jobs must include one job per active scene assignment", failures);

        expect(ipAudit.schemaVersion === 1, "ip-diagram-layout-audit.json schemaVersion must be 1", failures);
        expect(ipAudit.status === "pass", "ip-diagram layout audit must pass when capability is active", failures);
        expect(Array.isArray(ipAudit.checkedScenes) && ipAudit.checkedScenes.length === sceneAssignments.length, "ip-diagram layout audit must check each active scene assignment", failures);
      }
    }

    expect(Array.isArray(contract.frameworkRequiredArtifacts), "plugin routing must list frameworkRequiredArtifacts", failures);
    for (const artifact of [
      "workflow/content-presentation-design.json",
      "workflow/quality-consistency-contract.json",
      "workflow/motion-template-selection.json",
      "workflow/voice-direction.json",
      "workflow/sync-timecode-plan.json",
      "workflow/cover-design.json",
      "logs/qc.json",
    ]) {
      expect(contract.frameworkRequiredArtifacts.includes(artifact), `plugin routing must require ${artifact}`, failures);
      expect(existsSync(join(outDir, artifact)), `required framework artifact does not exist: ${artifact}`, failures);
    }

    const hardGates = Array.isArray(quality.hardGates) ? quality.hardGates : [];
    expect(hardGates.includes("pluginRoutingContractPresent"), "quality contract must gate pluginRoutingContractPresent", failures);
    expect(hardGates.includes("pluginRoutingContractEnforced"), "quality contract must gate pluginRoutingContractEnforced", failures);
    expect((quality.requiredArtifacts || []).includes("workflow/plugin-routing-contract.json"), "quality contract must require workflow/plugin-routing-contract.json", failures);

    expect(qc.checks?.pluginRoutingContractPresent === true, "logs/qc.json must pass pluginRoutingContractPresent", failures);
    expect(qc.checks?.pluginRoutingContractEnforced === true, "logs/qc.json must pass pluginRoutingContractEnforced", failures);
    if (briefHasRawFootage(brief)) {
      expect(qc.checks?.rawFootageEditingContractPresent === true, "logs/qc.json must pass rawFootageEditingContractPresent when raw footage is supplied", failures);
    }

    expect(toolSelection.pluginRoutingContract === "workflow/plugin-routing-contract.json", "tool-candidate-selection.json must point to plugin-routing-contract.json", failures);
    expect(Array.isArray(contract.disallowedShortcuts) && contract.disallowedShortcuts.includes("calling a plugin without producing framework evidence"), "plugin routing must reject plugin-only shortcuts", failures);
    expect(Array.isArray(contract.verification) && contract.verification.includes("run validate-plugin-routing-contract.mjs on final packages"), "plugin routing must name its validator", failures);
  }

  if (failures.length > 0) {
    console.error("Plugin routing contract validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    out: outDir,
    contract: "workflow/plugin-routing-contract.json",
  }, null, 2));
}

main();
