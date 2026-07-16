#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/validate-subtitle-cover-contract.mjs --out <output-dir> [--brief <brief.json>]",
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

function compactText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function coverTitleDescription(value) {
  return String(value || "")
    .replace(/^第\s*[\d０-９一二三四五六七八九十百]+\s*[章节讲集课期]*\s*[：:、.\-\s]+/u, "")
    .trim();
}

function parseSrt(content) {
  return content
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      return {
        index: lines[0],
        time: lines[1],
        textLines: lines.slice(2).filter((line) => line.trim().length > 0),
      };
    });
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

const PROTECTED_CAPTION_TOKEN_PATTERN = /[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)+|\d+(?:\.\d+)?\s*(?:T|B|M|K|%|万|亿|倍|参数|上下文|token|tokens?)/giu;

function protectedCaptionTokenRanges(text) {
  return [...String(text || "").matchAll(PROTECTED_CAPTION_TOKEN_PATTERN)]
    .map((match) => ({
      token: match[0].replace(/\s+/g, ""),
      rawToken: match[0],
      index: match.index,
      end: match.index + match[0].length,
    }))
    .filter((match) => match.token.length > 1);
}

function protectedCaptionTokens(text) {
  return protectedCaptionTokenRanges(text)
    .map((match) => match.token)
    .filter((token) => token.length > 1);
}

function tokenHasAllowedPlainOccurrence(text, token) {
  const value = String(text || "");
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return false;
  const ranges = protectedCaptionTokenRanges(value);
  let index = value.indexOf(normalizedToken);
  while (index >= 0) {
    const end = index + normalizedToken.length;
    const insideProtected = ranges.some((range) => index >= range.index && end <= range.end && normalizedToken !== range.rawToken);
    if (!insideProtected) return true;
    index = value.indexOf(normalizedToken, index + 1);
  }
  return false;
}

function tokenBrokenByVisualLineBreak(captionText, token) {
  const normalizedToken = String(token || "").replace(/\s+/g, "");
  if (!normalizedToken) return false;
  const compactCaption = compactText(captionText);
  if (!compactCaption.includes(normalizedToken)) return false;
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (let index = 1; index < normalizedToken.length; index += 1) {
    const before = escapeRegex(normalizedToken.slice(0, index));
    const after = escapeRegex(normalizedToken.slice(index));
    if (new RegExp(`${before}\\s*\\n\\s*${after}`, "u").test(String(captionText || ""))) return true;
  }
  return false;
}

function requireFile(outDir, relativePath, failures) {
  const file = join(outDir, relativePath);
  expect(existsSync(file), `missing ${relativePath}`, failures);
  return file;
}

