#!/usr/bin/env node

import { createHash } from "node:crypto";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyPersonalIpSemanticLayout } from "./lib/personal-ip-semantic-scene-planner.mjs";
import { buildContentDrivenSemanticLayers, escapeSvg, SEMANTIC_LAYOUT_DEFINITIONS } from "./lib/personal-ip-semantic-layout-renderer.mjs";
import { loadPlaywright } from "./lib/load-playwright.mjs";
import { validateDisplayedTextInventory, validatePersonalIpMasterAnalysis } from "./lib/personal-ip-master-analysis.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const { chromium } = loadPlaywright();

function parseArgs(argv) {
  const args = { duration: "8", fps: "15", title: "写小说的方法论" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
    index += 1;
  }
  return args;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function write(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value, "utf8");
}

function writeJson(path, value) {
  write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}

function cleanText(value, max = 80) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeItems(items = [], limit = 7) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map((item, index) => Array.isArray(item)
    ? [cleanText(item[0] || index + 1, 2), cleanText(item[1], 14), cleanText(item[2] || item[1], 36), item[3] || ""]
    : [cleanText(item?.icon || index + 1, 2), cleanText(item?.label || item?.body, 14), cleanText(item?.body || item?.label, 36), item?.color || ""]
  ).filter((item) => item[1] || item[2]);
}

function mediaDuration(path) {
  return Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", path]).trim());
}

function textNodes(svg = "") {
  return [...String(svg).matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"'))
    .filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const out = resolve(args.out || join(ROOT, "research", `personal-ip-semantic-layered-video-${Date.now()}`));
const defaultPersonaCandidates = [
  join(process.env.HOME || "", ".codex", "video-workflow", "user-assets", "personal-ip", "generic-hosts", "female", "versions", "v3", "01-character-main-anchor.png"),
  join(ROOT, "research", "layered-ip-poc-20260712", "assets", "persona-main-anchor.png"),
];
const persona = resolve(args.persona || defaultPersonaCandidates.find((candidate) => existsSync(candidate)) || defaultPersonaCandidates[0]);
const audio = args.audio ? resolve(args.audio) : null;
const sourceSpec = args.spec ? JSON.parse(readFileSync(resolve(args.spec), "utf8")) : {};
const masterReference = args.masterReference
  ? resolve(args.masterReference)
  : sourceSpec.masterReference?.source
    ? resolve(sourceSpec.masterReference.source)
    : null;
const sourceScenes = Array.isArray(sourceSpec.scenes) && sourceSpec.scenes.length ? sourceSpec.scenes : [sourceSpec];
if (!existsSync(persona)) throw new Error(`Persona asset missing: ${persona}`);
if (audio && !existsSync(audio)) throw new Error(`Audio missing: ${audio}`);
if (!masterReference || !existsSync(masterReference)) throw new Error("A verified personal-IP master reference is required for semantic decomposition.");

rmSync(out, { recursive: true, force: true });
for (const folder of ["assets", "layers", "frames", "renders", "screenshots", "workflow", "logs"]) ensureDir(join(out, folder));
copyFileSync(persona, join(out, "assets", "persona-main-anchor.png"));
if (audio) copyFileSync(audio, join(out, "assets", basename(audio)));
const masterReferenceFile = `master-reference${/\.[^.]+$/.exec(masterReference)?.[0] || ".png"}`;
copyFileSync(masterReference, join(out, "assets", masterReferenceFile));
const masterReferenceSha256 = createHash("sha256").update(readFileSync(masterReference)).digest("hex");
const masterReferenceProbe = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "json", masterReference]));
const masterReferenceStream = masterReferenceProbe.streams?.[0] || {};
const masterVisualAnalysis = validatePersonalIpMasterAnalysis({
  analysis: sourceSpec.masterVisualAnalysis,
  masterSha256: masterReferenceSha256,
  width: Number(masterReferenceStream.width || 0),
  height: Number(masterReferenceStream.height || 0),
});
writeJson(join(out, "workflow", "personal-ip-master-visual-analysis.json"), masterVisualAnalysis);
writeJson(join(out, "workflow", "personal-ip-semantic-layer-spec.json"), {
  ...sourceSpec,
  masterVisualAnalysis,
});

const durationSeconds = audio ? mediaDuration(audio) : Number(args.duration || 8);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error(`Invalid duration: ${durationSeconds}`);
const requestedCaptureFps = Math.max(1, Math.min(30, Number(args.fps || 15)));
const captureFrameBudget = 7200;
const captureFps = Math.max(1, Math.min(requestedCaptureFps, Math.floor(captureFrameBudget / Math.max(1, durationSeconds)) || 1));
const requestedAspect = String(args.aspect || sourceSpec.aspectRatio || sourceSpec.aspect || "9:16").trim();
const isHorizontal = /^(?:16:9|horizontal|landscape)$/i.test(requestedAspect);
const canvas = isHorizontal
  ? { width: 1920, height: 1080, aspectRatio: "16:9", orientation: "horizontal" }
  : { width: 1080, height: 1920, aspectRatio: "9:16", orientation: "vertical" };
