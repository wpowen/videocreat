#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const workflowScript = join(skillRoot, "scripts", "poc-video-workflow.mjs");
const routeSelfTestScript = join(skillRoot, "scripts", "self-test-capability-routing.mjs");
const generationModeDefaultSelfTest = join(skillRoot, "scripts", "self-test-generation-mode-default.mjs");
const personalIpSemanticScenePlanningSelfTest = join(skillRoot, "scripts", "self-test-personal-ip-semantic-scene-planning.mjs");
const personalIpNoDowngradeSelfTest = join(skillRoot, "scripts", "self-test-personal-ip-no-downgrade.mjs");
const semiAutoConfigBuilder = join(skillRoot, "scripts", "build-semi-auto-config-html.mjs");
const pageReviewBuilder = join(skillRoot, "scripts", "build-page-review-html.mjs");
const htmlTemplateValidator = join(skillRoot, "scripts", "validate-html-motion-templates.mjs");
const pluginValidator = join(skillRoot, "scripts", "validate-plugin-routing-contract.mjs");
const subtitleCoverValidator = join(skillRoot, "scripts", "validate-subtitle-cover-contract.mjs");
const voicePauseValidator = join(skillRoot, "scripts", "validate-voice-pause-policy.mjs");
const briefTemplatePath = join(skillRoot, "assets", "self-tests", "full-framework-capability-brief.json");
const quickValidateScript = process.env.CODEX_SKILL_QUICK_VALIDATE
  || join(process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"), "skills", ".system", "skill-creator", "scripts", "quick_validate.py");

function parseArgs(argv) {
  const args = {
    outRoot: join(workspace, "research", "codex-video-workflow-poc", "full-framework-self-test"),
    imageSource: "image2-dryrun",
    fullRender: false,
    keepExisting: false,
    validateExistingPackage: false,
    skipHtmlTemplateValidation: false,
    maxVisualFrames: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--out-root") args.outRoot = resolve(argv[++i]);
    else if (item === "--image-source") args.imageSource = argv[++i];
    else if (item === "--full-render") args.fullRender = true;
    else if (item === "--keep-existing") args.keepExisting = true;
    else if (item === "--validate-existing-package") {
      args.validateExistingPackage = true;
      args.keepExisting = true;
    }
    else if (item === "--skip-html-template-validation") args.skipHtmlTemplateValidation = true;
    else if (item === "--max-visual-frames") args.maxVisualFrames = Number(argv[++i]);
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/self-test-full-framework.mjs [--out-root <dir>] [--full-render]",
    "  node .agents/skills/codex-video-workflow/scripts/self-test-full-framework.mjs --out-root <dir> --full-render --validate-existing-package",
    "",
    "Runs the repeatable full-framework capability self-test.",
    "Default mode is cover-only route/artifact validation. Add --full-render for MP4/TTS/QC validation.",
    "Use --validate-existing-package with --keep-existing to re-run validators on an existing package without rendering again.",
  ].join("\n");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function rel(path) {
  return relative(workspace, path);
}

function runCommand({ id, command, args, cwd = workspace, required = true }, report) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const entry = {
    id,
    command: [command, ...args].join(" "),
    cwd,
    status: result.status,
    ok: result.status === 0,
    required,
    startedAt,
    finishedAt: new Date().toISOString(),
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
  report.commands.push(entry);
  if (required && result.status !== 0) {
    report.failures.push(`${id} failed with status ${result.status}`);
  }
  return entry;
}

function replacePlaceholders(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => replacePlaceholders(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePlaceholders(item, replacements)]));
  }
  if (typeof value === "string") {
    return Object.entries(replacements).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value);
  }
  return value;
}

function writeFixtureVideo({ path, pattern, toneHz = 440, durationSeconds = 4 }) {
  const videoFilter = `${pattern}=size=1280x720:rate=30:duration=${durationSeconds}`;
  const audioFilter = `sine=frequency=${toneHz}:sample_rate=48000:duration=${durationSeconds}`;
  const result = spawnSync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", videoFilter,
    "-f", "lavfi",
    "-i", audioFilter,
    "-t", String(durationSeconds),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    path,
  ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0 || !existsSync(path)) {
    writeFileSync(path, `ffmpeg fixture generation failed; placeholder only\n${result.stderr || ""}`);
  }
}

function createFixtures(outRoot) {
  const fixtures = join(outRoot, "fixtures");
  ensureDir(fixtures);
  const rawDir = join(fixtures, "authorized-raw-footage");
  ensureDir(rawDir);
  const clipPath = join(rawDir, "authorized-self-test-clip.mp4");
  const referencePath = join(fixtures, "reference-video.mp4");
  const lottiePath = join(fixtures, "authored-loop.json");
  writeFixtureVideo({ path: clipPath, pattern: "testsrc2", toneHz: 523, durationSeconds: 4 });
  writeFixtureVideo({ path: referencePath, pattern: "smptebars", toneHz: 392, durationSeconds: 3 });
  writeJson(lottiePath, {
    v: "5.12.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 240,
    h: 240,
    nm: "self-test-authored-loop",
    ddd: 0,
    assets: [],
    layers: [],
  });
  return { fixtures, rawDir, clipPath, referencePath, lottiePath };
}

function buildResolvedBrief({ outRoot, imageSource }) {
  const fixtures = createFixtures(outRoot);
  const template = readJson(briefTemplatePath);
  const resolved = replacePlaceholders(template, {
    __SELF_TEST_RAW_FOOTAGE_DIR__: rel(fixtures.rawDir),
    __SELF_TEST_REFERENCE_VIDEO__: rel(fixtures.referencePath),
    __SELF_TEST_SCENE_CLIP__: rel(fixtures.clipPath),
    __SELF_TEST_LOTTIE_ASSET__: rel(fixtures.lottiePath),
  });
  resolved.imageSource = imageSource;
  const briefPath = join(outRoot, "full-framework-capability-brief.resolved.json");
  writeJson(briefPath, resolved);
  return { briefPath, brief: resolved, fixtures };
}

function capabilityById(contract, id) {
  return (contract.capabilities || []).find((capability) => capability.id === id) || {};
}

function externalById(plan, id) {
  return (plan.capabilities || []).find((capability) => capability.id === id) || {};
}

function fileExists(out, relativePath) {
  return existsSync(join(out, relativePath));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function outputHasTemplateLeak(out) {
  const files = [
    "delivery.html",
    "workflow/design-plan.json",
    "workflow/motion-grammar-plan.json",
    "workflow/template-props-contract.json",
    "workflow/quality-consistency-contract.json",
    "workflow/page-decision-contract.json",
    "workflow/retention-structure-contract.json",
  ].map((file) => join(out, file)).filter((file) => existsSync(file));
  const leakPattern = /\bundefined\b|\bTODO\b|\[object Object\]|__SELF_TEST_|>\s*null\s*</i;
  return files.some((file) => leakPattern.test(readFileSync(file, "utf8")));
}

function walkFiles(dir, matcher, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, matcher, acc);
    else if (!matcher || matcher(full)) acc.push(full);
  }
  return acc;
}