function validateCaptionText(segment, failures) {
  const label = `segment ${segment.frameIndex ?? "?"}/${segment.cueIndex ?? segment.index ?? "?"}`;
  expect(typeof segment.text === "string" && segment.text.trim().length > 0, `${label} has empty spoken text`, failures);
  expect(!String(segment.text || "").includes("\n"), `${label} spoken TTS text contains visual line break`, failures);

  if (segment.captionText) {
    expect(
      compactText(segment.captionText) === compactText(segment.text),
      `${label} captionText does not preserve spoken cue text`,
      failures,
    );
    const lines = String(segment.captionText).split("\n");
    const protectedTokens = protectedCaptionTokens(segment.text);
    for (const token of protectedTokens) {
      expect(!tokenBrokenByVisualLineBreak(segment.captionText, token), `${label} splits protected caption token across visual lines: ${token}`, failures);
    }
    for (const [lineIndex, line] of lines.entries()) {
      const trimmed = line.trim();
      expect(trimmed.length > 0, `${label} caption visual line ${lineIndex + 1} is empty`, failures);
      expect(!/^[，,、。！？!?；;：:）)\]】》」』”’"'.…—-]+$/.test(trimmed), `${label} caption visual line ${lineIndex + 1} is punctuation only`, failures);
    }
    expect(!/[一-龥]\n[一-龥]/u.test(segment.captionText) || lines.every((line) => line.trim().length >= 2), `${label} has an isolated CJK character visual line`, failures);
    if (lines.length > 1) {
      const lastLine = lines[lines.length - 1].trim();
      const visibleLast = lastLine.replace(/[，,、。！？!?；;：:）)\]】》」』”’"'.…—\-\s]/g, "");
      expect(visibleLast.length > 2, `${label} has an orphan trailing caption line: ${lastLine}`, failures);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const outDir = resolve(args.out);
  const failures = [];
  const warnings = [];

  const subtitleSegmentsPath = requireFile(outDir, "script/subtitle-cue-narration-segments.json", failures);
  const spokenPath = requireFile(outDir, "script/narration-spoken.txt", failures);
  const srtPath = requireFile(outDir, "script/subtitles.srt", failures);
  const qcPath = requireFile(outDir, "logs/qc.json", failures);
  const syncPath = requireFile(outDir, "workflow/sync-timecode-plan.json", failures);
  const voiceManifestPath = requireFile(outDir, "workflow/voice-subtitle-manifest.json", failures);
  const runtimeConfigPath = requireFile(outDir, "workflow/runtime-config.json", failures);
  const contractPath = requireFile(outDir, "workflow/quality-consistency-contract.json", failures);
  const captionStylePath = requireFile(outDir, "workflow/caption-style-plan.json", failures);
  const coverPath = requireFile(outDir, "workflow/cover-design.json", failures);
  const visualRelevancePath = requireFile(outDir, "workflow/visual-relevance-audit.json", failures);
  const imageStrategyPath = requireFile(outDir, "workflow/image-generation-strategy.json", failures);
  const visualRhythmPath = requireFile(outDir, "workflow/visual-rhythm-plan.json", failures);
  const retentionPath = requireFile(outDir, "workflow/retention-structure-contract.json", failures);
  const coverImage2QcPath = requireFile(outDir, "workflow/cover-image2-qc.json", failures);

  if (failures.length === 0) {
    const subtitleSegments = readJson(subtitleSegmentsPath);
    const segments = Array.isArray(subtitleSegments.segments) ? subtitleSegments.segments : [];
    expect(segments.length > 0, "subtitle-cue-narration-segments.json has no segments", failures);
    for (const segment of segments) validateCaptionText(segment, failures);

    const spoken = readFileSync(spokenPath, "utf8");
    const cueText = segments.map((segment) => segment.text || "").join("");
    expect(compactText(cueText) === compactText(spoken), "TTS cue text does not preserve narration-spoken.txt", failures);

    const blocks = parseSrt(readFileSync(srtPath, "utf8"));
    expect(blocks.length > 0, "subtitles.srt has no subtitle blocks", failures);
    for (const block of blocks) {
      expect(block.textLines.length === 1, `SRT block ${block.index} must contain exactly one visible subtitle line`, failures);
      if (block.textLines[0]) {
        expect(!/^[，,、。！？!?；;：:）)\]】》」』”’"'.…—-]+$/.test(block.textLines[0].trim()), `SRT block ${block.index} is punctuation only`, failures);
      }
    }

    const qc = readJson(qcPath);
    const semanticLayerRenderer = /personal-ip-semantic-layers/.test(qc.renderer || "");
    expect(qc.pass === true, "logs/qc.json pass must be true", failures);
    expect(qc.checks?.visualSubtitleSingleLine === true, "logs/qc.json must pass visualSubtitleSingleLine", failures);
    expect(qc.checks?.captionStylePlanPresent === true, "logs/qc.json must pass captionStylePlanPresent", failures);
    expect(qc.checks?.captionStylePlanEnforced === true, "logs/qc.json must pass captionStylePlanEnforced", failures);
    expect(qc.checks?.frameAudioTimingBound === true, "logs/qc.json must pass frameAudioTimingBound", failures);
    expect(qc.checks?.openingAudioStartsImmediately === true, "logs/qc.json must pass openingAudioStartsImmediately", failures);
    if (semanticLayerRenderer) {
      expect(qc.checks?.personalIpSemanticPackageQcPass === true, "semantic-layer video must pass its package QC", failures);
      expect(qc.checks?.personalIpSemanticAllScenesRepresented === true, "semantic-layer video must represent every planned scene", failures);
      expect(qc.checks?.personalIpSemanticSourceContentCoveragePreserved === true, "semantic-layer video must preserve source content coverage", failures);
    } else {
      expect(qc.checks?.directFirstSceneStart === true || qc.coverTimingMode === "overlap-first-scene", "logs/qc.json must pass directFirstSceneStart unless an opening cover was explicitly requested", failures);
    }
    expect(qc.checks?.visualAssetsContentBound === true, "logs/qc.json must pass visualAssetsContentBound", failures);
    expect(qc.checks?.imageGenerationStrategyPresent === true, "logs/qc.json must pass imageGenerationStrategyPresent", failures);
    expect(qc.checks?.visualRhythmPlanPresent === true, "logs/qc.json must pass visualRhythmPlanPresent", failures);
    expect(qc.checks?.visualRhythmDensityOk === true, "logs/qc.json must pass visualRhythmDensityOk", failures);
    expect(qc.checks?.retentionStructureContractPresent === true, "logs/qc.json must pass retentionStructureContractPresent", failures);
    expect(qc.checks?.firstFrameRetentionPromisePresent === true, "logs/qc.json must pass firstFrameRetentionPromisePresent", failures);
    expect(qc.checks?.firstThirtySecondContractPresent === true, "logs/qc.json must pass firstThirtySecondContractPresent", failures);
    expect(qc.checks?.evidenceCadencePlanned === true, "logs/qc.json must pass evidenceCadencePlanned", failures);
    expect(qc.checks?.progressAndPayoffPlanned === true, "logs/qc.json must pass progressAndPayoffPlanned", failures);
    if (!semanticLayerRenderer) {
      expect(qc.checks?.generatedImagePurposeFit === true, "logs/qc.json must pass generatedImagePurposeFit", failures);
    }
    expect(qc.checks?.generatedVisualDesignLayersPresent === true, "logs/qc.json must pass generatedVisualDesignLayersPresent", failures);
    expect(qc.checks?.runtimeConfigPresent === true, "logs/qc.json must pass runtimeConfigPresent", failures);

    const runtimeConfig = readJson(runtimeConfigPath);
    expect(runtimeConfig.schemaVersion === 1, "runtime-config.json schemaVersion must be 1", failures);
    expect(runtimeConfig.status === "locked-for-run", "runtime-config.json must be locked for the run", failures);
    expect(runtimeConfig.environmentCapabilities?.openaiApiKeyChangesDefaultImageSource === false, "OPENAI_API_KEY must not silently change the default image source", failures);
    expect(Boolean(runtimeConfig.resolved?.imageSource), "runtime-config.json must record resolved imageSource", failures);
    expect(Boolean(runtimeConfig.resolved?.voiceBackend), "runtime-config.json must record resolved voiceBackend", failures);

    const syncPlan = readJson(syncPath);
    const guardrail = `${syncPlan.guardrail || ""} ${syncPlan.description || ""}`;
    expect(/visual line wrapping/i.test(guardrail), "sync-timecode-plan guardrail must mention visual line wrapping", failures);
    expect(/audio cuts/i.test(guardrail), "sync-timecode-plan guardrail must reject extra audio cuts", failures);
    expect(["none", "overlap-first-scene"].includes(syncPlan.coverTimingMode), "sync-timecode-plan must use no in-video cover or overlap-first-scene cover timing", failures);
    expect(Number(syncPlan.audioStartsAtSeconds) === 0, "sync-timecode-plan must declare audioStartsAtSeconds 0", failures);
    expect(Number(syncPlan.audioDelaySeconds) === 0, "sync-timecode-plan must declare audioDelaySeconds 0", failures);

    const voiceManifest = readJson(voiceManifestPath);
    expect(["none", "overlap-first-scene"].includes(voiceManifest.timing?.coverTimingMode), "voice manifest must use no in-video cover or overlap-first-scene cover timing", failures);
    expect(Number(voiceManifest.timing?.audioStartsAtSeconds) === 0, "voice manifest must declare audioStartsAtSeconds 0", failures);
    expect(Number(voiceManifest.timing?.audioDelaySeconds) === 0, "voice manifest must declare audioDelaySeconds 0", failures);

    const contract = readJson(contractPath);
    const hardGates = Array.isArray(contract.hardGates) ? contract.hardGates : [];
    expect(hardGates.includes("runtimeConfigPresent"), "quality contract must include runtimeConfigPresent hard gate", failures);
    expect(hardGates.includes("visualSubtitleSingleLine"), "quality contract must include visualSubtitleSingleLine hard gate", failures);
    expect(hardGates.includes("captionStylePlanPresent"), "quality contract must include captionStylePlanPresent hard gate", failures);
    expect(hardGates.includes("captionStylePlanEnforced"), "quality contract must include captionStylePlanEnforced hard gate", failures);
    expect(hardGates.includes("frameAudioTimingBound"), "quality contract must include frameAudioTimingBound hard gate", failures);
    expect(hardGates.includes("directFirstSceneStart"), "quality contract must include directFirstSceneStart hard gate", failures);
    expect(hardGates.includes("openingAudioStartsImmediately"), "quality contract must include openingAudioStartsImmediately hard gate", failures);
    expect(hardGates.includes("visualAssetsContentBound"), "quality contract must include visualAssetsContentBound hard gate", failures);
    expect(hardGates.includes("imageGenerationStrategyPresent"), "quality contract must include imageGenerationStrategyPresent hard gate", failures);
    expect(hardGates.includes("visualRhythmPlanPresent"), "quality contract must include visualRhythmPlanPresent hard gate", failures);
    expect(hardGates.includes("visualRhythmDensityOk"), "quality contract must include visualRhythmDensityOk hard gate", failures);
    expect(hardGates.includes("retentionStructureContractPresent"), "quality contract must include retentionStructureContractPresent hard gate", failures);
    expect(hardGates.includes("firstFrameRetentionPromisePresent"), "quality contract must include firstFrameRetentionPromisePresent hard gate", failures);
    expect(hardGates.includes("firstThirtySecondContractPresent"), "quality contract must include firstThirtySecondContractPresent hard gate", failures);
    expect(hardGates.includes("evidenceCadencePlanned"), "quality contract must include evidenceCadencePlanned hard gate", failures);
    expect(hardGates.includes("progressAndPayoffPlanned"), "quality contract must include progressAndPayoffPlanned hard gate", failures);
    expect(hardGates.includes("generatedImagePurposeFit"), "quality contract must include generatedImagePurposeFit hard gate", failures);
    expect(hardGates.includes("generatedVisualDesignLayersPresent"), "quality contract must include generatedVisualDesignLayersPresent hard gate", failures);
    const requiredArtifacts = Array.isArray(contract.requiredArtifacts) ? contract.requiredArtifacts : [];
    expect(requiredArtifacts.includes("workflow/runtime-config.json"), "quality contract must require workflow/runtime-config.json", failures);
    expect(requiredArtifacts.includes("workflow/retention-structure-contract.json"), "quality contract must require workflow/retention-structure-contract.json", failures);
    const sceneContracts = Array.isArray(contract.sceneContracts) ? contract.sceneContracts : [];
    const requiredLayers = ["style-signature", "motion-grammar-panel", "platform-overlay", "motion-note", "caption-band"];
    expect(sceneContracts.length > 0, "quality contract must include scene contracts", failures);
    for (const scene of sceneContracts) {
      const layers = Array.isArray(scene.deterministicDesignLayersRequired) ? scene.deterministicDesignLayersRequired : [];
      const decision = scene.visualAssetDecision || {};
      expect(typeof decision.useGeneratedImage === "boolean", `quality contract scene ${scene.sceneId || "?"} must include a generated image decision`, failures);
      const expectedRole = decision.useGeneratedImage ? "supporting-material" : "not-used";
      expect(scene.generatedVisualLayerRole === expectedRole, `quality contract scene ${scene.sceneId || "?"} must match generated visual role ${expectedRole}`, failures);
      expect(scene.generatedVisualMayReplaceDesignLayers === false, `quality contract scene ${scene.sceneId || "?"} must reject generated visuals replacing design layers`, failures);
      expect(scene.captionStyle?.safeArea === "bottom-caption-band", `quality contract scene ${scene.sceneId || "?"} must include caption style safe area`, failures);
      expect(scene.captionStyle?.displayMode === "single-line-sequential", `quality contract scene ${scene.sceneId || "?"} must keep single-line caption style display`, failures);
      for (const layer of requiredLayers) {
        expect(layers.includes(layer), `quality contract scene ${scene.sceneId || "?"} must require deterministic layer ${layer}`, failures);
      }
    }

    const captionStyle = readJson(captionStylePath);
    expect(captionStyle.schemaVersion === 1, "caption-style-plan.json schemaVersion must be 1", failures);
    expect(captionStyle.status === "active-premium-caption-style-plan", "caption-style-plan.json must be active", failures);
    expect(captionStyle.globalContract?.safeArea === "bottom-caption-band", "caption-style-plan global contract must use bottom caption safe area", failures);
    expect(captionStyle.globalContract?.displayMode === "single-line-sequential", "caption-style-plan global contract must enforce single-line sequential display", failures);
    expect(captionStyle.globalContract?.noNewAudioCutsFromVisualStyle === true, "caption styling must not create new audio cuts", failures);
    expect(Array.isArray(captionStyle.styleCatalog) && captionStyle.styleCatalog.length >= 5, "caption-style-plan must include a reusable style catalog", failures);
    const knownCaptionClasses = new Set((captionStyle.styleCatalog || []).map((style) => style.rendererClass).filter(Boolean));
    const captionScenes = Array.isArray(captionStyle.scenes) ? captionStyle.scenes : [];
    const subtitleTextByScene = new Map();
    for (const segment of segments) {
      const sceneId = segment.frameId || segment.sceneId;
      if (!sceneId) continue;
      subtitleTextByScene.set(sceneId, `${subtitleTextByScene.get(sceneId) || ""}\n${segment.text || ""}\n${segment.captionText || ""}`);
    }
    expect(captionScenes.length === sceneContracts.length, "caption-style-plan scene count must match quality contract scenes", failures);
    for (const [index, scene] of captionScenes.entries()) {
      const contractScene = sceneContracts[index] || {};
      expect(scene.sceneId === contractScene.sceneId, `caption style scene ${scene.sceneId || "?"} must align with quality contract scene order`, failures);
      expect(scene.safeArea === "bottom-caption-band", `caption style scene ${scene.sceneId || "?"} must use bottom-caption-band`, failures);
      expect(scene.displayMode === "single-line-sequential", `caption style scene ${scene.sceneId || "?"} must use single-line sequential display`, failures);
      expect(knownCaptionClasses.has(scene.layerClass), `caption style scene ${scene.sceneId || "?"} must use a catalog layerClass`, failures);
      expect(Number(scene.typography?.letterSpacing || 0) === 0, `caption style scene ${scene.sceneId || "?"} must not use negative tracking`, failures);
      expect(Number(scene.typography?.targetFontPx || 0) >= 31, `caption style scene ${scene.sceneId || "?"} font size is too small`, failures);
      expect(/TTS segment timing/i.test(scene.motion?.timingSource || ""), `caption style scene ${scene.sceneId || "?"} must bind motion to TTS timing`, failures);
      const sceneSubtitleText = subtitleTextByScene.get(scene.sceneId) || "";
      const sceneProtectedTokens = protectedCaptionTokens(sceneSubtitleText);
      for (const token of scene.emphasisPlan?.tokens || []) {
        const normalizedToken = compactText(token);
        const onlyInsideProtectedToken = sceneProtectedTokens.some((protectedToken) =>
          protectedToken !== normalizedToken && protectedToken.includes(normalizedToken)
        ) && !tokenHasAllowedPlainOccurrence(sceneSubtitleText, token);
        expect(!onlyInsideProtectedToken, `caption style scene ${scene.sceneId || "?"} must not emphasize protected-token fragment: ${token}`, failures);
      }
    }

    const imageStrategy = readJson(imageStrategyPath);
    expect(imageStrategy.schemaVersion === 1, "image-generation-strategy.json schemaVersion must be 1", failures);
    expect(Array.isArray(imageStrategy.toolMatrix) && imageStrategy.toolMatrix.length >= 4, "image-generation-strategy.json must include a provider/tool matrix", failures);
    expect((imageStrategy.toolMatrix || []).some((tool) => /Codex built-in image_gen/.test(tool.tool || "")), "image-generation-strategy.json must include Codex built-in image_gen route", failures);
    expect(Array.isArray(imageStrategy.sceneRoutes) && imageStrategy.sceneRoutes.length > 0, "image-generation-strategy.json must include scene routes", failures);
    for (const route of imageStrategy.sceneRoutes || []) {
      expect(typeof route.visualAssetDecision?.useGeneratedImage === "boolean", `image-generation-strategy scene ${route.sceneId || "?"} must include useGeneratedImage decision`, failures);
      expect(typeof route.visualAssetDecision?.reason === "string" && route.visualAssetDecision.reason.trim().length > 0, `image-generation-strategy scene ${route.sceneId || "?"} must explain generated image purpose`, failures);
    }

    const visualRhythm = readJson(visualRhythmPath);
    expect(visualRhythm.schemaVersion === 1, "visual-rhythm-plan.json schemaVersion must be 1", failures);
    expect(visualRhythm.status === "pass", "visual-rhythm-plan.json status must be pass", failures);
    const rhythmScenes = Array.isArray(visualRhythm.scenes) ? visualRhythm.scenes : [];
    expect(rhythmScenes.length > 0, "visual-rhythm-plan.json must include scenes", failures);
    for (const scene of rhythmScenes) {
      const beats = Array.isArray(scene.visualRhythm?.beats) ? scene.visualRhythm.beats : [];
      expect(scene.pass === true, `visual rhythm scene ${scene.sceneId || "?"} must pass`, failures);
      expect(beats.length >= Number(visualRhythm.minimumEventsPerScene || 2), `visual rhythm scene ${scene.sceneId || "?"} has too few visual events`, failures);
      for (const beat of beats) {
        expect(Number(beat.durationSeconds || 0) <= Number(visualRhythm.maxSceneWithoutVisualChangeSeconds || 3.2) + 0.001, `visual rhythm beat ${beat.beatId || "?"} holds too long`, failures);
      }
    }

    const retention = readJson(retentionPath);
    expect(retention.schemaVersion === 1, "retention-structure-contract.json schemaVersion must be 1", failures);
    expect(retention.status === "active-retention-structure-contract", "retention-structure-contract.json must be active", failures);
    expect(retention.method === "RETAIN", "retention-structure-contract.json must use RETAIN", failures);
    expect((retention.axes || []).length === 6, "retention-structure-contract.json must include six RETAIN axes", failures);
    expect(retention.firstFrame?.promiseText, "retention contract must include first-frame promise text", failures);
    expect(retention.firstThirtySecondContract?.pass === true, "retention first-30-second contract must pass", failures);
    expect(retention.evidenceCadence?.pass === true, "retention evidence cadence must pass", failures);
    expect(retention.progressAndPayoff?.pass === true, "retention progress/payoff must pass", failures);

    const visualRelevance = readJson(visualRelevancePath);
    expect(visualRelevance.status === "pass", "visual-relevance-audit.json status must be pass", failures);
    const visualScenes = Array.isArray(visualRelevance.scenes) ? visualRelevance.scenes : [];
    expect(visualScenes.length > 0, "visual-relevance-audit.json must include scenes", failures);
    for (const scene of visualScenes) {
      expect(scene.pass === true, `visual relevance scene ${scene.sceneId || "?"} must pass`, failures);
      expect(Number(scene.keywordCoverage?.ratio || 0) >= Number(visualRelevance.minimumPromptKeywordCoverage || 0.5), `visual relevance scene ${scene.sceneId || "?"} prompt keyword coverage is too low`, failures);
      expect(Array.isArray(scene.contentKeywords) && scene.contentKeywords.length >= 3, `visual relevance scene ${scene.sceneId || "?"} must include content keywords`, failures);
      expect(typeof scene.narrationBeat === "string" && scene.narrationBeat.trim().length > 0, `visual relevance scene ${scene.sceneId || "?"} must include narrationBeat`, failures);
    }

    const cover = readJson(coverPath);
    const coverImage2Qc = readJson(coverImage2QcPath);
    expect(coverImage2Qc.integratedTypographyRequired === true, "cover-image2-qc.json must require integrated typography bitmap covers", failures);
    expect(coverImage2Qc.generatedBitmapInspectionRequired === true, "cover-image2-qc.json must require generated bitmap inspection", failures);
    expect(typeof coverImage2Qc.generatedBitmapInspectionStatus === "string", "cover-image2-qc.json must record generatedBitmapInspectionStatus", failures);
    if (coverImage2Qc.generatedBitmapInspectionStatus === "pending-human-or-vision-review") {
      expect(coverImage2Qc.finalCoverQualityEligible !== true, "pending-human-or-vision-review cover bitmap must not be marked finalCoverQualityEligible", failures);
      expect(coverImage2Qc.reviewPendingOnly === true || coverImage2Qc.reviewFallbackOnly === true, "pending cover bitmap must be marked review-pending or fallback-only", failures);
    }
    if (coverImage2Qc.finalCoverQualityEligible === true) {
      expect(coverImage2Qc.generatedBitmapInspectionPassed === true, "finalCoverQualityEligible requires generatedBitmapInspectionPassed", failures);
    }
    expect(typeof cover.coverTitle === "string" && cover.coverTitle.trim().length > 0, "cover-design.json must include coverTitle", failures);
    if (args.brief) {
      const briefPath = resolve(args.brief);
      if (existsSync(briefPath)) {
        const brief = readJson(briefPath);
        const expectedTitle = coverTitleDescription(brief.title || "");
        if (expectedTitle) {
          expect(cover.coverTitleSource === "brief.title", "cover title must declare brief.title as source", failures);
          expect(cover.coverTitle === expectedTitle, `coverTitle must equal stripped brief title description: ${expectedTitle}`, failures);
        }
      } else {
        warnings.push(`brief file not found: ${briefPath}`);
      }
    } else {
      warnings.push("brief not supplied; skipped exact cover title source comparison");
    }

    const variants = Array.isArray(cover.platformVariants) ? cover.platformVariants : [];
    const presets = Array.isArray(cover.resolutionPresets) ? cover.resolutionPresets : [];
    expect(cover.sharedContentPromiseMultiPlatformVariants === true, "cover-design.json must preserve one shared content promise across platform variants", failures);
    expect(cover.singleDesignMultiResolution === false, "cover-design.json must not claim simple single-design resizing when native target-ratio Image 2 assets are required", failures);
    expect(cover.platformSpecificDesignsGenerated === true, "cover-design.json must record platformSpecificDesignsGenerated=true by default", failures);
    expect(cover.coverSizeSelection?.humanSelectionContainsOnlyUploadReady === true, "cover final selection must contain only upload-ready cover files plus explanatory manifests", failures);
    expect(cover.coverSizeSelection?.nonUploadReadyVisualFilesCopied === false, "non-upload-ready local cover previews must stay out of final selection", failures);
    expect(variants.some((variant) => variant.id === "video-opening"), "cover variants must include video-opening", failures);
    expect(presets.some((preset) => preset.width === 3840 && preset.height === 2160), "cover presets must include 3840x2160", failures);
    expect(presets.some((preset) => preset.width === 1080 && preset.height === 1920), "cover presets must include 1080x1920", failures);
    expect(presets.some((preset) => preset.width === 1146 && preset.height === 717), "cover presets must include Bilibili common 1146x717", failures);
    const rasterExports = Array.isArray(cover.rasterExports) ? cover.rasterExports : [];
    for (const raster of rasterExports) {
      if (raster.file) expect(existsSync(join(outDir, raster.file)), `missing raster cover export ${raster.file}`, failures);
    }
  }

  const report = {
    ok: failures.length === 0,
    outputDir: outDir,
    checked: [
      "subtitle cue spoken text is sentence/semantic complete and newline-free",
      "captionText preserves spoken cue text without becoming TTS segmentation",
      "subtitles.srt has exactly one visible subtitle line per timestamp",
      "QC and quality contract enforce visualSubtitleSingleLine",
      "caption-style-plan.json defines premium safe-area subtitle styling without changing TTS cuts",
      "the MP4 starts directly on the first scene, or an explicitly requested opening cover overlaps the first spoken scene; narration starts at 0s",
      "inserted visuals and Image2 prompts are bound to scene narration keywords",
      "image generation strategy routes Codex built-in image_gen and optional provider/tool paths by scene job",
      "generated image usage is optional and must pass per-scene purpose/placement decisions",
      "visual rhythm plan prevents one unchanged image from holding through long narration segments",
      "generated images remain supporting material and deterministic design layers stay present",
      "cover title is sourced from the stripped brief title when a brief is supplied",
      "cover Image2/Codex integrated bitmap is not final-quality eligible until human or vision review passes",
    ],
    warnings,
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