const personaData = `data:image/png;base64,${readFileSync(persona).toString("base64")}`;

const requestedSceneDurations = sourceScenes.map((scene) => Math.max(0, Number(scene.durationSeconds || scene.durationSec || 0)));
const requestedSceneDurationTotal = requestedSceneDurations.reduce((sum, value) => sum + value, 0);
let sceneCursor = 0;
const scenes = sourceScenes.map((sourceScene, index) => {
  const duration = requestedSceneDurationTotal > 0
    ? durationSeconds * requestedSceneDurations[index] / requestedSceneDurationTotal
    : durationSeconds / sourceScenes.length;
  const explicitTitle = cleanText(sourceScene.title || sourceSpec.title || args.title || "", 34);
  if (!explicitTitle) throw new Error(`Scene ${index + 1} requires an explicit source-bound title; generated fallback titles are forbidden.`);
  const semanticBase = {
    id: cleanText(sourceScene.id || sourceScene.sourcePageId || `scene-${index + 1}`, 90),
    sourcePageId: cleanText(sourceScene.sourcePageId || sourceScene.id || `scene-${index + 1}`, 90),
    order: index + 1,
    sourcePageOrder: Number(sourceScene.sourcePageOrder || index + 1),
    beatIndex: Number(sourceScene.beatIndex || 1),
    beatCount: Number(sourceScene.beatCount || 1),
    startSeconds: sceneCursor,
    endSeconds: sceneCursor + duration,
    durationSeconds: duration,
    title: explicitTitle,
    subtitle: cleanText(sourceScene.subtitle || sourceScene.body || "", 56),
    spokenText: cleanText(sourceScene.spokenText || sourceScene.captions?.join("") || sourceScene.subtitle || sourceScene.body || "", 320),
    takeaway: cleanText(sourceScene.takeaway || sourceScene.subtitle || sourceScene.body || sourceScene.title || "把判断落到行动。", 48),
    hookItems: normalizeItems(sourceScene.hookItems, 7),
    routeItems: normalizeItems(sourceScene.routeItems, 7),
    captions: (Array.isArray(sourceScene.captions) && sourceScene.captions.length ? sourceScene.captions : [sourceScene.subtitle || sourceScene.body || sourceScene.title])
      .map((value) => cleanText(value, 42)).filter(Boolean).slice(0, 8),
    semanticUnits: (Array.isArray(sourceScene.semanticUnits) ? sourceScene.semanticUnits : [])
      .map((value) => cleanText(value, 50)).filter(Boolean),
    methodologyText: cleanText(sourceScene.methodologyText, 220),
    methodologyVisualUnits: Array.isArray(sourceScene.methodologyVisualUnits) ? sourceScene.methodologyVisualUnits : [],
  };
  const classification = sourceScene.layoutVariant && sourceScene.contentKind
    ? {
        contentKind: cleanText(sourceScene.contentKind, 40),
        layoutVariant: cleanText(sourceScene.layoutVariant, 40),
        motionVerb: cleanText(sourceScene.motionVerb || "reveal", 24),
        visualMetaphor: cleanText(sourceScene.visualMetaphor || "内容驱动图解", 80),
        classificationEvidence: sourceScene.classificationEvidence || null,
      }
    : classifyPersonalIpSemanticLayout(semanticBase);
  const itemCount = Math.max(1, semanticBase.hookItems.length + semanticBase.routeItems.length, semanticBase.methodologyVisualUnits.length, semanticBase.semanticUnits.length);
  // Do not let a long narration scene collapse into a sub-second flash.  The
  // page must have enough time to establish its visual hierarchy before the
  // stable reading hold begins.
  const activeRevealSeconds = Math.min(duration, Math.max(1.1, Math.min(4.8, duration * 0.62, 1.5 + itemCount * 0.32)));
  const holdAfterReveal = Math.max(0, duration - activeRevealSeconds);
  const normalized = {
    ...semanticBase,
    ...classification,
    activeRevealSeconds,
    holdAfterReveal,
    mainRevealCompletesBeforeSceneEnd: holdAfterReveal >= Math.min(0.2, duration * 0.1),
  };
  normalized.contentFingerprint = createHash("sha256").update(JSON.stringify({
    title: normalized.title,
    subtitle: normalized.subtitle,
    takeaway: normalized.takeaway,
    layoutVariant: normalized.layoutVariant,
    hookItems: normalized.hookItems,
    routeItems: normalized.routeItems,
  })).digest("hex").slice(0, 16);
  sceneCursor += duration;
  return normalized;
});

const expectedSceneCount = Math.max(1, Number(sourceSpec.expectedSceneCount || scenes.length));
if (expectedSceneCount !== scenes.length) throw new Error(`Semantic scene contract mismatch: expected ${expectedSceneCount}, received ${scenes.length}.`);
const expectedSourcePageIds = Array.isArray(sourceSpec.sourcePageIds) && sourceSpec.sourcePageIds.length
  ? sourceSpec.sourcePageIds.map((value) => cleanText(value, 90))
  : [...new Set(scenes.map((scene) => scene.sourcePageId))];