function generatedFrameHtmls(out) {
  return walkFiles(join(out, ".html-video", "projects"), (file) => /\/frames\/.+\.html$/i.test(file)).sort();
}

function outputHasViewerTestLanguage(out) {
  const visibleFiles = [
    "brief.json",
    "delivery.html",
    "script/narration.txt",
    "script/narration-spoken.txt",
    ...generatedFrameHtmls(out).map((file) => relative(out, file)),
  ].map((file) => join(out, file)).filter((file) => existsSync(file));
  const leakPattern = /这次自测|实战自测|这是一个测试|REAL CASE|SELF TEST/i;
  return visibleFiles.some((file) => leakPattern.test(readFileSync(file, "utf8")));
}

function layoutContractFailures(out) {
  const failures = [];
  const frames = generatedFrameHtmls(out);
  if (!frames.length) return failures;
  const frameByName = new Map(frames.map((file) => [file.split("/").pop(), readFileSync(file, "utf8")]));
  for (const name of ["02-country-ai-investment.html", "03-enterprise-ai-adoption.html", "04-consumer-ai-adoption.html"]) {
    const html = frameByName.get(name) || "";
    assert(/data-viz-stage/.test(html), `${name} must use data-viz-stage safe layout`, failures);
    assert(/data-showcase/.test(html), `${name} must render a filled data-showcase card`, failures);
    assert(/hai\.stanford\.edu|mckinsey\.com/.test(html), `${name} must expose a source domain on the data card`, failures);
    assert(!/\dUSD|undefined|null|TODO|\[object Object\]/i.test(html), `${name} must not expose malformed units or empty template text`, failures);
  }
  for (const name of ["05-attention-formula-manim.html", "06-attention-code-demo.html"]) {
    const html = frameByName.get(name) || "";
    assert(/formula-viz-stage/.test(html), `${name} must use formula-viz-stage safe layout`, failures);
    assert(/formula-showcase/.test(html), `${name} must render a filled formula-showcase card`, failures);
    assert(/Attention\(Q,K,V\)|softmax|scores/.test(html), `${name} must expose concrete formula or code content`, failures);
    assert(!/undefined|null|TODO|\[object Object\]/i.test(html), `${name} must not expose empty formula template text`, failures);
  }
  return failures;
}

function visualCapabilityContractFailures(out) {
  const failures = [];
  const frames = generatedFrameHtmls(out);
  if (!frames.length) return failures;
  const frameByName = new Map(frames.map((file) => [file.split("/").pop(), readFileSync(file, "utf8")]));
  const expected = [
    {
      name: "02-country-ai-investment.html",
      patterns: [/capability-d3-diagram/, /data-showcase/],
      label: "data visualization capability must be visible",
    },
    {
      name: "05-attention-formula-manim.html",
      patterns: [/capability-manim-insert/, /formula-showcase/],
      label: "Manim/math route must be visible as formula motion structure",
    },
    {
      name: "07-website-source-google-ai.html",
      patterns: [/capability-website-source/, /capability-proof-website-source/, /website-structure/],
      label: "website-source route must render a visible source-structure module",
    },
    {
      name: "08-authorized-broll-edl.html",
      patterns: [/capability-raw-footage/, /capability-proof-raw-footage/, /<video\s/i, /edl-stack/],
      label: "raw-footage route must render video plus EDL proof, not only text",
    },
    {
      name: "09-ai-evidence-console-product-flow.html",
      patterns: [/capability-product-flow/, /capability-proof-product-flow/, /product-console/],
      label: "product-design route must render a visible product flow",
    },
    {
      name: "11-three-depth-ai-stack.html",
      patterns: [/capability-threejs-depth/, /capability-proof-threejs-depth/, /depth-world/, /depth-stack/],
      label: "Three.js depth route must render a visible spatial module",
    },
    {
      name: "12-lottie-ai-loop.html",
      patterns: [/capability-lottie-authored/, /capability-proof-lottie-authored/, /lottie-stage/, /lottie-path/],
      label: "Lottie route must render a visible authored-loop module",
    },
    {
      name: "13-gsap-exception-check.html",
      patterns: [/capability-gsap-exception/, /capability-proof-gsap-exception/, /exception-gate/, /not default/],
      label: "GSAP exception route must render an inactive gate and fallback path",
    },
  ];
  for (const item of expected) {
    const html = frameByName.get(item.name) || "";
    assert(Boolean(html), `${item.name} must exist for visual capability proof`, failures);
    for (const pattern of item.patterns) {
      assert(pattern.test(html), `${item.name}: ${item.label}; missing ${pattern}`, failures);
    }
  }
  return failures;
}

