#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_LIBRARY = join(SKILL_ROOT, "assets", "motion-style-template-library.json");

function parseArgs(argv) {
  const args = { library: DEFAULT_LIBRARY, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--library") args.library = resolve(argv[++i]);
    else if (item === "--json") args.json = true;
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/validate-motion-style-template-library.mjs",
    "  node .agents/skills/codex-video-workflow/scripts/validate-motion-style-template-library.mjs --library <path> --json",
  ].join("\n");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validate(libraryPath) {
  const failures = [];
  assert(existsSync(libraryPath), `library file missing: ${libraryPath}`, failures);
  if (!existsSync(libraryPath)) {
    return { ok: false, failures, libraryPath };
  }
  const library = readJson(libraryPath);
  const templates = arrayify(library.templates);
  const ids = templates.map((template) => template.id);
  const requiredContentKinds = [
    "code-walkthrough",
    "formula-derivation",
    "data-chart",
    "table-ranking",
    "geo-map",
    "network-relationship",
    "funnel-conversion",
    "agent-simulation",
    "voice-sync",
    "ip-knowledge-card",
    "whiteboard-method",
    "cover-bridge",
    "material-collage",
    "choice-matrix",
  ];
  const dataSourceRequiredKinds = new Set([
    "data-chart",
    "table-ranking",
    "geo-map",
    "source-citation",
    "funnel-conversion",
  ]);

  assert(library.schemaVersion === 1, "library schemaVersion must be 1", failures);
  assert(library.status === "active-motion-style-template-library", "library status must be active", failures);
  assert(library.sourceCatalog === "assets/motion-style-catalog.json", "library must reference source catalog", failures);
  assert(library.designSpec === "references/motion-style-template-design-spec.md", "library must reference design spec", failures);
  assert(library.selectionArtifact === "workflow/motion-style-template-selection.json", "library must name selection artifact", failures);
  assert(templates.length >= 150, "library must expose at least 150 templates", failures);
  assert(new Set(ids).size === ids.length, "template ids must be unique", failures);
  assert(Number(library.coverage?.familyCount || 0) >= 30, "coverage must include at least 30 families", failures);
  assert(Number(library.coverage?.variantCount || 0) >= 5, "coverage must include at least 5 variants", failures);
  assert(Number(library.coverage?.templateCount || 0) === templates.length, "coverage templateCount must match templates", failures);
  assert(library.coverage?.hasVerticalShortFormTemplates === true, "library must expose vertical short-form contracts for every template", failures);
  assert(library.coverage?.verticalShortForm?.aspectRatio === "9:16", "library vertical coverage must record 9:16 aspect ratio", failures);
  assert(library.coverage?.verticalShortForm?.platformProfile === "douyin-tiktok-shorts-reels", "library vertical coverage must record short-form platform profile", failures);
  assert(Number(library.coverage?.verticalShortForm?.templateCount || 0) === templates.length, "library vertical templateCount must match templates", failures);
  assert(arrayify(library.coverage?.contentKinds).length >= 28, "library must cover diverse content kinds", failures);
  for (const kind of requiredContentKinds) {
    assert(templates.some((template) => template.contentKind === kind), `library must include content kind: ${kind}`, failures);
  }
  assert(Boolean(library.agentContract?.plannerAgent), "agent contract must include plannerAgent", failures);
  assert(Boolean(library.agentContract?.ttsTimingAgent), "agent contract must include ttsTimingAgent", failures);
  assert(Boolean(library.agentContract?.templateDirectorAgent), "agent contract must include templateDirectorAgent", failures);
  assert(Boolean(library.agentContract?.rendererQcAgent), "agent contract must include rendererQcAgent", failures);
  assert(library.selectionPolicy?.mode === "planner-auto-first-with-user-override", "selection policy must be planner-auto-first", failures);

  for (const template of templates) {
    assert(Boolean(template.id), "template missing id", failures);
    assert(Boolean(template.familyId), `${template.id || "template"} missing familyId`, failures);
    assert(Boolean(template.variantId), `${template.id || "template"} missing variantId`, failures);
    assert(Boolean(template.contentKind), `${template.id || "template"} missing contentKind`, failures);
    assert(Boolean(template.baseTemplate), `${template.id || "template"} missing baseTemplate`, failures);
    assert(Boolean(template.scenarioContract?.businessScenario), `${template.id || "template"} missing business scenario`, failures);
    assert(Boolean(template.scenarioContract?.useCase), `${template.id || "template"} missing use case`, failures);
    assert(Boolean(template.scenarioContract?.pageTitle), `${template.id || "template"} missing page title scenario`, failures);
    assert(Boolean(template.scenarioContract?.videoSubtitle), `${template.id || "template"} missing video subtitle scenario`, failures);
    assert(arrayify(template.scenarioContract?.visualObjects).length >= 3, `${template.id || "template"} missing scenario visual objects`, failures);
    assert(Boolean(template.scenarioContract?.sourcePlan?.mode), `${template.id || "template"} missing source/data mode`, failures);
    assert(template.verticalShortFormContract?.active === true, `${template.id || "template"} missing active vertical short-form contract`, failures);
    assert(template.verticalShortFormContract?.canvas?.aspectRatio === "9:16", `${template.id || "template"} vertical contract must use 9:16`, failures);
    assert(template.verticalShortFormContract?.canvas?.width === 1080 && template.verticalShortFormContract?.canvas?.height === 1920, `${template.id || "template"} vertical contract must record 1080x1920`, failures);
    assert(template.verticalShortFormContract?.canvas?.defaultFps === 60, `${template.id || "template"} vertical contract must default to 60fps`, failures);
    assert(Boolean(template.verticalShortFormContract?.hookArchitecture?.firstFramePromise), `${template.id || "template"} missing vertical first-frame promise`, failures);
    assert(Boolean(template.verticalShortFormContract?.hookArchitecture?.zeroToOneSecond), `${template.id || "template"} missing vertical 0-1s hook`, failures);
    assert(Boolean(template.verticalShortFormContract?.hookArchitecture?.oneToThreeSeconds), `${template.id || "template"} missing vertical 1-3s hook`, failures);
    assert(Boolean(template.verticalShortFormContract?.mobileLayout?.safeAreas?.bottomCaption), `${template.id || "template"} missing vertical bottom caption safe area`, failures);
    assert(Boolean(template.verticalShortFormContract?.mobileLayout?.safeAreas?.rightActionRail), `${template.id || "template"} missing vertical right action rail safe area`, failures);
    assert(Boolean(template.verticalShortFormContract?.effectPlan?.verticalPlacement), `${template.id || "template"} missing vertical effect placement`, failures);
    assert(template.verticalShortFormContract?.captionContract?.maxLines === 1, `${template.id || "template"} vertical subtitles must be one line`, failures);
    assert(arrayify(template.verticalShortFormContract?.qualityGates).includes("firstThreeSecondHookPresent"), `${template.id || "template"} missing vertical 3-second hook gate`, failures);
    assert(Boolean(template.galaceanEffectContract?.capabilityId), `${template.id || "template"} missing Galacean effect capability`, failures);
    assert(Boolean(template.galaceanEffectContract?.semanticJob), `${template.id || "template"} missing Galacean semantic job`, failures);
    assert(template.galaceanEffectContract?.captionSafe === true, `${template.id || "template"} Galacean effect must be caption safe`, failures);
    assert(/deterministic HTML\/SVG\/CSS/.test(template.galaceanEffectContract?.exactTextOwner || ""), `${template.id || "template"} Galacean effect must not own exact text`, failures);
    assert(Boolean(template.galaceanEffectContract?.fallback), `${template.id || "template"} missing Galacean fallback`, failures);
    assert(Boolean(template.layoutContract?.blueprint), `${template.id || "template"} missing layout blueprint`, failures);
    assert(Number(template.layoutContract?.horizontalTextStackSafeArea?.minimumGapPx || 0) >= 40, `${template.id || "template"} missing horizontal text-stack safe area`, failures);
    assert(Boolean(template.typographyContract?.mode), `${template.id || "template"} missing typography mode`, failures);
    assert(template.typographyContract?.exactTextOwner === "deterministic HTML/SVG/CSS layers", `${template.id || "template"} must keep deterministic text ownership`, failures);
    assert(arrayify(template.motionContract?.animationSteps).length >= 3, `${template.id || "template"} must expose at least 3 animation steps`, failures);
    assert(Boolean(template.dataAccuracyContract?.rule), `${template.id || "template"} missing data accuracy rule`, failures);
    assert(arrayify(template.assetTaskContract?.assetNeeds).length >= 3, `${template.id || "template"} missing asset needs`, failures);
    assert(Boolean(template.benchmarkContract?.horizontalComparisonRule), `${template.id || "template"} missing benchmark contract`, failures);
    assert(arrayify(template.benchmarkContract?.externalReferences).length >= 5, `${template.id || "template"} missing external benchmark references`, failures);
    assert(arrayify(template.qualityGates).includes("thumbnailModalParity"), `${template.id || "template"} missing thumbnail/modal parity gate`, failures);
    assert(arrayify(template.qualityGates).includes("businessScenarioBound"), `${template.id || "template"} missing business scenario gate`, failures);
    assert(arrayify(template.qualityGates).includes("galaceanEffectContractPresent"), `${template.id || "template"} missing Galacean effect gate`, failures);
    assert(arrayify(template.qualityGates).includes("effectLayerCaptionSafe"), `${template.id || "template"} missing effect caption-safe gate`, failures);
    assert(arrayify(template.qualityGates).includes("dataSourceModeRecorded"), `${template.id || "template"} missing data source mode gate`, failures);
    assert(Boolean(template.agentHandoff?.templateDirectorOutput), `${template.id || "template"} missing agent handoff`, failures);
    assert(arrayify(template.agentHandoff?.rendererQcChecks).includes("left headline/body-card safe gap"), `${template.id || "template"} missing left text-stack renderer QC check`, failures);
    assert(arrayify(template.qualityGates).includes("frameTextFullyVisibleAndFluent"), `${template.id || "template"} missing text visibility gate`, failures);
    assert(arrayify(template.qualityGates).includes("horizontalTextStackSafeAreaClear"), `${template.id || "template"} missing horizontal text-stack safe-area gate`, failures);
    assert(arrayify(template.qualityGates).includes("verticalShortFormContractPresent"), `${template.id || "template"} missing vertical short-form gate`, failures);
    assert(arrayify(template.qualityGates).includes("verticalPlatformSafeAreaReserved"), `${template.id || "template"} missing vertical platform safe-area gate`, failures);
    assert(arrayify(template.rejectList).some((item) => /technology stack|page number|internal workflow/i.test(item)), `${template.id || "template"} must reject internal labels`, failures);
    if (template.contentKind === "data-chart") {
      assert(arrayify(template.dataAccuracyContract?.measuredDataRequires).includes("workflow/data-source-plan.json"), `${template.id} data chart missing data-source-plan requirement`, failures);
    }
    if (dataSourceRequiredKinds.has(template.contentKind)) {
      const sourcePlan = template.scenarioContract?.sourcePlan || {};
      assert(Boolean(sourcePlan.label), `${template.id} missing source plan label`, failures);
      assert(Boolean(sourcePlan.url) || ["illustrative", "source-backed", "quality-gate"].includes(sourcePlan.mode), `${template.id} measured/source template missing URL or explicit non-measured mode`, failures);
    }
    if (template.contentKind === "formula-derivation") {
      assert(template.dataAccuracyContract?.formulaRequiresVerification === true, `${template.id} formula template must require verification`, failures);
    }
    if (template.contentKind === "code-walkthrough") {
      assert(template.dataAccuracyContract?.codeRequiresTruthMode === true, `${template.id} code template must require truth mode`, failures);
    }
    if (template.contentKind === "ip-knowledge-card") {
      assert(/reuse saved authorized persona asset/i.test(template.assetTaskContract?.personalIpPolicy || ""), `${template.id} personal IP template must require saved asset reuse`, failures);
    }
  }

  const layoutBlueprints = new Set(templates.map((template) => template.layoutContract?.blueprint).filter(Boolean));
  const typographyModes = new Set(templates.map((template) => template.typographyContract?.mode).filter(Boolean));
  assert(layoutBlueprints.size >= 16, "library must have diverse layout blueprints", failures);
  assert(typographyModes.size >= 5, "library must have diverse typography modes", failures);

  return {
    ok: failures.length === 0,
    failures,
    libraryPath,
    summary: {
      templateCount: templates.length,
      contentKindCount: new Set(templates.map((template) => template.contentKind)).size,
      layoutBlueprintCount: layoutBlueprints.size,
      typographyModeCount: typographyModes.size,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const report = validate(args.library);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log(`motion style template library ok: ${report.summary.templateCount} templates, ${report.summary.contentKindCount} content kinds`);
  } else {
    console.error(report.failures.join("\n"));
  }
  if (!report.ok) process.exit(1);
}

main();