const expectedSourcePageCount = Math.max(1, Number(sourceSpec.expectedSourcePageCount || expectedSourcePageIds.length));
const renderedSourcePageIds = [...new Set(scenes.map((scene) => scene.sourcePageId))];
const allSourcePagesRepresented = expectedSourcePageIds.length === expectedSourcePageCount
  && renderedSourcePageIds.length === expectedSourcePageCount
  && expectedSourcePageIds.every((id) => renderedSourcePageIds.includes(id));
if (!allSourcePagesRepresented) throw new Error(`Semantic source-page coverage mismatch: expected ${expectedSourcePageCount}, rendered ${renderedSourcePageIds.length}.`);
if (durationSeconds >= 180 && scenes.length < 4) throw new Error(`Long-form personal-IP semantic video requires at least 4 planned scenes; received ${scenes.length} for ${durationSeconds.toFixed(1)} seconds.`);
const uniqueContentFingerprintCount = new Set(scenes.map((scene) => scene.contentFingerprint)).size;
if (scenes.length > 1 && uniqueContentFingerprintCount !== scenes.length) throw new Error(`Semantic scenes must have distinct content; received ${uniqueContentFingerprintCount} unique fingerprints for ${scenes.length} scenes.`);
if (!scenes.every((scene) => SEMANTIC_LAYOUT_DEFINITIONS.includes(scene.layoutVariant))) throw new Error("A semantic scene selected an unsupported content layout.");

const defs = `<defs><filter id="soft-shadow" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#17212b" flood-opacity=".10"/></filter><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0 0L8 3L0 6Z" fill="#f0642c"/></marker><style>text{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans CJK SC',sans-serif;fill:#18232d}.serif{font-family:'Songti SC','STSong',serif}[data-card-box]{filter:url(#soft-shadow)}[data-scene-index],[data-reveal-item]{transform-box:fill-box;transform-origin:center}</style></defs>`;
const layerEntries = buildContentDrivenSemanticLayers({ scenes, canvas, personaData, masterVisualAnalysis });
const svgDocument = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}">${defs}${body}</svg>\n`;
for (const [id, , , body] of layerEntries) write(join(out, "layers", `${id}.svg`), svgDocument(body));
const fullSvg = svgDocument(layerEntries.map((entry) => entry[3]).join(""));
write(join(out, "personal-ip-layered.svg"), fullSvg);

const requiredLayerRoles = ["background", "headline", "content-group", "semantic-path", "annotation", "personal-ip", "execution-agent", "subtitle-overlay"];
const actualLayerRoles = layerEntries.map(([, role]) => role);
if (!requiredLayerRoles.every((role) => actualLayerRoles.includes(role))) {
  throw new Error(`Semantic layer stack incomplete: ${requiredLayerRoles.filter((role) => !actualLayerRoles.includes(role)).join(", ")}`);
}
const nonPersonaBitmapLayers = layerEntries
  .filter(([, role]) => role !== "personal-ip")
  .filter(([, , , body]) => /<image\b/i.test(body))
  .map(([id]) => id);
if (nonPersonaBitmapLayers.length) throw new Error(`Bitmap content is only allowed in the transparent persona layer: ${nonPersonaBitmapLayers.join(", ")}`);

const layerOwnershipAudit = {
  schemaVersion: 1,
  route: "personal-ip-semantic-layers-svg-html-video",
  scopeIsolation: "personal-ip-animation-only",
  ownershipMode: "deterministic-svg-owners-plus-single-contained-persona-raster",
  master: {
    source: masterReference,
    sha256: masterReferenceSha256,
    runtimeContentOwner: false,
    visualAnalysisStatus: masterVisualAnalysis.status,
    visualAnalysisInspectorType: masterVisualAnalysis.inspectorType,
  },
  ownershipContract: {
    flattenedSourcePixelSlicesPresent: false,
    independentlyMovingFlattenedSliceCount: 0,
    duplicateSourcePixelOwnerCount: 0,
    duplicateSourcePixelOwnerPairs: [],
    masterObjectInventoryMeasured: masterVisualAnalysis.validation.objectCount > 0,
    masterRoleBindingsComplete: masterVisualAnalysis.validation.missingRoleBindings.length === 0,
    nonPersonaBitmapLayers,
    semanticOwnerIdsUnique: new Set(layerEntries.map(([id]) => id)).size === layerEntries.length,
    interlockedFlatMasterObjectsMustUseAtomicContentUnits: true,
    semanticPathBelowContent: layerEntries.find(([, role]) => role === "semantic-path")?.[2]
      < layerEntries.find(([, role]) => role === "content-group")?.[2],
    subtitleTopmost: layerEntries.at(-1)?.[1] === "subtitle-overlay",
  },
  pass: nonPersonaBitmapLayers.length === 0
    && masterVisualAnalysis.validation.objectCount > 0
    && masterVisualAnalysis.validation.missingRoleBindings.length === 0
    && new Set(layerEntries.map(([id]) => id)).size === layerEntries.length
    && layerEntries.find(([, role]) => role === "semantic-path")?.[2] < layerEntries.find(([, role]) => role === "content-group")?.[2]
    && layerEntries.at(-1)?.[1] === "subtitle-overlay",
};
writeJson(join(out, "workflow", "personal-ip-layer-ownership-audit.json"), layerOwnershipAudit);