function validateFullFrameworkOutput({ out, briefPath, fullRender = false }) {
  const failures = [];
  const requiredFiles = [
    "brief.json",
    "delivery-service.mjs",
    "delivery-manifest.json",
    "AUTHORIZATION.md",
    "workflow/runtime-config.json",
    "workflow/generation-mode-contract.json",
    "workflow/semi-auto-config.json",
    "semi-auto-config.html",
    "workflow/design-plan.json",
    "workflow/content-presentation-design.json",
    "workflow/design-platform-planner.json",
    "workflow/caption-style-plan.json",
    "workflow/quality-consistency-contract.json",
    "workflow/page-decision-contract.json",
    "workflow/retention-structure-contract.json",
    "workflow/plugin-routing-contract.json",
    "workflow/external-capability-fusion-plan.json",
    "workflow/motion-template-selection.json",
    "workflow/production-plan.json",
    "workflow/material-candidate-pool.json",
    "workflow/motion-grammar-plan.json",
    "workflow/image-generation-strategy.json",
    "workflow/image2-prompts.json",
    "workflow/visual-asset-manifest.json",
    "workflow/visual-relevance-audit.json",
    "workflow/visual-rhythm-plan.json",
    "workflow/data-source-plan.json",
    "workflow/data-series.json",
    "workflow/data-motion-plan.json",
    "workflow/raw-footage-inventory.json",
    "workflow/raw-transcript-index.json",
    "workflow/takes-packed.md",
    "workflow/word-boundary-map.json",
    "workflow/edit-decision-list.json",
    "workflow/cut-boundary-qc.json",
    "workflow/source-media-normalization-plan.json",
    "workflow/template-props-contract.json",
    "workflow/variant-render-plan.json",
    "workflow/reference-alignment/comparison.json",
    "workflow/reference-alignment/alignment-report.md",
    "workflow/reference-alignment/comparison-report.md",
    "workflow/cover-design.json",
    "workflow/cover-image2-prompts.json",
    "workflow/cover-image2-qc.json",
    "workflow/commands.json",
  ];
  if (fullRender) requiredFiles.push("delivery.html");
  for (const file of requiredFiles) assert(fileExists(out, file), `missing required artifact: ${file}`, failures);
  if (failures.length) return { failures };

  const brief = readJson(briefPath);
  const design = readJson(join(out, "workflow", "design-plan.json"));
  const runtimeConfig = readJson(join(out, "workflow", "runtime-config.json"));
  const motion = readJson(join(out, "workflow", "motion-template-selection.json"));
  const generation = readJson(join(out, "workflow", "generation-mode-contract.json"));
  const semiAutoConfig = readJson(join(out, "workflow", "semi-auto-config.json"));
  const captionStyle = readJson(join(out, "workflow", "caption-style-plan.json"));
  const pageDecision = readJson(join(out, "workflow", "page-decision-contract.json"));
  const retention = readJson(join(out, "workflow", "retention-structure-contract.json"));
  const captionCatalog = readJson(join(skillRoot, "assets", "caption-style-catalog.json"));
  const grammar = readJson(join(out, "workflow", "motion-grammar-plan.json"));
  const plugin = readJson(join(out, "workflow", "plugin-routing-contract.json"));
  const external = readJson(join(out, "workflow", "external-capability-fusion-plan.json"));
  const visualManifest = readJson(join(out, "workflow", "visual-asset-manifest.json"));
  const visualAudit = readJson(join(out, "workflow", "visual-relevance-audit.json"));
  const cover = readJson(join(out, "workflow", "cover-design.json"));
  const coverQc = readJson(join(out, "workflow", "cover-image2-qc.json"));
  const dataSource = readJson(join(out, "workflow", "data-source-plan.json"));
  const dataSeries = readJson(join(out, "workflow", "data-series.json"));
  const dataMotion = readJson(join(out, "workflow", "data-motion-plan.json"));
  const rawInventory = readJson(join(out, "workflow", "raw-footage-inventory.json"));
  const templateProps = readJson(join(out, "workflow", "template-props-contract.json"));
  const variants = readJson(join(out, "workflow", "variant-render-plan.json"));
  const reference = readJson(join(out, "workflow", "reference-alignment", "comparison.json"));

  const expectedRealCaseScenes = [
    "country-ai-investment",
    "enterprise-ai-adoption",
    "consumer-ai-adoption",
    "attention-formula-manim",
    "attention-code-demo",
    "website-source-google-ai",
    "authorized-broll-edl",
    "ai-evidence-console-product-flow",
    "agent-adoption-rough-board",
    "three-depth-ai-stack",
    "lottie-ai-loop",
    "cover-delivery-qc",
  ];
  const sceneIds = new Set((brief.scenes || []).map((scene) => scene.id));
  for (const id of expectedRealCaseScenes) {
    assert(sceneIds.has(id), `real-case self-test brief missing scene: ${id}`, failures);
  }
  const sourceUrls = JSON.stringify(brief.sourceMaterials || []);
  for (const expectedUrl of [
    "https://hai.stanford.edu/ai-index/2026-ai-index-report",
    "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
    "https://arxiv.org/abs/1706.03762",
    "https://ai.google/",
  ]) {
    assert(sourceUrls.includes(expectedUrl), `real-case source material missing URL: ${expectedUrl}`, failures);
  }
  assert(!outputHasTemplateLeak(out), "output contains a visible template leak such as undefined, TODO, [object Object], null text, or unresolved placeholder", failures);
  assert(!outputHasViewerTestLanguage(out), "viewer-facing output must not describe the video as a test/self-test", failures);
  for (const failure of layoutContractFailures(out)) failures.push(failure);
  for (const failure of visualCapabilityContractFailures(out)) failures.push(failure);

  const expectedPluginActive = [
    "codex-video-workflow",
    "hyperframes",
    "hyperframes-cli",
    "creative-production",
    "remotion",
    "build-web-data-visualization",
    "product-design",
    "website-to-hyperframes",
    "hyperframes-registry",
    "canva",
    "video-use-style-footage-editing",
    "remotion-style-template-props",
    "reference-video-alignment-qc",
  ];
  for (const id of expectedPluginActive) {
    assert(capabilityById(plugin, id).active === true, `expected active plugin capability: ${id}`, failures);
  }
  assert(capabilityById(plugin, "gsap").active !== true, "gsap must remain inactive unless license-gated exception is explicitly accepted", failures);

  const expectedExternalActive = [
    "ffmpeg-professional-qc",
    "agentic-stage-gates",
    "html-render-inspection-loop",
    "raw-footage-editing",
    "template-props-contract",
    "data-or-math-motion-inserts",
    "reference-video-alignment-qc",
  ];
  for (const id of expectedExternalActive) {
    assert(externalById(external, id).active === true, `expected active external capability: ${id}`, failures);
  }

  const expectedLibraries = ["animejs-2d", "d3-diagram", "lottie-authored", "manim-insert", "roughjs-sketch", "threejs-depth"];
  const libraries = motion.motionLibraryRouting?.selectedLibraries || [];
  for (const id of expectedLibraries) {
    assert(libraries.includes(id), `expected selected motion library route: ${id}`, failures);
  }
  assert(/CSS\/SVG\/Web Animations API/i.test(motion.motionLibraryRouting?.defaultRenderer || ""), "motion routing must keep CSS/SVG/WAAPI as the default local renderer", failures);
  assert(motion.remotionMotionPrimitives?.sourcePlugin === "remotion", "motion template selection must include Remotion-inspired primitives", failures);
  assert((motion.remotionMotionPrimitives?.scenes || []).length === brief.scenes.length, "Remotion primitive scene count must match self-test scenes", failures);
  assert((grammar.components || []).every((component) => component.remotionPrimitive?.frameClock && component.remotionPrimitive?.easing), "motion grammar components must include Remotion primitive timing/easing", failures);
  const gsapScene = (grammar.components || []).find((component) => component.sceneId === "gsap-exception-check");
  assert(gsapScene?.motionLibraryDecision?.id === "gsap-exception", "gsap exception scene must record gsap-exception route", failures);
  assert(gsapScene?.motionLibraryDecision?.active === false, "gsap exception route must stay inactive without explicit acceptance", failures);

  assert(Array.isArray(design.pages) && design.pages.length === brief.scenes.length, "design-plan page count must match self-test scenes", failures);
  assert(runtimeConfig.schemaVersion === 1 && runtimeConfig.status === "locked-for-run", "runtime-config must be present and locked", failures);
  assert(runtimeConfig.resolved?.imageSource === design.imageSource, "runtime-config imageSource must match design-plan imageSource", failures);
  const expectedGenerationMode = fullRender ? "full-auto" : "semi-auto";
  assert(runtimeConfig.resolved?.generationMode === expectedGenerationMode, `self-test generation mode must be ${expectedGenerationMode}`, failures);
  assert(runtimeConfig.environmentCapabilities?.openaiApiKeyChangesDefaultImageSource === false, "OPENAI_API_KEY must not silently change the default image source", failures);
  assert(generation.schemaVersion === 1 && generation.status === "active-generation-mode-contract", "generation-mode-contract must be active", failures);
  assert(generation.defaultMode === "full-auto", "generation-mode-contract must keep ordinary topic/script intake on full-auto by default", failures);
  assert(generation.selectedMode === expectedGenerationMode, `workflow run must select ${expectedGenerationMode}`, failures);
  assert(generation.modeSelectionRule?.verticalOnlyWhenExplicit === true, "generation mode must preserve explicit-only vertical rule", failures);
  assert((generation.supportedModes || []).some((mode) => mode.id === "full-auto" && mode.default === true), "generation mode must support default full-auto rendering", failures);
  assert((generation.supportedModes || []).some((mode) => mode.id === "full-auto"), "generation mode must support explicit full-auto", failures);
  for (const stageId of ["prepare", "configure", "page-edit", "compose"]) {
    assert((generation.semiAutoPipeline?.stages || []).some((stage) => stage.id === stageId), `generation mode missing semi-auto stage: ${stageId}`, failures);
  }
  assert(generation.semiAutoPipeline?.pageEditSurface?.tdsContract?.T, "generation mode must expose TDS page edit contract", failures);
  assert(Number(generation.capabilityInventory?.captionStyleCount || 0) >= 68, "generation mode capability inventory must include 68 caption styles", failures);
  assert(Number(generation.capabilityInventory?.motionTemplateCount || 0) >= 6, "generation mode capability inventory must include motion templates", failures);
  assert(semiAutoConfig.status === "semi-auto-config-ready", "semi-auto-config.json must be ready", failures);
  assert(semiAutoConfig.generationMode?.defaultMode === "full-auto", "semi-auto config must preserve full-auto as the ordinary intake default", failures);
  assert(semiAutoConfig.baseParameters?.selected?.fps === 60, "semi-auto config must default frame rate to 60fps", failures);
  assert(semiAutoConfig.baseParameters?.selected?.resolution === "1920x1080", "semi-auto config must keep 1920x1080 as the stable default resolution", failures);
  assert(semiAutoConfig.baseParameters?.resolutionSupport?.supports2k === false, "semi-auto config must not claim 2K support before full-chain validation", failures);
  assert(Number(semiAutoConfig.captionStyles?.count || 0) >= 68, "semi-auto config must expose all caption styles", failures);
  assert((semiAutoConfig.captionStyles?.selected || []).length === 1, "semi-auto config must default to exactly one selected caption style", failures);
  assert(semiAutoConfig.captionStyles?.autoSubtitle?.enabledByDefault === true, "semi-auto config must default auto subtitles to enabled", failures);
  assert(semiAutoConfig.captionStyles?.autoSubtitle?.validation === "scripts/validate-caption-strategy-routing.mjs", "semi-auto config must tie auto subtitle validation to caption planner routing self-test", failures);
  assert(semiAutoConfig.captionStyles?.keywordHighlight?.enabledByDefault === true, "semi-auto config must default caption keyword highlight to enabled", failures);
  assert((semiAutoConfig.captionStyles?.keywordHighlight?.defaultTreatments || []).includes("highlightBackground"), "semi-auto config keyword highlight must support background highlight", failures);
  assert(Number(semiAutoConfig.motionTemplates?.count || 0) >= 6, "semi-auto config must expose all motion templates", failures);
  assert((semiAutoConfig.motionTemplates?.templates || []).every((template) => template.selected === true), "semi-auto config must default all motion templates to selected", failures);
  assert(Number(semiAutoConfig.motionCapabilities?.count || 0) >= 12, "semi-auto config must expose scene-level motion capabilities beyond the 6 templates", failures);
  assert((semiAutoConfig.motionCapabilities?.selected || []).length === semiAutoConfig.motionCapabilities?.count, "semi-auto config must default all motion capabilities to selected", failures);
  assert(Number(semiAutoConfig.colorSystems?.count || 0) >= 20, "semi-auto config must expose expanded premium color systems", failures);
  assert((semiAutoConfig.colorSystems?.modes || []).some((mode) => mode.id === "multi") && (semiAutoConfig.colorSystems?.modes || []).some((mode) => mode.id === "mono"), "semi-auto config must expose multi-color and monochrome palette tabs", failures);
  assert((semiAutoConfig.colorSystems?.modes || []).some((mode) => mode.id === "dark"), "semi-auto config must expose pure-black/deep palette choices", failures);
  assert((semiAutoConfig.colorSystems?.systems || []).some((system) => system.hasBlack === false), "semi-auto config must include palettes without black anchors", failures);
  assert((semiAutoConfig.colorSystems?.references || []).length >= 2, "semi-auto config must record web color-system references", failures);
  assert((semiAutoConfig.featureCompatibility?.rules || []).some((rule) => rule.id === "all-capabilities-composable"), "semi-auto config must encode motion, dynamic planning, personal-IP, whiteboard, and cover composability", failures);
  assert((semiAutoConfig.featureCompatibility?.rules || []).some((rule) => rule.id === "qc-resolves-layer-conflicts"), "semi-auto config must route personal-IP/motion/whiteboard layer conflicts to page-level QC", failures);
  assert((semiAutoConfig.featureCompatibility?.rules || []).some((rule) => rule.id === "cover-design-independent"), "semi-auto config must encode cover design as a parallel independent capability", failures);
  assert(semiAutoConfig.materialSources?.localVideoMaterials?.pickerRequiredWhenEnabled === true, "semi-auto config must require a local picker when local materials are enabled", failures);
  assert((semiAutoConfig.voiceModule?.languageModes || []).length >= 4, "semi-auto config must expose language and dialect voice modes", failures);
  assert((semiAutoConfig.voiceModule?.dialects || []).some((dialect) => dialect.id === "yue"), "semi-auto config must include a concrete Cantonese dialect option", failures);
  assert((semiAutoConfig.voiceModule?.dialects || []).length >= 4, "semi-auto config must include multiple concrete dialect options", failures);
  assert((semiAutoConfig.voiceModule?.genderOptions || []).some((option) => option.id === "female") && (semiAutoConfig.voiceModule?.genderOptions || []).some((option) => option.id === "male"), "semi-auto config must support female and male voice selection", failures);
  assert((semiAutoConfig.voiceModule?.speakerMatching || []).length >= 4, "semi-auto config must expose voice gender matching rules", failures);
  assert((semiAutoConfig.voiceModule?.speechStyles || []).length >= 8, "semi-auto config must expose all supported speech styles", failures);
  assert((semiAutoConfig.voiceModule?.languageModes || []).some((mode) => /dialect|accent/.test(mode.id || "")), "semi-auto config must include dialect/accent voice mode", failures);
  assert(semiAutoConfig.personalIp?.integration?.sourceFramework === "haloshin/ip-diagram-creator", "semi-auto config must use the referenced IP diagram creator framework", failures);
  assert(semiAutoConfig.personalIp?.source?.assetsAvailable === true, "semi-auto config must find local IP diagram creator preview assets", failures);
  assert(semiAutoConfig.personalIp?.integration?.handDrawnLayer, "semi-auto config must integrate hand-drawn personal-IP content", failures);
  assert((semiAutoConfig.personalIp?.presetIdentities || []).length >= 4, "semi-auto config must expose preset personal-IP identities", failures);
  if (semiAutoConfig.personalIp?.enabledByDefault || semiAutoConfig.personalIp?.imageCountPolicy?.mode === "capacity-controlled") {
    const policy = semiAutoConfig.personalIp?.imageCountPolicy || {};
    assert(Number(policy.totalPlannedImageJobs || policy.targetTotal || 0) === Number(policy.mainSceneJobs || policy.mainSceneImageJobs || 0), "semi-auto personal-IP image policy must not include proactive variants or repeated role-asset generation", failures);
    assert(Number(policy.sceneVariantsPerScriptUnit || policy.sceneVariantsPerPage || 0) === 0, "semi-auto personal-IP image policy must expose zero default variants", failures);
  }
  assert(semiAutoConfig.whiteboard?.enabledByDefault === true, "semi-auto config must include whiteboard drawing capability", failures);
  assert(semiAutoConfig.whiteboard?.sourceSkill === "gnipbao/codex-whiteboard-video-skill", "semi-auto config must identify the whiteboard skill adapter source", failures);
  assert(semiAutoConfig.whiteboard?.sourceEngine === "gnipbao/whiteboard-video-engine", "semi-auto config must identify the whiteboard rendering engine source", failures);
  assert(Boolean(semiAutoConfig.whiteboard?.previewArtifacts?.validatedPocVideo), "semi-auto config must expose the optional validated whiteboard POC preview slot", failures);
  if (semiAutoConfig.whiteboard?.previewArtifacts?.validatedPocVideo?.available === true) {
    assert(/whiteboard-layered-subtitle-top-demo\.mp4/.test(semiAutoConfig.whiteboard.previewArtifacts.validatedPocVideo.path || ""), "available whiteboard POC preview must point to the validated demo video", failures);
  }
  assert((semiAutoConfig.whiteboard?.layerOrder || []).some((layer) => layer.id === "subtitles"), "semi-auto config must record topmost subtitle layer for whiteboard", failures);
  assert((semiAutoConfig.whiteboard?.modes || []).length >= 4, "semi-auto config must expose whiteboard drawing modes", failures);
  assert(semiAutoConfig.pageEditing?.tds?.T && semiAutoConfig.pageEditing?.tds?.D && semiAutoConfig.pageEditing?.tds?.S, "semi-auto config must expose TDS editing dimensions", failures);
  const semiAutoHtml = readFileSync(join(out, "semi-auto-config.html"), "utf8");
  assert(!/\b(Vue(?:\.js)?|React(?:\.js)?|Next(?:\.js)?|Tailwind|GSAP|Three(?:\.js)?)\b/.test(semiAutoHtml), "semi-auto config page must not show framework/library labels", failures);
  assert((semiAutoHtml.match(/class="motion-table-card/g) || []).length >= 20, "semi-auto config page must render templates and scene-level motion as one compact table", failures);
  assert((semiAutoHtml.match(/data-motion-kind=/g) || []).length >= 6, "semi-auto config page must render distinct visual motion previews", failures);
  assert((semiAutoHtml.match(/data-capability-motion=/g) || []).length >= 12, "semi-auto config page must render scene-level visual motion previews", failures);
  assert(/data-motion-preview-modal/.test(semiAutoHtml) && (semiAutoHtml.match(/data-open-motion-preview/g) || []).length >= 20, "semi-auto config page must provide large motion preview modal triggers", failures);
  assert(/data-motion-pane="personal-ip"/.test(semiAutoHtml) && /data-motion-pane="whiteboard"/.test(semiAutoHtml), "semi-auto config page must move personal-IP and whiteboard into visual motion panes", failures);
  assert(!/<section class="panel" id="ip"/.test(semiAutoHtml) && !/<section class="panel" id="whiteboard"/.test(semiAutoHtml), "semi-auto config page must not render separate personal-IP or whiteboard sections", failures);
  assert((semiAutoHtml.match(/<input[^>]+data-feature-toggle="personal-ip"/g) || []).length === 1, "semi-auto config page must keep one personal-IP total switch", failures);
  assert((semiAutoHtml.match(/<input[^>]+data-feature-toggle="whiteboard"/g) || []).length === 1, "semi-auto config page must keep one whiteboard total switch", failures);
  assert((semiAutoHtml.match(/name="motion-template"/g) || []).length >= 6, "semi-auto config page must render motion templates as checkboxes", failures);
  assert((semiAutoHtml.match(/name="motion-capability"/g) || []).length >= 12, "semi-auto config page must render motion capabilities as checkboxes", failures);
  assert((semiAutoHtml.match(/class="palette-row/g) || []).length >= 20, "semi-auto config page must render compact expanded palette rows", failures);
  assert(/data-palette-tab="multi"/.test(semiAutoHtml) && /data-palette-tab="mono"/.test(semiAutoHtml), "semi-auto config page must render multi-color and monochrome palette tabs", failures);
  assert((semiAutoHtml.match(/class="caption-row/g) || []).length >= 68, "semi-auto config page must render caption styles as selectable rows", failures);
  assert((semiAutoHtml.match(/class="caption-check"/g) || []).length >= 68, "semi-auto config page must expose left-side caption checkboxes", failures);
  assert((semiAutoHtml.match(/data-caption-look=/g) || []).length >= 68, "semi-auto config page must render real per-style caption previews", failures);
  assert(/data-auto-caption-toggle/.test(semiAutoHtml) && /data-keyword-highlight-toggle/.test(semiAutoHtml), "semi-auto config page must render auto subtitle and keyword highlight toggles", failures);
  assert(new Set([...semiAutoHtml.matchAll(/data-caption-signature="([^"]+)"/g)].map((match) => match[1])).size >= 68, "semi-auto config page must render unique caption preview signatures", failures);
  assert(/界面工具/.test(semiAutoHtml) && /编辑叙事/.test(semiAutoHtml) && /节奏强调/.test(semiAutoHtml), "semi-auto config page must render Chinese caption group names", failures);
  assert(/data-config-locales="zh-CN en"/.test(semiAutoHtml), "semi-auto config page must declare Chinese and English locales", failures);
  assert((semiAutoHtml.match(/data-config-locale=/g) || []).length === 2, "semi-auto config page must render one Chinese and one English locale control", failures);
  assert(/Video Production Console/.test(semiAutoHtml) && /Page-level editing/.test(semiAutoHtml) && /Generate page review package/.test(semiAutoHtml), "semi-auto config page must embed English UI translations for the shell, page editing, and compose actions", failures);
  assert(/window\.codexVideoConfigI18n/.test(semiAutoHtml) && /supportedLocales: \['zh-CN', 'en'\]/.test(semiAutoHtml), "semi-auto config page must expose a deterministic runtime locale switch", failures);
  assert(/data-cover-logic-catalog/.test(semiAutoHtml), "semi-auto config page must expose the compact cover logic catalog", failures);
  assert((semiAutoHtml.match(/data-cover-logic-card=/g) || []).length === 12, "semi-auto config page must expose all 12 cover logic presets", failures);
  assert(/data-local-material-toggle/.test(semiAutoHtml) && /data-local-material-panel/.test(semiAutoHtml) && /webkitdirectory/.test(semiAutoHtml), "semi-auto config page must provide local material picker UI", failures);
  assert(/data-feature-toggle="personal-ip"/.test(semiAutoHtml) && /data-feature-toggle="motion"/.test(semiAutoHtml) && /data-feature-toggle="whiteboard"/.test(semiAutoHtml), "semi-auto config page must render personal-IP, motion, and whiteboard compatibility toggles", failures);
  assert(/data-ip-gallery/.test(semiAutoHtml) && /ip-diagram-creator/.test(semiAutoHtml), "semi-auto config page must render integrated IP diagram creator gallery preview", failures);
  assert((semiAutoHtml.match(/name="ip-identity"/g) || []).length >= 4, "semi-auto config page must render personal-IP preset identity choices", failures);
  assert(/data-ip-image-count-policy/.test(semiAutoHtml), "semi-auto config page must show personal-IP image count policy", failures);
  assert(/data-ip-execution-modes/.test(semiAutoHtml) && /data-ip-execution-mode="native-skill-direct-generation"/.test(semiAutoHtml), "semi-auto config page must expose the personal-IP ip-diagram-creator execution routes", failures);
  const personalIpNativeRouteRequested = semiAutoConfig.personalIp?.nativeDirectGeneration?.requestedByPersonalIpRoute === true
    || (semiAutoConfig.personalIp?.selectedExecutionModes || []).includes("native-skill-direct-generation");
  if (personalIpNativeRouteRequested) {
    assert(/<input[^>]+name="ip-execution-mode"[^>]+value="native-skill-direct-generation"[^>]+checked/.test(semiAutoHtml), "semi-auto config page must default personal-IP to native-skill-direct-generation", failures);
    assert(/makePersonalIp=auto/.test(semiAutoHtml) && /handDrawnAnimation=subtle/.test(semiAutoHtml), "semi-auto config page must expose personal-IP and hand-drawn execution choices", failures);
  }
  assert(/data-whiteboard-skill-preview/.test(semiAutoHtml) && /whiteboard-mode-row/.test(semiAutoHtml), "semi-auto config page must render the validated whiteboard skill preview", failures);
  assert(!/<label class="whiteboard-mode-row/.test(semiAutoHtml), "semi-auto config page must keep whiteboard modes as preview cards rather than independent checkboxes", failures);
  assert(/codex-whiteboard-video-skill/.test(semiAutoHtml) && /whiteboard-video-engine/.test(semiAutoHtml), "semi-auto config page must identify the whiteboard skill and engine route", failures);
  if (semiAutoConfig.whiteboard?.previewArtifacts?.validatedPocVideo?.available === true) {
    assert(/whiteboard-layered-subtitle-top-demo\.mp4/.test(semiAutoHtml), "semi-auto config page must use the validated whiteboard POC video preview when installed", failures);
  } else {
    assert(!/<video[^>]+src=""/.test(semiAutoHtml), "semi-auto config page must not render a broken empty whiteboard video preview", failures);
  }
  assert((semiAutoHtml.match(/data-voice-mode=/g) || []).length >= 4, "semi-auto config page must render voice language mode choices", failures);
  assert(/select name="dialect"/.test(semiAutoHtml), "semi-auto config page must render concrete dialect selector", failures);
  assert((semiAutoHtml.match(/name="voice-gender"/g) || []).length >= 2, "semi-auto config page must render male/female voice choices", failures);
  assert((semiAutoHtml.match(/class="speech-chip/g) || []).length >= 8, "semi-auto config page must render speech style choices", failures);
  assert(/方言\s*\/\s*口音/.test(semiAutoHtml), "semi-auto config page must show dialect/accent voice option", failures);
  assert(captionStyle.status === "active-premium-caption-style-plan", "caption-style-plan must be active", failures);
  assert(captionStyle.catalogReference === "assets/caption-style-catalog.json", "caption-style-plan must reference the caption catalog", failures);
  assert(captionStyle.strategyReference === "references/creative-subtitle-strategy.md", "caption-style-plan must reference the creative subtitle strategy", failures);
  assert(captionStyle.autoSubtitle?.enabledByDefault === true, "caption-style-plan must default auto subtitle selection to enabled", failures);
  assert(captionStyle.keywordHighlight?.enabledByDefault === true, "caption-style-plan must default keyword highlight to enabled", failures);
  assert((captionCatalog.styles || []).length >= 68, "caption-style catalog must include the full creative style set", failures);
  assert((captionStyle.scenes || []).length === brief.scenes.length, "caption-style-plan scene count must match self-test scenes", failures);
  assert((captionStyle.styleCatalog || []).length >= 68, "caption-style-plan must include reusable caption styles from the catalog", failures);
  assert((captionStyle.scenes || []).every((scene) => scene.safeArea === "bottom-caption-band" && scene.displayMode === "single-line-sequential"), "caption-style-plan must preserve bottom safe area and single-line display", failures);
  assert((captionStyle.scenes || []).every((scene) => scene.selectedStyleId && scene.fallbackStyleId && scene.sceneJob && scene.priorityGroups && scene.emphasisPlan?.mode === "keyword-visual-emphasis"), "caption-style-plan scenes must include selected style, fallback style, scene job, priority groups, and keyword emphasis plan", failures);
  assert((design.pages || []).every((page) => page.captionStyle?.layerClass), "design-plan pages must carry caption style bindings", failures);
  assert(pageDecision.schemaVersion === 1, "page-decision-contract must use schemaVersion 1", failures);
  assert(pageDecision.status === "active-page-decision-contract", "page-decision-contract must be active", failures);
  assert(pageDecision.coverage?.allPagesAnswerFiveQuestions === true, "page-decision-contract must mark all five questions answered", failures);
  assert((pageDecision.pages || []).length === brief.scenes.length, "page-decision-contract page count must match self-test scenes", failures);
  for (const questionId of ["contentAnswer", "contentDesignAnswer", "interactionAnswer", "animationAnswer", "decisionOwnershipAnswer"]) {
    assert((pageDecision.decisionQuestions || []).some((question) => question.id === questionId), `page-decision-contract missing question: ${questionId}`, failures);
    assert((pageDecision.pages || []).every((page) => page[questionId]), `page-decision-contract pages missing answer: ${questionId}`, failures);
  }
  assert((pageDecision.pages || []).every((page, index) => page.sceneId === design.pages[index]?.id), "page-decision-contract scene order must match design-plan", failures);
  assert((pageDecision.pages || []).every((page) => page.contentAnswer?.primaryMessage && page.contentAnswer?.timingOwner), "page-decision-contract content answers must name message and timing owner", failures);
  assert((pageDecision.pages || []).every((page) => page.contentDesignAnswer?.layoutVariant && page.contentDesignAnswer?.styleArchetype), "page-decision-contract design answers must name layout and style", failures);
  assert((pageDecision.pages || []).every((page) => /MP4/i.test(page.interactionAnswer?.finalOutputMode || "") && page.interactionAnswer?.interactionFeeling), "page-decision-contract interaction answers must describe MP4-safe interaction", failures);
  assert((pageDecision.pages || []).every((page) => page.animationAnswer?.selectedMotionTemplate && page.animationAnswer?.motionVerb && page.animationAnswer?.timingOwner), "page-decision-contract animation answers must name template, verb, and timing owner", failures);
  assert((pageDecision.pages || []).every((page) => page.decisionOwnershipAnswer?.contentDecisionOwner && page.decisionOwnershipAnswer?.designDecisionOwner && page.decisionOwnershipAnswer?.animationDecisionOwner), "page-decision-contract ownership answers must name planner/design/motion owners", failures);
  assert(retention.schemaVersion === 1, "retention-structure-contract must use schemaVersion 1", failures);
  assert(retention.status === "active-retention-structure-contract", "retention-structure-contract must be active", failures);
  assert(retention.sourceReference === "references/retention-structure.md", "retention-structure-contract must reference the retention methodology", failures);
  assert(retention.method === "RETAIN", "retention-structure-contract must use RETAIN", failures);
  assert((retention.axes || []).length === 6, "retention-structure-contract must include all six RETAIN axes", failures);
  assert((retention.sceneContracts || []).length === brief.scenes.length, "retention scene contracts must match self-test scenes", failures);
  assert(retention.firstFrame?.sceneId === design.pages?.[0]?.id && retention.firstFrame?.promiseText, "retention first frame must bind the opening page and promise", failures);
  assert(retention.firstThirtySecondContract?.pass === true && retention.firstThirtySecondContract?.firstProofSceneId, "retention first 30 seconds must include a proof route", failures);
  assert(retention.evidenceCadence?.pass === true && (retention.evidenceCadence?.evidenceBeats || []).length >= brief.scenes.length, "retention evidence cadence must cover all scenes", failures);
  assert(retention.progressAndPayoff?.pass === true && retention.progressAndPayoff?.finalSceneId === design.pages?.[design.pages.length - 1]?.id, "retention progress and payoff must bind the final scene", failures);
  assert((retention.qcExpectations || []).includes("progressAndPayoffPlanned"), "retention contract must list QC expectations", failures);
  assert(visualAudit.status === "pass", "visual-relevance-audit must pass", failures);
  assert((visualManifest.insertedVisualAssets || []).length === brief.scenes.length, "visual asset manifest must include every scene", failures);
  assert(cover.defaultCoverEngine === "image2-integrated-typography-cover", "cover must use Image2 integrated typography cover engine", failures);
  assert(cover.sharedContentPromiseMultiPlatformVariants === true, "cover must preserve one truthful content promise across platform variants", failures);
  assert(cover.singleDesignMultiResolution === false, "cover must not claim simple single-design resizing when target-ratio native Image 2 assets are required", failures);
  assert(cover.platformSpecificDesignsGenerated === true, "cover must record platform-specific strategy variants by default", failures);
  assert((cover.platformTargets || []).length >= 8, "cover must include platform-specific targets", failures);
  assert(cover.coverSizeSelection?.finalDeliveryDirectory === "最终成品", "cover size selection must use the topic-scoped final cover directory", failures);
  assert(cover.coverSizeSelection?.humanSelectionContainsOnlyUploadReady === true, "final cover directory must contain only upload-ready cover files plus explanatory manifests", failures);
  assert(cover.coverSizeSelection?.nonUploadReadyVisualFilesCopied === false, "non-upload-ready target-ratio cover previews must not be copied into final delivery", failures);
  assert((cover.coverSizeSelection?.entries || []).some((entry) => entry.group === "横版16比9"), "cover size selection must group horizontal covers by Chinese aspect label", failures);
  if ((cover.coverSizeSelection?.allEntriesUploadReady ?? false) === true) {
    assert((cover.rootOutputCopies || []).length >= 8, "upload-ready cover packages must include user-facing final cover copies", failures);
  } else {
    assert((cover.coverSizeSelection?.needsRegeneration || []).length >= 1, "dryrun/non-native cover packages must list targets needing native Image 2 regeneration", failures);
  }
  assert((cover.rootOutputCopies || []).every((file) => /^最终成品\//.test(file)), "cover copies must live under the topic-scoped final cover directory", failures);
  assert(coverQc.promptQualityPass === true, "cover Image2 prompt QC must pass", failures);
  for (const id of ["country-ai-investment", "enterprise-ai-adoption", "consumer-ai-adoption"]) {
    assert((dataSource.scenesNeedingData || []).includes(id), `data source plan must include real data scene: ${id}`, failures);
    assert((dataSeries.series || []).some((series) => series.sceneId === id && series.points.length > 0), `data series must include measured chart points for: ${id}`, failures);
  }
  assert((dataSource.scenesNeedingMathMotion || []).includes("attention-formula-manim"), "data source plan must include attention-formula-manim", failures);
  assert((dataMotion.scenes || []).some((scene) => scene.sceneId === "attention-formula-manim" && scene.chartType === "formula-or-geometry-motion"), "data motion plan must include attention formula motion scene", failures);
  assert((rawInventory.entries || []).some((entry) => entry.exists && /\.mp4$/i.test(entry.path || "") && Number(entry.bytes || 0) > 1000), "raw footage inventory must see a real authorized mp4 fixture, not a text placeholder", failures);
  assert(templateProps.status === "active", "template props contract must be active", failures);
  assert(variants.status === "variants-declared" && variants.variantCount >= 2, "variant render plan must include declared variants", failures);
  assert(["reference-declared", "awaiting-reference-media"].includes(reference.status), "reference alignment comparison must be written", failures);

  if (fullRender) {
    const fullFiles = [
      "final.mp4",
      "renders/final.mp4",
      "logs/qc.json",
      "logs/ffprobe.json",
      "logs/blackdetect.log",
      "logs/volumedetect.log",
      "logs/silencedetect.log",
      "workflow/voice-direction.json",
      "workflow/voice-subtitle-manifest.json",
      "workflow/script-fidelity.json",
      "workflow/final-delivery-paths.json",
      "workflow/sync-timecode-plan.json",
      "script/subtitles.srt",
      "script/subtitle-cue-narration-segments.json",
    ];
    for (const file of fullFiles) assert(fileExists(out, file), `missing full-render artifact: ${file}`, failures);
    if (fileExists(out, "logs/qc.json")) {
      const qc = readJson(join(out, "logs/qc.json"));
      assert(qc.pass === true, "full-render logs/qc.json must pass", failures);
      const scriptFidelity = readJson(join(out, "workflow", "script-fidelity.json"));
      const deliveryPaths = readJson(join(out, "workflow", "final-delivery-paths.json"));
      const deliveryManifest = readJson(join(out, "delivery-manifest.json"));
      assert(scriptFidelity.pass === true && scriptFidelity.failures.length === 0, "full-render口播稿 fidelity audit must pass", failures);
      assert(deliveryPaths.finalVideoPath && existsSync(deliveryPaths.finalVideoPath), "full-render path contract must expose an existing title-named final video", failures);
      assert(deliveryManifest.finalVideoPath === deliveryPaths.finalVideoPath, "delivery manifest and final path contract must agree", failures);
      assert(deliveryManifest.finalMp4 === deliveryManifest.finalCopy && deliveryManifest.sameDirectoryDelivery?.video === deliveryManifest.finalCopy, "delivery manifest final video aliases must all point to the title-named root MP4", failures);
    }
  }

  return {
    failures,
    inventory: {
      output: out,
      selectedTemplate: motion.selectedTemplate,
      selectedMotionLibraries: libraries,
      activePluginCapabilities: plugin.selectedActiveCapabilities || [],
      activeExternalCapabilities: (external.capabilities || []).filter((capability) => capability.active).map((capability) => capability.id),
      sceneCount: design.pages.length,
      coverTargets: (cover.platformTargets || []).map((target) => target.id),
      renderMode: fullRender ? "full-render" : "cover-only",
    },
  };
}

function writeMarkdownReport(report) {
  const lines = [
    "# Codex Video Workflow Full Framework Self-Test",
    "",
    `Status: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    `Output root: ${report.outRoot}`,
    `Mode: ${report.fullRender ? "full-render" : "cover-only"}`,
    "",
    "## Capability Inventory",
    "",
    "```json",
    JSON.stringify(report.inventory || {}, null, 2),
    "```",
    "",
    "## Commands",
    "",
    "| Step | Status | Command |",
    "| --- | --- | --- |",
    ...report.commands.map((command) => `| ${command.id} | ${command.ok ? "PASS" : command.required ? "FAIL" : "WARN"} | \`${command.command.replaceAll("|", "\\|")}\` |`),
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((failure) => `- ${failure}`) : ["- none"]),
    "",
  ];
  writeFileSync(join(report.outRoot, "full-framework-self-test-report.md"), lines.join("\n"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const outRoot = resolve(args.outRoot);
  if (!args.keepExisting && existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });
  ensureDir(outRoot);
  const report = {
    ok: false,
    generatedAt: new Date().toISOString(),
    outRoot,
    fullRender: args.fullRender,
    commands: [],
    failures: [],
    inventory: null,
  };
  const { briefPath } = buildResolvedBrief({ outRoot, imageSource: args.imageSource });
  report.brief = briefPath;

  runCommand({ id: "node-check-workflow", command: "node", args: ["--check", rel(workflowScript)] }, report);
  runCommand({ id: "node-check-routing-self-test", command: "node", args: ["--check", rel(routeSelfTestScript)] }, report);
  runCommand({ id: "node-check-generation-mode-default-self-test", command: "node", args: ["--check", rel(generationModeDefaultSelfTest)] }, report);
  runCommand({ id: "node-check-personal-ip-semantic-scene-planning", command: "node", args: ["--check", rel(personalIpSemanticScenePlanningSelfTest)] }, report);
  runCommand({ id: "node-check-personal-ip-no-downgrade", command: "node", args: ["--check", rel(personalIpNoDowngradeSelfTest)] }, report);
  runCommand({ id: "node-check-full-framework-self-test", command: "node", args: ["--check", rel(join(skillRoot, "scripts", "self-test-full-framework.mjs"))] }, report);
  runCommand({ id: "node-check-semi-auto-config-builder", command: "node", args: ["--check", rel(semiAutoConfigBuilder)] }, report);
  runCommand({ id: "node-check-page-review-builder", command: "node", args: ["--check", rel(pageReviewBuilder)] }, report);
  if (!args.validateExistingPackage) {
    runCommand({
      id: "generation-mode-default-self-test",
      command: "node",
      args: [rel(generationModeDefaultSelfTest), rel(join(outRoot, "generation-mode-default"))],
    }, report);
    runCommand({
      id: "personal-ip-semantic-scene-planning-self-test",
      command: "node",
      args: [rel(personalIpSemanticScenePlanningSelfTest)],
    }, report);
    runCommand({
      id: "personal-ip-no-downgrade-self-test",
      command: "node",
      args: [rel(personalIpNoDowngradeSelfTest), rel(join(outRoot, "personal-ip-no-downgrade"))],
    }, report);
    runCommand({
      id: "route-coverage-self-test",
      command: "node",
      args: [rel(routeSelfTestScript), "--out-root", rel(join(outRoot, "route-coverage"))],
    }, report);
  }
  if (!args.validateExistingPackage && !args.skipHtmlTemplateValidation) {
    runCommand({ id: "html-motion-template-validation", command: "node", args: [rel(htmlTemplateValidator)] }, report);
  }

  const packageOut = join(outRoot, args.fullRender ? "full-render-package" : "cover-only-package");
  const workflowArgs = [
    rel(workflowScript),
    "--brief", rel(briefPath),
    "--out", rel(packageOut),
    "--no-open-delivery-page",
    "--image-source", args.imageSource,
  ];
  if (Number.isFinite(args.maxVisualFrames) && args.maxVisualFrames >= 3) {
    workflowArgs.push("--max-visual-frames", String(args.maxVisualFrames));
  }
  if (args.fullRender) workflowArgs.push("--generation-mode", "full-auto");
  if (!args.fullRender) workflowArgs.push("--generation-mode", "semi-auto", "--cover-only");
  if (!args.validateExistingPackage) {
    runCommand({ id: args.fullRender ? "full-framework-full-render" : "full-framework-cover-only", command: "node", args: workflowArgs }, report);
  } else {
    report.commands.push({
      id: "reuse-existing-package",
      command: `reuse existing ${rel(packageOut)}`,
      cwd: workspace,
      status: existsSync(packageOut) ? 0 : 1,
      ok: existsSync(packageOut),
      required: true,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      stdout: "",
      stderr: existsSync(packageOut) ? "" : `missing package: ${packageOut}`,
    });
    if (!existsSync(packageOut)) report.failures.push(`reuse-existing-package failed with status 1`);
  }

  if (existsSync(packageOut)) {
    runCommand({
      id: "semi-auto-config-page",
      command: "node",
      args: [rel(semiAutoConfigBuilder), "--package", rel(packageOut), "--out", rel(join(packageOut, "semi-auto-config.html"))],
    }, report);
  }

  const validation = validateFullFrameworkOutput({ out: packageOut, briefPath, fullRender: args.fullRender });
  report.failures.push(...validation.failures);
  report.inventory = validation.inventory || null;

  runCommand({ id: "voice-pause-policy-validation", command: "node", args: [rel(voicePauseValidator)] }, report);
  runCommand({
    id: "skill-quick-validate",
    command: "python3",
    args: [quickValidateScript, rel(skillRoot)],
  }, report);

  if (args.fullRender && existsSync(packageOut)) {
    runCommand({ id: "plugin-routing-validator", command: "node", args: [rel(pluginValidator), "--out", rel(packageOut), "--brief", rel(briefPath)] }, report);
    runCommand({ id: "subtitle-cover-validator", command: "node", args: [rel(subtitleCoverValidator), "--out", rel(packageOut), "--brief", rel(briefPath)] }, report);
  }

  report.ok = report.failures.length === 0 && report.commands.filter((command) => command.required).every((command) => command.ok);
  writeJson(join(outRoot, "full-framework-self-test-report.json"), report);
  writeMarkdownReport(report);
  console.log(JSON.stringify({
    ok: report.ok,
    outRoot,
    report: join(outRoot, "full-framework-self-test-report.json"),
    markdown: join(outRoot, "full-framework-self-test-report.md"),
    packageOut,
    inventory: report.inventory,
    failures: report.failures,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