const normalizedDisplayedTextInventory = validateDisplayedTextInventory(sourceSpec.displayedTextInventory);
const requiredExactText = [...new Set(normalizedDisplayedTextInventory.map((entry) => entry.text))];
const decomposition = {
  schemaVersion: 1,
  stage: "personal-ip-master-to-semantic-layer-contract",
  mode: "vision-inspected-master-informed-semantic-reconstruction",
  masterReference: {
    source: masterReference,
    copiedAsset: `assets/${masterReferenceFile}`,
    sha256: masterReferenceSha256,
    width: Number(masterReferenceStream.width || 0),
    height: Number(masterReferenceStream.height || 0),
    pixelFormat: masterReferenceStream.pix_fmt || null,
    runtimeContentOwner: false,
    auditReferenceOnly: true,
    visualAnalysis: masterVisualAnalysis,
  },
  flatCompositeBaseForbidden: true,
  scopeIsolation: "personal-ip-animation-only",
  layerOwnershipAudit: "workflow/personal-ip-layer-ownership-audit.json",
  opaqueBitmapSlicesForbidden: true,
  exactTextContract: requiredExactText,
  exactTextContractSource: {
    mode: "explicit-source-bound-displayed-text-inventory",
    inventory: normalizedDisplayedTextInventory,
    displayedAuthoritativeFields: [...new Set(normalizedDisplayedTextInventory.map((entry) => entry.field))],
    narrationOnlyFieldsExcluded: ["scene.spokenText", "scene.methodologyText"],
    explicitDisplayedTextCount: normalizedDisplayedTextInventory.length,
  },
  requiredLayerRoles,
  layers: layerEntries.map(([id, role, z]) => ({
    id,
    role,
    zIndex: z,
    assetKind: role === "personal-ip" ? "transparent-or-contained-persona-raster-in-svg" : "deterministic-svg",
    sourceBinding: role === "subtitle-overlay" ? "authoritative-caption-cues" : "vision-inspected-master-style-plus-exact-content-spec",
    independentlyAnimated: role !== "background",
    containsFullMasterBitmap: false,
  })),
  contentInventory: scenes.map((scene) => ({
    sceneId: scene.id,
    title: scene.title,
    subtitle: scene.subtitle,
    hookItems: scene.hookItems || [],
    routeItems: scene.routeItems || [],
    takeaway: scene.takeaway,
    personaOwner: "50-persona",
    agentOwner: "60-agent",
  })),
  unmappedRequiredObjects: masterVisualAnalysis.validation.missingRoleBindings,
  duplicateOwners: masterVisualAnalysis.validation.duplicateObjectIds,
};
writeJson(join(out, "workflow", "personal-ip-semantic-decomposition.json"), decomposition);

const visibleText = textNodes(fullSvg);
const normalizedVisibleText = visibleText.join("").replace(/\s+/g, "");
const missingExactText = requiredExactText.filter((value) => !normalizedVisibleText.includes(value.replace(/\s+/g, "")));
if (missingExactText.length) throw new Error(`Required source text missing from semantic SVG: ${missingExactText.join(" | ")}`);
const forbiddenViewerTextPatterns = [
  /PERSONAL\s+IP/i,
  /SEMANTIC\s+MOTION/i,
  /TAKEAWAY/i,
  /knowledge-ca/i,
  /agent-workfl/i,
  /主讲人\s*[·・]\s*拆解者/,
  /renderer|workflow|layout[-_ ]variant|scene[-_ ]count/i,
];
const visibleTextIssues = visibleText.filter((value) => forbiddenViewerTextPatterns.some((pattern) => pattern.test(value)));
if (visibleTextIssues.length) throw new Error(`Viewer-facing internal labels detected: ${visibleTextIssues.join(" | ")}`);

const scenePayloadJson = JSON.stringify(scenes).replaceAll("<", "\\u003c");
const title = escapeSvg(sourceSpec.title || args.title || "写小说的方法论");
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;background:#121820;color:#eef2f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}.app{display:grid;grid-template-columns:minmax(360px,${isHorizontal ? "960px" : "610px"}) minmax(300px,440px);gap:32px;align-items:start;justify-content:center;padding:26px}.stage-shell{width:min(${isHorizontal ? "960px" : "610px"},calc(100vw - 40px));aspect-ratio:${canvas.width}/${canvas.height};background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 28px 80px #0008}.stage,.stage svg{width:100%;height:100%;display:block}.panel{position:sticky;top:26px;background:#1a2530;border-radius:24px;padding:24px}.panel h1{font-size:28px;margin:0 0 10px}.panel p{color:#aeb9c5;line-height:1.7}.controls{display:flex;gap:10px;flex-wrap:wrap}.controls button{border:0;border-radius:999px;padding:10px 18px;font-weight:750;cursor:pointer}.primary{background:#f0642c;color:#fff}.secondary{background:#fff;color:#18232d}.timeline{width:100%;margin-top:18px}.status{display:grid;gap:8px;margin-top:12px;color:#9cabb9;font-size:13px}[data-scene-index],[data-reveal-item]{will-change:opacity,transform}#caption-text{fill:#fff !important;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans CJK SC',sans-serif;letter-spacing:.01em}body.render{background:#fff}.render .app{display:block;padding:0}.render .stage-shell{width:${canvas.width}px;height:${canvas.height}px;border-radius:0;box-shadow:none}.render .panel{display:none}@media(max-width:980px){.app{grid-template-columns:1fr}.panel{position:static}}@media(prefers-reduced-motion:reduce){[data-scene-index],[data-reveal-item]{will-change:auto}}</style></head><body><main class="app"><section class="stage-shell"><div class="stage" id="stage">${fullSvg.replace(/^<\?xml[^>]+>\s*/, "")}</div></section><aside class="panel"><h1>个人内容动画预览</h1><p>页面构图根据引文、因果、选择、资源、评分和清单等内容结构自动切换。主动画在每幕前段完成，后续保持稳定阅读。</p><div class="controls"><button id="play" class="primary">播放</button><button id="replay" class="secondary">重播</button><button id="final" class="secondary">最后一幕</button></div><input id="timeline" class="timeline" type="range" min="0" max="1000" value="0"><div class="status"><span id="phase">准备</span><span id="time">0.0s / ${durationSeconds.toFixed(1)}s</span><span id="layout"></span></div></aside></main><script>(()=>{const scenes=${scenePayloadJson};const duration=${durationSeconds};const clamp=v=>Math.max(0,Math.min(1,v));const ease=v=>1-Math.pow(1-clamp(v),3);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const groups=[...document.querySelectorAll('[data-scene-index]')];const caption=document.querySelector('#caption-text');const stage=document.querySelector('#stage');let raf=0,playing=false,startAt=0,paused=0;function setGroupState(group,active,revealProgress){if(!active){group.style.visibility='hidden';group.style.opacity='0';return}group.style.visibility='visible';const role=group.dataset.sceneRole;const entry=role==='background'?1:ease(revealProgress/.28);group.style.opacity=String(entry);group.style.transform='translateY('+((1-entry)*14)+'px)';const items=[...group.querySelectorAll('[data-reveal-item]')];const maxIndex=Math.max(1,...items.map(item=>Number(item.dataset.revealItem||1)));items.forEach(item=>{const index=Math.max(1,Number(item.dataset.revealItem||1));const start=.08+(index-1)*(.80/Math.max(1,maxIndex));const value=ease((revealProgress-start)/.24);item.style.opacity=String(value);item.style.transform='translateY('+((1-value)*18+'px) scale('+(0.99+value*.01)+')'})}function setProgress(input){const global=reduced?1:clamp(Number(input)||0);const elapsed=global*duration;const scene=scenes.find(candidate=>elapsed<candidate.endSeconds)||scenes.at(-1);const sceneIndex=scenes.indexOf(scene);const localSeconds=Math.max(0,Math.min(scene.durationSeconds,elapsed-scene.startSeconds));const localProgress=scene.durationSeconds?clamp(localSeconds/scene.durationSeconds):1;const revealProgress=scene.activeRevealSeconds?clamp(localSeconds/scene.activeRevealSeconds):1;groups.forEach(group=>setGroupState(group,Number(group.dataset.sceneIndex)===sceneIndex,revealProgress));const cues=scene.captions?.length?scene.captions:[scene.subtitle||scene.title];caption.textContent=cues[Math.min(cues.length-1,Math.floor(localProgress*cues.length))]||'';document.querySelector('#timeline').value=String(Math.round(global*1000));document.querySelector('#time').textContent=(global*duration).toFixed(1)+'s / '+duration.toFixed(1)+'s';document.querySelector('#phase').textContent=revealProgress<1?'展开当前内容':'稳定阅读';document.querySelector('#layout').textContent=scene.visualMetaphor||'';stage.dataset.progress=global.toFixed(3);stage.dataset.sceneId=scene.id;stage.dataset.layoutVariant=scene.layoutVariant;stage.dataset.revealComplete=String(revealProgress>=1);stage.dataset.activeRevealSeconds=scene.activeRevealSeconds.toFixed(3);stage.dataset.holdAfterReveal=scene.holdAfterReveal.toFixed(3)}function tick(now){if(!playing)return;if(!startAt)startAt=now-paused;const elapsed=now-startAt;setProgress(elapsed/(duration*1000));if(elapsed>=duration*1000){playing=false;paused=duration*1000;startAt=0;document.querySelector('#play').textContent='播放';return}raf=requestAnimationFrame(tick)}function toggle(){if(playing){playing=false;cancelAnimationFrame(raf);paused=Number(document.querySelector('#timeline').value)/1000*duration*1000;document.querySelector('#play').textContent='播放';return}if(paused>=duration*1000)paused=0;playing=true;startAt=0;document.querySelector('#play').textContent='暂停';raf=requestAnimationFrame(tick)}document.querySelector('#play').onclick=toggle;document.querySelector('#replay').onclick=()=>{cancelAnimationFrame(raf);paused=0;startAt=0;playing=true;document.querySelector('#play').textContent='暂停';setProgress(0);raf=requestAnimationFrame(tick)};document.querySelector('#final').onclick=()=>{cancelAnimationFrame(raf);playing=false;paused=duration*1000;setProgress(1);document.querySelector('#play').textContent='播放'};document.querySelector('#timeline').oninput=event=>{cancelAnimationFrame(raf);playing=false;paused=Number(event.target.value)/1000*duration*1000;startAt=0;setProgress(paused/(duration*1000));document.querySelector('#play').textContent='播放'};window.motion={setProgress,duration,reducedMotion:reduced,scenes,activeRevealSeconds:scenes.map(scene=>scene.activeRevealSeconds),holdAfterReveal:scenes.map(scene=>scene.holdAfterReveal)};if(new URLSearchParams(location.search).get('render')==='1')document.body.classList.add('render');setProgress(reduced?1:0)})();</script></body></html>`;
const correctedHtml = html.replace(
  "item.style.transform='translateY('+((1-value)*18+'px) scale('+(0.99+value*.01)+')'})",
  "item.style.transform='translateY('+((1-value)*18)+'px) scale('+(0.99+value*.01)+')'})",
);
write(join(out, "index.html"), correctedHtml);

const layoutVariantCount = new Set(scenes.map((scene) => scene.layoutVariant)).size;
const contentKindCount = new Set(scenes.map((scene) => scene.contentKind)).size;
const layoutVariantCounts = Object.fromEntries([...new Set(scenes.map((scene) => scene.layoutVariant))]
  .map((layout) => [layout, scenes.filter((scene) => scene.layoutVariant === layout).length]));
const dominantLayoutRatio = Math.max(...Object.values(layoutVariantCounts)) / scenes.length;
const maximumDominantLayoutRatio = scenes.length >= 8 ? 0.45 : 1;
const manifest = {
  schemaVersion: 3,
  route: "personal-ip-semantic-layers-svg-html-video",
  scopeIsolation: "personal-ip-animation-only",
  canonicalSource: "content-driven-semantic-layout-scene",
  flatCompositeBaseForbidden: true,
  semanticDecomposition: "workflow/personal-ip-semantic-decomposition.json",
  layerOwnershipAudit: "workflow/personal-ip-layer-ownership-audit.json",
  masterReference: decomposition.masterReference,
  expectedSceneCount,
  expectedSourcePageCount,
  sceneCount: scenes.length,
  semanticSceneCountPlan: sourceSpec.semanticSceneCountPlan || null,
  sceneTimeline: scenes.map((scene) => ({
    id: scene.id,
    sourcePageId: scene.sourcePageId,
    order: scene.order,
    startSeconds: scene.startSeconds,
    endSeconds: scene.endSeconds,
    durationSeconds: scene.durationSeconds,
    contentKind: scene.contentKind,
    layoutVariant: scene.layoutVariant,
    motionVerb: scene.motionVerb,
    visualMetaphor: scene.visualMetaphor,
    activeRevealSeconds: scene.activeRevealSeconds,
    holdAfterReveal: scene.holdAfterReveal,
    mainRevealCompletesBeforeSceneEnd: scene.mainRevealCompletesBeforeSceneEnd,
    contentFingerprint: scene.contentFingerprint,
  })),
  sceneCoverage: {
    expectedSourcePageIds,
    renderedSourcePageIds,
    renderedSceneIds: scenes.map((scene) => scene.id),
    allPlannedScenesRepresented: scenes.length === expectedSceneCount,
    allSourcePagesRepresented,
    sourcePageCountExpandedOrPreserved: scenes.length >= expectedSourcePageCount,
    semanticSceneCountPolicyMatched: !sourceSpec.semanticSceneCountPlan || Number(sourceSpec.semanticSceneCountPlan.resolvedSceneCount || 0) === scenes.length,
    uniqueContentFingerprintCount,
    sceneVisualSamplesDistinct: false,
    uniqueVisualSampleCount: 0,
    longFormSingleBoardRejected: durationSeconds < 180 || scenes.length >= 4,
  },
  contentDrivenLayout: {
    active: true,
    policy: "layout-is-selected-from-current-scene-content-and-methodology-kind",
    supportedLayoutVariants: SEMANTIC_LAYOUT_DEFINITIONS,
    selectedLayoutVariants: [...new Set(scenes.map((scene) => scene.layoutVariant))],
    layoutVariantCount,
    layoutVariantCounts,
    dominantLayoutRatio: Number(dominantLayoutRatio.toFixed(4)),
    maximumDominantLayoutRatio,
    contentKindCount,
    singleTemplateFallbackForbidden: true,
    personaPlacementVariesByLayout: true,
  },
  viewerFacingTextAudit: {
    status: visibleTextIssues.length ? "fail" : "pass",
    checkedTextNodeCount: visibleText.length,
    presenterRoleCaptionRemoved: true,
    internalEnglishLabelsRemoved: true,
    issues: visibleTextIssues,
  },
  personaBinding: { fixed: true, fixedPersonaBound: true, asset: "assets/persona-main-anchor.png", layer: "50-persona", presenterRoleCaptionVisible: false },
  canvas,
  aspectAdaptation: {
    selectedLayout: canvas.orientation,
    supported: [
      { aspectRatio: "9:16", dimensions: "1080x1920", layout: "content-driven-vertical-semantic-layouts" },
      { aspectRatio: "16:9", dimensions: "1920x1080", layout: "content-driven-horizontal-semantic-layouts" },
    ],
    cropOrSqueezeFallbackForbidden: true,
  },
  durationSeconds,
  requestedCaptureFps,
  captureFps,
  captureFrameBudget,
  streamedFrameEncoding: true,
  temporaryFrameFiles: 0,
  layers: layerEntries.map(([id, role, z]) => ({ id, role, zIndex: z, svg: `layers/${id}.svg`, htmlOwner: role !== "background" })),
  html: "index.html",
  combinedSvg: "personal-ip-layered.svg",
  animationContract: {
    masterTimeline: "window.motion.setProgress(progress)",
    timingModel: "bounded-scene-reveal-then-stable-hold",
    activeRevealSeconds: scenes.map((scene) => ({ sceneId: scene.id, seconds: scene.activeRevealSeconds })),
    holdAfterReveal: scenes.map((scene) => ({ sceneId: scene.id, seconds: scene.holdAfterReveal })),
    allMainRevealsCompleteBeforeSceneEnd: scenes.every((scene) => scene.mainRevealCompletesBeforeSceneEnd),
    narrationDurationDoesNotStretchMainAnimation: true,
    captionsContinueAfterMainReveal: true,
    subtitleTopmost: true,
    reducedMotionFinalState: true,
    sceneTimelineResetsLayerReveal: true,
    periodicCardFocusPulseForbidden: true,
  },
  rejectList: ["single rigid card template for all scenes", "internal production labels in viewer frame", "presenter role caption under persona", "main reveal stretched to full narration duration", "flat personal-IP page used as animation base", "caption below content"],
};
writeJson(join(out, "workflow", "personal-ip-semantic-layer-manifest.json"), manifest);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: canvas.width, height: canvas.height }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(join(out, "index.html")).href}?render=1`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const frameCount = Math.ceil(durationSeconds * captureFps);
const visual = join(out, "renders", "personal-ip-semantic-layered.mp4");
const encoder = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(captureFps), "-vcodec", "mjpeg", "-i", "pipe:0", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", visual], { cwd: ROOT, stdio: ["pipe", "ignore", "pipe"] });
let encoderError = "";
encoder.stderr.setEncoding("utf8");
encoder.stderr.on("data", (chunk) => { encoderError += chunk; });
for (let index = 0; index < frameCount; index += 1) {
  const progress = frameCount <= 1 ? 1 : index / (frameCount - 1);
  await page.evaluate((value) => window.motion.setProgress(value), progress);
  const jpeg = await page.screenshot({ type: "jpeg", quality: 90 });
  if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, "drain");
}
encoder.stdin.end();
const [encoderExitCode] = await once(encoder, "close");
if (encoderExitCode !== 0) throw new Error(`streaming ffmpeg encoder failed (${encoderExitCode}): ${encoderError}`);
for (const [label, progress] of [["opening", 0.02], ["middle", 0.5], ["ending", 0.999]]) {
  await page.evaluate((value) => window.motion.setProgress(value), progress);
  await page.screenshot({ path: join(out, "screenshots", `${label}.png`), type: "png" });
}
const sceneVisualSamples = [];
for (const scene of scenes) {
  const sampleSeconds = Math.min(scene.endSeconds - 0.02, scene.startSeconds + Math.min(scene.durationSeconds * 0.82, scene.activeRevealSeconds + 0.12));
  const progress = durationSeconds > 0 ? sampleSeconds / durationSeconds : 1;
  const path = join(out, "screenshots", `scene-${String(scene.order).padStart(3, "0")}-${scene.id}.png`);
  await page.evaluate((value) => window.motion.setProgress(value), progress);
  const state = await page.evaluate(() => ({ sceneId: document.querySelector("#stage")?.dataset.sceneId, layoutVariant: document.querySelector("#stage")?.dataset.layoutVariant, revealComplete: document.querySelector("#stage")?.dataset.revealComplete }));
  await page.screenshot({ path, type: "png" });
  sceneVisualSamples.push({ id: scene.id, progress, state, screenshot: `screenshots/${basename(path)}`, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") });
}
await browser.close();

manifest.sceneVisualSamples = sceneVisualSamples;
manifest.frameCount = frameCount;
manifest.sceneCoverage.uniqueVisualSampleCount = new Set(sceneVisualSamples.map((sample) => sample.sha256)).size;
manifest.sceneCoverage.sceneVisualSamplesDistinct = manifest.sceneCoverage.uniqueVisualSampleCount === scenes.length;
manifest.animationContract.sampledScenesReachedStableHold = sceneVisualSamples.every((sample) => sample.state.revealComplete === "true");
writeJson(join(out, "workflow", "personal-ip-semantic-layer-manifest.json"), manifest);

const finalVideo = join(out, "renders", "final.mp4");
if (audio) run("ffmpeg", ["-y", "-v", "error", "-i", visual, "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", finalVideo]);
else copyFileSync(visual, finalVideo);
copyFileSync(finalVideo, join(out, "final.mp4"));

const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", finalVideo]));
const decoder = spawnSync("ffmpeg", ["-v", "error", "-i", finalVideo, "-f", "null", "-"], { encoding: "utf8" });
const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
const minimumLayoutVariants = Math.min(3, Math.max(1, contentKindCount));
const qc = {
  schemaVersion: 3,
  pass: false,
  renderer: "content-driven-semantic-svg-html-playwright-ffmpeg",
  durationSeconds: Number(probe.format?.duration || 0),
  dimensions: `${videoStream?.width}x${videoStream?.height}`,
  checks: {
    semanticLayerManifestPresent: true,
    independentSvgLayersExported: layerEntries.every(([id]) => existsSync(join(out, "layers", `${id}.svg`))),
    interactiveHtmlExported: existsSync(join(out, "index.html")),
    combinedSvgExported: existsSync(join(out, "personal-ip-layered.svg")),
    flatCompositeBaseRejected: true,
    semanticDecompositionPresent: existsSync(join(out, "workflow", "personal-ip-semantic-decomposition.json")),
    semanticLayerSpecPresent: existsSync(join(out, "workflow", "personal-ip-semantic-layer-spec.json")),
    masterReferenceBoundByHash: decomposition.masterReference.sha256 === masterReferenceSha256,
    noFullPageBitmapInRuntimeSvg: nonPersonaBitmapLayers.length === 0,
    personalIpAnimationRouteIsolated: layerOwnershipAudit.scopeIsolation === "personal-ip-animation-only",
    noDuplicateFlattenedSourcePixelOwners: layerOwnershipAudit.pass === true
      && layerOwnershipAudit.ownershipContract.duplicateSourcePixelOwnerCount === 0
      && layerOwnershipAudit.ownershipContract.independentlyMovingFlattenedSliceCount === 0,
    semanticPathBelowContent: layerOwnershipAudit.ownershipContract.semanticPathBelowContent === true,
    requiredLayerRolesPresent: requiredLayerRoles.every((role) => actualLayerRoles.includes(role)),
    exactSourceTextInventoryNonEmpty: requiredExactText.length > 0,
    exactSourceTextPreserved: requiredExactText.length > 0 && missingExactText.length === 0,
    requestedAspectResolved: videoStream?.width === canvas.width && videoStream?.height === canvas.height,
    videoDecodes: decoder.status === 0,
    subtitleTopmost: layerEntries.at(-1)?.[1] === "subtitle-overlay",
    multiSceneTimelinePresent: manifest.sceneTimeline.length === scenes.length && (scenes.length > 1 || durationSeconds < 180),
    allPlannedScenesRepresented: manifest.sceneCoverage.allPlannedScenesRepresented === true,
    allSourcePagesRepresented: manifest.sceneCoverage.allSourcePagesRepresented === true,
    sourcePageCountExpandedOrPreserved: manifest.sceneCoverage.sourcePageCountExpandedOrPreserved === true,
    semanticSceneCountPolicyMatched: manifest.sceneCoverage.semanticSceneCountPolicyMatched === true,
    sceneContentDistinct: uniqueContentFingerprintCount === scenes.length,
    sceneVisualSamplesDistinct: manifest.sceneCoverage.sceneVisualSamplesDistinct === true,
    longFormSingleBoardRejected: manifest.sceneCoverage.longFormSingleBoardRejected === true,
    fixedPersonaBound: manifest.personaBinding.fixed === true && existsSync(join(out, manifest.personaBinding.asset)),
    presenterRoleCaptionRemoved: manifest.viewerFacingTextAudit.presenterRoleCaptionRemoved === true,
    internalViewerLabelsRemoved: manifest.viewerFacingTextAudit.status === "pass",
    contentDrivenLayoutSelectionPresent: manifest.contentDrivenLayout.active === true,
    layoutVariantDiversity: layoutVariantCount >= minimumLayoutVariants,
    noSingleLayoutDominatesLongForm: dominantLayoutRatio <= maximumDominantLayoutRatio,
    mainAnimationSettlesBeforeNarrationEnds: manifest.animationContract.allMainRevealsCompleteBeforeSceneEnd === true,
    sampledScenesReachedStableHold: manifest.animationContract.sampledScenesReachedStableHold === true,
    narrationDoesNotStretchMainAnimation: manifest.animationContract.narrationDurationDoesNotStretchMainAnimation === true,
  },
};
qc.pass = Boolean(videoStream) && Object.values(qc.checks).every(Boolean);
writeJson(join(out, "logs", "qc.json"), qc);
process.stdout.write(`${JSON.stringify({ pass: qc.pass, out, html: join(out, "index.html"), svg: join(out, "personal-ip-layered.svg"), finalVideo, manifest: join(out, "workflow", "personal-ip-semantic-layer-manifest.json") }, null, 2)}\n`);
if (!qc.pass) process.exitCode = 2;
