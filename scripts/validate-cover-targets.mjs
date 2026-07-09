#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const outDir = join(workspace, "research/codex-video-workflow-poc/cover-target-validation");

function read(relativePath) {
  return readFileSync(join(skillRoot, relativePath), "utf8");
}

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const failures = [];
  const script = read("scripts/poc-video-workflow.mjs");
  const batchSizeIndexScript = read("scripts/build-cover-size-selection-index.mjs");
  const targetImage2Script = read("scripts/generate-cover-targets-image2.mjs");
  const codexImage2IngestScript = read("scripts/ingest-codex-image2-cover-target.mjs");
  const nativeFinalRendererScript = read("scripts/render-ip-diagram-native-pages.mjs");
  const personalIpImagePlannerScript = read("scripts/plan-vertical-personal-ip-image.mjs");
  const semiAutoConfigBuilder = read("scripts/build-semi-auto-config-html.mjs");
  const skill = read("SKILL.md");
  const coverDesign = read("references/cover-design.md");
  const imageGenerationRouting = read("references/image-generation-routing.md");
  const qualityGates = read("references/quality-gates.md");
  const readme = read("README.md");
  const finalPreviewFunction = semiAutoConfigBuilder.match(/function coverFinalPreviewSample[\s\S]*?\n}\n\nfunction coverImage2PromptCount/)?.[0] || "";

  const requiredScriptPatterns = [
    ["video-internal cover target", /id:\s*"video-opening"[\s\S]*?usage:\s*"in-video"[\s\S]*?cover-video-opening/],
    ["master 16:9 4K target", /id:\s*"master-16x9-4k"[\s\S]*?width:\s*3840[\s\S]*?height:\s*2160[\s\S]*?cover-master-16x9-3840x2160/],
    ["YouTube/common 1280x720 target", /id:\s*"youtube-1280x720"[\s\S]*?width:\s*1280[\s\S]*?height:\s*720[\s\S]*?cover-16x9-1280x720/],
    ["generic horizontal 4:3 target", /id:\s*"horizontal-4x3-1600x1200"[\s\S]*?width:\s*1600[\s\S]*?height:\s*1200[\s\S]*?cover-horizontal-4x3-1600x1200/],
    ["Bilibili 1146x717 target", /id:\s*"bilibili-common-1146x717"[\s\S]*?width:\s*1146[\s\S]*?height:\s*717[\s\S]*?cover-bilibili-1146x717/],
    ["Bilibili/HD 1920x1080 target", /id:\s*"bilibili-1920x1080"[\s\S]*?width:\s*1920[\s\S]*?height:\s*1080[\s\S]*?cover-16x9-1920x1080/],
    ["vertical 1080x1920 target", /id:\s*"vertical-1080x1920"[\s\S]*?width:\s*1080[\s\S]*?height:\s*1920[\s\S]*?cover-vertical-1080x1920/],
    ["vertical profile 1080x1440 target", /id:\s*"vertical-profile-1080x1440"[\s\S]*?width:\s*1080[\s\S]*?height:\s*1440[\s\S]*?cover-vertical-profile-1080x1440/],
    ["Instagram Reels cover target", /id:\s*"instagram-reels-cover"[\s\S]*?width:\s*420[\s\S]*?height:\s*654[\s\S]*?cover-instagram-reels-420x654/],
    ["square 1200x1200 target", /id:\s*"square-1200x1200"[\s\S]*?width:\s*1200[\s\S]*?height:\s*1200[\s\S]*?cover-square-1200x1200/],
    ["platform-specific strategy contract", /sharedContentPromiseMultiPlatformVariants[\s\S]*?platformSpecificDesignsGenerated:\s*true[\s\S]*?contentCategoryStrategy[\s\S]*?platformCoverStrategies[\s\S]*?masterCoverConcept/],
    ["cover creative methodology strategy", /function coverCreativeStrategy[\s\S]*?methodologyVersion:\s*"cover-gpt-methodology-v1"[\s\S]*?contentAssets[\s\S]*?clickMotivation[\s\S]*?visualHierarchy[\s\S]*?qaChecklist/],
    ["cover content asset extraction", /function coverContentAssets[\s\S]*?coreViewpoint[\s\S]*?userPain[\s\S]*?resultPromise[\s\S]*?contrarianPoint[\s\S]*?visualMetaphor[\s\S]*?credibleEvidence/],
    ["cover content category strategy", /function coverContentCategoryStrategy[\s\S]*?knowledge-tutorial[\s\S]*?story-entertainment[\s\S]*?review-product[\s\S]*?news-analysis[\s\S]*?vlog-lifestyle/],
    ["cover platform strategy selector", /function coverPlatformStrategy[\s\S]*?youtube-horizontal[\s\S]*?bilibili-horizontal[\s\S]*?instagram-grid[\s\S]*?short-video-vertical[\s\S]*?square-feed/],
    ["target-specific native cover brief selector", /function coverTargetImage2DesignBrief[\s\S]*?native 1146x717[\s\S]*?native 1600x1200[\s\S]*?native 1080x1440[\s\S]*?native 1200x1200/],
    ["Bilibili 1146x717 native prompt guard", /bilibili-common-1146x717[\s\S]*?native 1146x717[\s\S]*?central 1020x620 safe area[\s\S]*?no stacked duplicate cover/],
    ["3:4 profile native prompt guard", /vertical-profile-1080x1440[\s\S]*?native 1080x1440[\s\S]*?profile grid[\s\S]*?center 900x1120 safe area/],
    ["4:3 native prompt guard", /horizontal-4x3-1600x1200[\s\S]*?native 1600x1200[\s\S]*?1420x1030 central safe area[\s\S]*?no 16:9 source embedded/],
    ["1:1 native prompt guard", /square-1200x1200[\s\S]*?native 1200x1200[\s\S]*?center 1020x1020 safe area[\s\S]*?no horizontal crop/],
    ["cover layout strategy selector", /function coverLayoutStrategy[\s\S]*?ledger-payoff reveal cover[\s\S]*?misdirection-reveal contrast cover[\s\S]*?method-roadmap cover[\s\S]*?before-after craft cover/],
    ["premium UI layout readiness", /platformStrategiesApplied[\s\S]*?contentCategoryStrategyApplied[\s\S]*?templateSelectedForContent[\s\S]*?premiumUiLayoutSystem[\s\S]*?foregroundBackgroundDepth[\s\S]*?materialAndLightingPlanned/],
    ["cover click logic fields", /viewerDecision[\s\S]*?curiosityGap[\s\S]*?hookText[\s\S]*?payoffText/],
    ["cover Image 2 platform prompt contract", /targetId:\s*`\$\{target\.id\}-image2-integrated-cover`[\s\S]*?image2CoverPrompt[\s\S]*?platformStrategy[\s\S]*?contentCategoryStrategy[\s\S]*?cover-image2-prompts\.json[\s\S]*?gpt-image-2/],
    ["high-click knowledge cover prompt contract", /function highClickKnowledgeCoverPromptContract[\s\S]*?methodologyVersion:\s*"high-click-knowledge-cover-v1"[\s\S]*?High-click knowledge cover prompt contract[\s\S]*?改前[\s\S]*?改后[\s\S]*?strict visible-text whitelist|function highClickKnowledgeCoverPromptContract[\s\S]*?high-click-knowledge-cover-v1[\s\S]*?高点击知识封面提示词契约[\s\S]*?白名单/],
    ["cover Image 2 QC gate", /function coverImage2QualityGate[\s\S]*?promptQualityPass[\s\S]*?bitmapSubjectPresent[\s\S]*?integratedTypographyAssetPresent[\s\S]*?finalCoverQualityEligible[\s\S]*?reviewFallbackOnly[\s\S]*?cover-image2-qc\.json/],
    ["Context Image2 cover request artifact", /function writeContextImage2CoverRequests[\s\S]*?context-image2-cover-requests\.json[\s\S]*?prompts[\s\S]*?context-image2-covers[\s\S]*?codex-context-image2[\s\S]*?image_gen/],
    ["Image 2 integrated typography default cover engine", /defaultCoverEngine:\s*"image2-integrated-typography-cover"[\s\S]*?legacyCoverEngine:\s*"discarded-as-default"/],
    ["Image 2 native target-ratio status helper", /function coverAssetTargetRatioStatus[\s\S]*?targetRatioNativeMatch[\s\S]*?needs-native-target-ratio-image2/],
    ["Image 2 native target-ratio QC blocker", /targetRatioNativeFailures[\s\S]*?allIntegratedAssetsNativeTargetRatio[\s\S]*?regenerate native Image 2 assets for those target ratios before upload/],
    ["cover size upload readiness manifest", /qualityStatus[\s\S]*?needs-native-target-ratio-image2[\s\S]*?uploadReady[\s\S]*?needsRegeneration[\s\S]*?需原生重生成清单\.md/],
    ["Chinese final cover delivery output", /function writeCoverSizeSelection[\s\S]*?cover-size-selection\.json[\s\S]*?最终成品[\s\S]*?横版4比3[\s\S]*?竖版3比4/],
    ["cover integrated asset selection", /resolveCoverSubjectAsset[\s\S]*?cover-image2-integrated-typography[\s\S]*?selectedCoverAsset/],
    ["cover raster root copies", /rasterizeCoverVariants[\s\S]*?rootOutputCopies[\s\S]*?safeFileStem/],
    ["title-named MP4 copy", /titleVideoFile[\s\S]*?safeFileStem[\s\S]*?finalCopy:\s*titleVideoFile/],
    ["video ratio QC", /videoInternalCover\.ratio\s*===\s*aspectRatio\(canvas\.width,\s*canvas\.height\)/],
    ["cover-only CLI mode", /args\["cover-only"\][\s\S]*?mode:\s*"cover-only"[\s\S]*?standaloneCovers/],
  ];
  for (const [label, pattern] of requiredScriptPatterns) {
    expect(pattern.test(script), `script missing ${label}`, failures);
  }

  expect(!/YouTube \/ Bilibili 16:9/.test(script), "visible platform/spec labels must not be rendered into cover SVG", failures);
  expect(/adapt the cover strategy per platform/.test(skill), "SKILL.md must require platform-specific cover strategy variants", failures);
  expect(/high-click-knowledge-cover-v1/.test(skill), "SKILL.md must require the high-click knowledge cover prompt contract for knowledge/tutorial and creator-methodology covers", failures);
  expect(/platformSpecificDesignsGenerated:\s*true/.test(script), "script must record platform-specific design strategy state as enabled", failures);
  expect(/cover\.highClickCoverPromptContract\?\.methodologyVersion\s*===\s*"high-click-knowledge-cover-v1"/.test(script), "script QC must require generated cover-design.json to carry high-click-knowledge-cover-v1", failures);
  expect(/data-cover-supported-resolution-gallery/.test(semiAutoConfigBuilder) && /data-cover-supported-resolution-count/.test(semiAutoConfigBuilder), "semi-auto config page must expose a cover supported-resolution preview gallery", failures);
  expect(/data-cover-resolution-card/.test(semiAutoConfigBuilder) && /data-cover-target-id/.test(semiAutoConfigBuilder), "semi-auto cover gallery must render one selectable card per cover target id", failures);
  expect(/function coverFinalPreviewSample/.test(semiAutoConfigBuilder) && /finalPreview:\s*coverFinalPreview/.test(semiAutoConfigBuilder), "semi-auto cover module must default the large preview to a real final/sample cover image", failures);
  expect(/const readySlides = arrayify\(resolutionSlides\)/.test(finalPreviewFunction) && /const targetSlide = readySlides\.find\(\(slide\) => slide\.exactTargetPreview\)/.test(finalPreviewFunction), "semi-auto final cover preview must prefer upload-ready exact target resolution slides", failures);
  expect(finalPreviewFunction.indexOf("const readySlides") >= 0 && finalPreviewFunction.indexOf("const readySlides") < finalPreviewFunction.indexOf("const preferred"), "semi-auto final cover preview must not scan legacy cover samples before exact target files", failures);
  expect(/meta: coverSlideMeta\(targetSlide\)/.test(finalPreviewFunction), "semi-auto final cover preview must describe the selected target slide metadata", failures);
  expect(/data-cover-default-active/.test(semiAutoConfigBuilder), "semi-auto cover carousel must record whether the final cover preview is the default active image", failures);
  expect(/function coverResolutionSlides[\s\S]*?coverFileStem\(option\.file[\s\S]*?exactTargetPreview/.test(semiAutoConfigBuilder), "semi-auto cover gallery must bind resolution previews by exact target file stem before falling back", failures);
  expect(/function renderCoverOptionsPanel[\s\S]*?renderCoverAutoOption\(cover\)[\s\S]*?renderCoverRatioCompact\(cover\)/.test(semiAutoConfigBuilder), "semi-auto cover module must keep cover choices in one right-side options panel", failures);
  expect(/function renderCoverSection[\s\S]*?cover-review-board-simple[\s\S]*?renderCoverOptionsPanel\(cover\)[\s\S]*?renderCoverPreviewDialog/.test(semiAutoConfigBuilder), "semi-auto cover module must render the simplified final-preview plus options layout", failures);
  expect(!/function renderCoverSection[\s\S]*?\$\{renderCoverDecisionSurface\(cover\)\}/.test(semiAutoConfigBuilder), "semi-auto cover module must not render the old methodology decision surface in the config page", failures);
  expect(!/function renderCoverSection[\s\S]*?\$\{renderCoverTemplateSwitcher\(cover\)\}/.test(semiAutoConfigBuilder), "semi-auto cover module must not render the old template switcher block in the config page", failures);
  expect(/supportedResolutionCount:\s*coverResolutions\.length/.test(semiAutoConfigBuilder) && /resolutionGalleryRequired:\s*true/.test(semiAutoConfigBuilder), "semi-auto config manifest must record supported cover resolution count and gallery requirement", failures);
  for (const dimension of ["3840x2160", "1920x1080", "1280x720", "1600x1200", "1146x717", "1080x1920", "1080x1440", "420x654", "1200x1200"]) {
    expect(semiAutoConfigBuilder.includes(dimension) || script.includes(dimension), `cover target dimension ${dimension} must remain represented in workflow or semi-auto cover module`, failures);
  }
  expect(/simplified cover design module with cover generation enabled by default/.test(skill) && /one large final\/sample cover preview on the left/.test(skill) && /right-side options panel/.test(skill), "SKILL.md must require the simplified semi-auto cover design module with final preview and right-side options", failures);
  expect(/Semi-auto configuration pages must expose the cover package/.test(coverDesign), "cover-design.md must require semi-auto cover preview/resolution exposure", failures);
  expect(/Semi-auto cover configuration/.test(qualityGates), "quality-gates.md must require the semi-auto cover configuration gallery", failures);
  expect(/--cover-only/.test(skill), "SKILL.md must document cover-only output mode", failures);
  expect(/video-internal opening cover/.test(skill), "SKILL.md must separate video-internal cover from platform crops", failures);
  expect(/Platform Logic/.test(coverDesign) && /YouTube horizontal/.test(coverDesign) && /Bilibili horizontal/.test(coverDesign), "cover-design.md must document platform-specific cover logic", failures);
  expect(/High-Click Knowledge Cover Prompt Contract/.test(coverDesign) && /high-click-knowledge-cover-v1/.test(coverDesign) && /改前/.test(coverDesign) && /改后/.test(coverDesign), "cover-design.md must document the high-click knowledge cover prompt contract", failures);
  expect(/Layout Template Library/.test(coverDesign), "cover-design.md must document the layout template library", failures);
  expect(/Methodology Execution Contract/.test(coverDesign), "cover-design.md must document the methodology execution contract", failures);
  expect(/coverCreativeStrategy\.contentAssets\.coreViewpoint/.test(coverDesign), "cover-design.md must require content asset evidence", failures);
  expect(/not the universal default/.test(coverDesign), "cover-design.md must state the reference template is not universal", failures);
  expect(/Image 2-first/.test(coverDesign), "cover-design.md must make Image 2-first the main cover engine", failures);
  expect(/cover-image2-qc\.json/.test(coverDesign), "cover-design.md must require cover Image 2 QC evidence", failures);
  expect(/Cover Image 2 QC/.test(qualityGates), "quality-gates.md must require cover Image 2 QC", failures);
  expect(/High-click knowledge cover contract/.test(qualityGates) && /high-click-knowledge-cover-v1/.test(qualityGates), "quality-gates.md must require the high-click knowledge cover prompt contract", failures);
  expect(/old decorative\/title-card SVG logic as the default cover/.test(coverDesign), "cover-design.md must reject old SVG title-card logic as default", failures);
  expect(/Video opening frame \| Match final MP4 ratio/.test(coverDesign), "cover-design.md must document video opening cover ratio", failures);
  expect(/platformCoverStrategies/.test(qualityGates), "quality-gates.md must require platform strategy evidence", failures);
  expect(/cover-master-16x9-3840x2160\.svg/.test(readme), "README must list master 16:9 cover output", failures);
  expect(/--cover-only/.test(readme), "README must document cover-only CLI usage", failures);
  expect(/workflow\/cover-size-selection\.json/.test(readme), "README must list cover size selection output", failures);
  expect(/build-cover-size-selection-index\.mjs/.test(skill) && /build-cover-size-selection-index\.mjs/.test(coverDesign) && /build-cover-size-selection-index\.mjs/.test(qualityGates), "skill/docs must document the batch cover size selection index script", failures);
  expect(/white\/cream frames/.test(skill) && /white\/cream frames/.test(coverDesign) && /white\/cream frames/.test(qualityGates), "skill/docs must reject visible white/cream frames in fitted cover adaptations", failures);
  expect(/needs-native-target-ratio-image2/.test(skill) && /uploadReady: false/.test(coverDesign) && /Final upload-ready exports require true target-ratio bitmaps/.test(qualityGates), "skill/docs must require native target-ratio Image 2 assets and mark non-native adaptations as non-upload-ready", failures);
  expect(/review-only-local-target-ratio-recomposition/.test(skill) && /封面预览-非上传终版/.test(skill) && /must remain excluded from `最终成品\/`/.test(skill), "SKILL.md must make local target-ratio recomposition preview-only and exclude it from final delivery", failures);
  expect(/review-only-local-target-ratio-recomposition/.test(coverDesign) && /uploadReady: false/.test(coverDesign) && /must not appear in `最终成品\/`/.test(coverDesign), "cover-design.md must make local target-ratio recomposition non-upload-ready", failures);
  expect(/review-only-local-target-ratio-recomposition/.test(qualityGates) && /saved only under `封面预览-非上传终版\/`/.test(qualityGates), "quality-gates.md must keep local target-ratio previews outside final delivery", failures);
  expect(/reviewGradeDraftAllowed/.test(script) && /reviewGradeSuppressedUntilNativeImage2/.test(script) && /nonNativeTargetRatioReviewDraftsSuppressed/.test(script), "single output selection must suppress target-size review drafts for missing non-16:9 native Image2 targets", failures);
  expect(/4:3[\s\S]*3:4[\s\S]*target-size review-grade drafts/.test(skill) && /do not write target-size review-grade drafts/.test(coverDesign) && /must not write target-size review-grade local files/.test(qualityGates), "skill/docs must forbid 4:3/3:4 target-size local review drafts when native Image2 is missing", failures);
  expect(/const uploadReady = Boolean\(asset\?\.uploadReady && asset\?\.targetRatioNativeMatch\)/.test(script) && /reviewOnlyPreviewDirectory/.test(script) && /localTargetRatioRecompositionPreviewOnly/.test(script) && /previewFiles/.test(script), "single output selection must only copy native upload-ready covers and route local recompositions to preview files", failures);
  expect(/function pruneRootCoverCopiesAfterFinalDelivery/.test(script) && /rootCopyPruning/.test(script), "root-level topic cover copies must be pruned after final delivery consolidation", failures);
  expect(/humanSelectionContainsOnlyUploadReady/.test(batchSizeIndexScript) && /nonUploadReadyVisualFilesCopied:\s*false/.test(batchSizeIndexScript) && /review-only-local-target-ratio-recomposition/.test(batchSizeIndexScript) && /封面预览-非上传终版/.test(batchSizeIndexScript), "batch selection rebuild must only copy native upload-ready target-ratio covers into each topic final directory and route local recompositions to preview", failures);
  expect(/topicScopedFinalDeliveryDirectory/.test(script) && /groupedByChineseAspectRatio/.test(script), "single output selection must keep a topic-scoped grouped final cover directory", failures);
  expect(/_封面总索引/.test(batchSizeIndexScript) && /topicScopedFinalDeliveryDirectory/.test(batchSizeIndexScript) && /rootFinalImageDirectoriesRemoved/.test(batchSizeIndexScript) && /cleanedTopicFiles/.test(batchSizeIndexScript), "batch index script must keep final covers under each topic and generate a lightweight index only", failures);
  expect(/local-target-ratio-recomposition/.test(script) && /localTargetRatioRecomposition/.test(script) && /COVER_LOCAL_RECOMPOSITION_PREVIEW/.test(script), "script must support clearly marked local 4:3/3:4 target-ratio recomposition preview only behind an explicit preview switch when Image 2 API credentials are unavailable", failures);
  expect(/COVER_LOCAL_RECOMPOSITION_PREVIEW=1/.test(skill) && /COVER_LOCAL_RECOMPOSITION_PREVIEW=1/.test(coverDesign) && /COVER_LOCAL_RECOMPOSITION_PREVIEW=1/.test(qualityGates), "skill/docs must require an explicit switch before local 4:3/3:4 recomposition previews are generated", failures);
  expect(/generate-cover-targets-image2\.mjs/.test(skill) && /generate-cover-targets-image2\.mjs/.test(coverDesign), "skill/docs must document the explicit Image2 target-ratio completion script", failures);
  expect(/ingest-codex-image2-cover-target\.mjs/.test(skill) && /ingest-codex-image2-cover-target\.mjs/.test(coverDesign), "skill/docs must document the Codex built-in Image2 cover ingest script", failures);
  expect(/context-image2-cover-requests\.json/.test(skill) && /Context Image2/.test(skill) && /image_gen/.test(skill), "SKILL.md must require Context Image2 image_gen cover requests from core cover logic", failures);
  expect(/Canonical generated-image rule/.test(skill) && /every workflow-generated bitmap must be produced through Codex Context Image2/.test(skill) && /provider `codex-context-image2` and tool `image_gen`/.test(skill), "SKILL.md must make Codex Context Image2/image_gen the canonical provider for all workflow-generated bitmaps", failures);
  expect(/Canonical Codex Image2 Rule/.test(imageGenerationRouting) && /every workflow-generated bitmap/.test(imageGenerationRouting) && /provider `codex-context-image2`, tool `image_gen`/.test(imageGenerationRouting), "image-generation-routing.md must document Codex Context Image2/image_gen as the canonical generated-bitmap route", failures);
  expect(/Final-quality runs that require or use workflow-generated bitmaps/.test(qualityGates) && /provider `codex-context-image2`, tool `image_gen`/.test(qualityGates), "quality-gates.md must fail final packages that use generated bitmaps without Codex Context Image2/image_gen provenance", failures);
  expect(/context-image2-cover-requests\.json/.test(coverDesign) && /Context Image2 Handoff Contract/.test(coverDesign), "cover-design.md must document the Context Image2 cover handoff contract", failures);
  expect(/context-image2-cover-requests\.json/.test(qualityGates) && /contextImage2Required/.test(qualityGates), "quality-gates.md must require Context Image2 request and QC evidence", failures);
  expect(/synthetic side panels/.test(skill) && /synthetic side panels/.test(coverDesign) && /synthetic side panels/.test(qualityGates), "skill/docs must reject synthetic side panels for missing native target ratios", failures);
  expect(!/需原生重生成-非上传终版/.test(script) && !/需原生重生成-非上传终版/.test(batchSizeIndexScript) && !/需原生重生成-非上传终版/.test(skill), "non-upload-ready visual cover suffix must not be used because those files should not enter selection galleries", failures);
  expect(!/stroke="#fff7e6"/.test(script), "integrated cover aspect-fit adaptation must not add a visible cream frame stroke", failures);
  expect(!/preserveAspectRatio="xMidYMid meet"/.test(script), "integrated cover aspect adaptation must not use direct meet letterboxing", failures);
  expect(!/coverFitMask|coverFitBlur|function fittedImageRects/.test(script), "non-native ratio previews must not use layered blur/fit/feather masks that duplicate the cover artwork", failures);
	  expect(/最终成品/.test(batchSizeIndexScript) && /封面总索引\.html/.test(batchSizeIndexScript), "batch index script must generate a Chinese linked index without duplicating final cover images into the batch root", failures);
	  expect(/allowPendingNativeTargets/.test(batchSizeIndexScript) && /pendingNativeTargetCount/.test(batchSizeIndexScript) && /allTargetsUploadReady/.test(batchSizeIndexScript), "batch index script must expose pending-native-target readiness state", failures);
	  expect(/const ok = missing\.length === 0 && \(allowPendingNativeTargets \|\| pendingNativeTargetCount === 0\)/.test(batchSizeIndexScript), "batch index script must fail by default when native target-ratio covers are still pending", failures);
	  expect(/--allow-pending-native-targets/.test(skill) && /--allow-pending-native-targets/.test(coverDesign) && /--allow-pending-native-targets/.test(qualityGates), "skill/docs must document that pending native target covers are allowed only for explicitly partial review packages", failures);
	  expect(/entry\.internalReviewFiles/.test(batchSizeIndexScript), "batch index script must fall back to internal cover review files so repeated rebuilds do not lose source assets after pruning final directories", failures);
  expect(/selectionEntriesWithResolutionPresets/.test(batchSizeIndexScript) && /coverDesign\.resolutionPresets/.test(batchSizeIndexScript) && /exact-target-ratio-file/.test(batchSizeIndexScript), "batch index script must recover exact-ratio files listed in cover-design resolutionPresets when cover-size-selection omitted them", failures);
	  expect(/entryFromMissingResolutionPreset/.test(batchSizeIndexScript) && /needs-native-target-ratio-image2/.test(batchSizeIndexScript), "batch index script must surface missing standard resolutionPresets as pending native Image2 targets instead of letting dimensions disappear", failures);
	  expect(/function standardCoverFileForTarget/.test(batchSizeIndexScript) && /cover-master-16x9-3840x2160/.test(batchSizeIndexScript), "batch index script must recover standard-named cover files even when resolutionPresets omitted the file path", failures);
	  expect(/currentEntryIds/.test(batchSizeIndexScript) && /selection\.needsRegeneration/.test(batchSizeIndexScript), "batch index script must not let stale selection.needsRegeneration override current upload-ready entries", failures);
	  expect(/function cleanupFileName/.test(batchSizeIndexScript), "batch index script must handle structured root output copy entries while pruning old root-level cover files", failures);
  expect(/OPENAI_API_KEY is missing\. Refusing to fake Image2 cover generation\./.test(targetImage2Script), "native target-ratio cover generator must refuse to fake Image2 output when credentials are missing", failures);
  expect(/function topicDirsForRoot[\s\S]*?workflow[\s\S]*?cover-size-selection\.json[\s\S]*?cover-image2-prompts\.json/.test(targetImage2Script), "native target-ratio cover generator must support a single topic root as well as a batch root", failures);
  expect(/gpt-image-2-api-explicit-opt-in/.test(targetImage2Script) && /model:\s*process\.env\.OPENAI_IMAGE_MODEL\s*\|\|\s*"gpt-image-2"/.test(targetImage2Script), "native target-ratio cover generator must use the explicit GPT Image 2 API path", failures);
  expect(/function pendingEntries/.test(targetImage2Script) && /design\.resolutionPresets/.test(targetImage2Script) && /prompts\.pendingNativeTargetRatioPrompts/.test(targetImage2Script), "native target-ratio generator must derive missing-only scope from selection entries, cover resolutionPresets, and pending prompt targets", failures);
  expect(/function targetPromptSuffix/.test(targetImage2Script) && /Target-ratio completion guard/.test(targetImage2Script), "native target-ratio generator must append target-specific native composition guards when reusing a master prompt", failures);
  expect(/pendingNativeTargetRatioPrompts/.test(targetImage2Script) && /fulfilledNativeTargetRatioExports/.test(targetImage2Script), "native target-ratio cover generator must move prompts from pending to fulfilled only after real Image2 output", failures);
  expect(/upload-ready-native-target-ratio/.test(targetImage2Script) && /image2NativeTargetRatioReady\s*=\s*true/.test(targetImage2Script) && /localTargetRatioRecomposition\s*=\s*false/.test(targetImage2Script), "native target-ratio cover generator must mark upload readiness only for real target-ratio Image2 output", failures);
  expect(/chooseImage2Size/.test(targetImage2Script) && /sips/.test(targetImage2Script) && /exactPlatformSize/.test(targetImage2Script), "native target-ratio cover generator must request a legal Image2 canvas and resize to the exact platform target without crop/letterbox fallback", failures);
  expect(/provider:\s*"codex-built-in-imagegen"/.test(codexImage2IngestScript) && /requestedCodexImageSize/.test(codexImage2IngestScript), "Codex Image2 ingest script must record the Codex built-in provider and source dimensions", failures);
  expect(/"youtube-1280x720":\s*"horizontal-16x9-1280x720"/.test(codexImage2IngestScript) && /"bilibili-1920x1080":\s*"horizontal-16x9-1920x1080"/.test(codexImage2IngestScript), "Codex Image2 ingest script must accept standard cover target ids emitted by the core cover engine", failures);
  expect(/refusing to distort\/crop/.test(codexImage2IngestScript) && /Math\.abs\(expectedRatio - imageRatio\)/.test(codexImage2IngestScript), "Codex Image2 ingest script must reject source bitmaps that do not match the target ratio", failures);
  expect(/pendingNativeTargetRatioPrompts/.test(codexImage2IngestScript) && /fulfilledNativeTargetRatioExports/.test(codexImage2IngestScript), "Codex Image2 ingest script must move native target prompts from pending to fulfilled", failures);
  expect(/coreCoverLogicPresent[\s\S]*defaultCoverEngine[\s\S]*image2-integrated-typography-cover[\s\S]*provider[\s\S]*codex-context-image2/.test(nativeFinalRendererScript), "native-final renderer must detect existing core Image2 cover logic before writing review covers", failures);
  expect(/native-final-cover-review\.json/.test(nativeFinalRendererScript) && /if \(!coreCoverLogicPresent\)[\s\S]*writeJson\(coverDesignPath[\s\S]*writeJson\(coverSizeSelectionPath[\s\S]*writeJson\(contextImage2RequestsPath/.test(nativeFinalRendererScript), "native-final renderer must preserve existing core cover-design/context Image2 artifacts instead of overwriting them", failures);
  expect(/coverNativeImage2Ready/.test(nativeFinalRendererScript) && /native-image2-ready/.test(nativeFinalRendererScript) && /review-grade-pending-context-image2/.test(nativeFinalRendererScript), "native-final renderer must fail final cover readiness until a real native Image2 cover target is ingested", failures);
  expect(/sourceImageCountPlanRequiredCount/.test(nativeFinalRendererScript) && /nativePageCountSatisfiesSourceImageCountPlan/.test(nativeFinalRendererScript), "native-final renderer must enforce the source personal-IP automatic image-count policy", failures);
  expect(/explicitTargetRaisedToAutomatic/.test(personalIpImagePlannerScript) && /allowUnderCount/.test(personalIpImagePlannerScript) && /automaticResolvedTarget/.test(personalIpImagePlannerScript), "personal-IP image planner must not let target-image-count undercut the automatic duration/content/cue policy by default", failures);
  expect(/requestedMaxImageCount/.test(personalIpImagePlannerScript) && /maxImageCountRaisedToAutomaticPolicy/.test(personalIpImagePlannerScript), "personal-IP image planner must not let max-image-count undercut the automatic duration/content/cue policy by default", failures);
  expect(/provider:\s*"codex-context-image2"[\s\S]*tool:\s*"image_gen"/.test(personalIpImagePlannerScript) && /canonicalImageProvider:\s*"codex-context-image2"[\s\S]*canonicalImageTool:\s*"image_gen"/.test(personalIpImagePlannerScript), "personal-IP image planner must record Codex Context Image2/image_gen as the canonical generated-page provider", failures);
  expect(/if \(!qc\.pass && !allowUnverifiedNativePages/.test(nativeFinalRendererScript) && /process\.exitCode = 2/.test(nativeFinalRendererScript), "native-final renderer must exit nonzero when final QC fails by default", failures);
  expect(/maxImageCountRaisedToAutomaticPolicy/.test(skill) && /maxImageCountRaisedToAutomaticPolicy/.test(qualityGates), "skill/docs must require max-image-count undercut detection and automatic raising for personal-IP image plans", failures);
  expect(/allow-draft-output true/.test(skill) && /allow-draft-output true/.test(qualityGates), "skill/docs must keep unbound ingested personal-IP pages draft-only unless explicitly allowed", failures);
  expect(/coverNativeImage2Ready/.test(skill) && /coverNativeImage2Ready/.test(qualityGates), "skill/docs must require native-final coverNativeImage2Ready before claiming final personal-IP delivery", failures);
  expect(/const coverArtifactsPromise = writeCoverArtifacts[\s\S]*const finalRenderRequested =/.test(script), "core cover design lane must start before personal-IP native-final pre-render blocking checks", failures);
  expect(/stage:\s*"pre-cover-full-render"[\s\S]*await coverArtifactsPromise[\s\S]*fail\(error\.message\)/.test(script), "personal-IP pre-cover native-final blocker must wait for core cover artifacts before failing the video lane", failures);
  expect(/stage:\s*"pre-audio-full-render"[\s\S]*await coverArtifactsPromise[\s\S]*fail\(error\.message\)/.test(script), "personal-IP pre-audio native-final blocker must wait for the parallel cover lane before failing the video lane", failures);
  expect(/personal-ip-native-final-blocked\.json/.test(script) && /coreCoverArtifacts[\s\S]*workflow\/cover-design\.json[\s\S]*workflow\/context-image2-cover-requests\.json/.test(script), "personal-IP native-final blocker manifest must expose the independent core cover artifacts", failures);

	  mkdirSync(outDir, { recursive: true });
  const report = {
    ok: failures.length === 0,
    requiredTargets: [
      "cover-video-opening-[final-mp4-ratio].svg",
      "cover-master-16x9-3840x2160.svg",
      "cover-16x9-1920x1080.svg",
      "cover-16x9-1280x720.svg",
      "cover-horizontal-4x3-1600x1200.svg",
      "cover-bilibili-1146x717.svg",
      "cover-vertical-1080x1920.svg",
      "cover-vertical-profile-1080x1440.svg",
      "cover-instagram-reels-420x654.svg",
      "cover-square-1200x1200.svg",
    ],
    policy: {
      sharedContentPromiseMultiPlatformVariants: true,
      platformSpecificDesignsGeneratedByDefault: true,
      platformCoverStrategiesRequired: true,
      contentCategoryStrategyRequired: true,
      competitorResearchPlanRequired: true,
      videoInternalCoverMatchesMp4Ratio: true,
      coverMustExposeClickLogic: true,
      coverImage2PromptsRequired: true,
      coverImage2QcRequired: true,
      contextImage2CoverRequestsRequired: true,
      contextImage2UsesCoreCoverLogic: true,
      highClickKnowledgeCoverPromptContractRequired: true,
      image2IntegratedTypographyIsDefault: true,
      integratedTypographyHardCropRejected: true,
      visibleLetterboxBandRejected: true,
      visibleWhiteFrameRejected: true,
      nativeTargetRatioImage2Required: true,
      localTargetRatioRecompositionGapFillTracked: true,
      nonNativeAdaptationsUploadReadyRejected: true,
      chineseReadableSizeSelectionRequired: true,
      topicScopedFinalDeliveryDirectory: true,
      legacyTitleCardCoverRejected: true,
      pngJpgRasterExportsRequired: true,
      titleNamedVideoCopyRequired: true,
      visiblePlatformLabelsRejected: true,
      coverOnlyModeRequired: true,
      semiAutoCoverResolutionGalleryRequired: true,
      semiAutoCoverExactTargetPreviewBindingRequired: true,
      semiAutoCoverFinalPreviewDefaultRequired: true,
      semiAutoCoverSimplifiedReviewLayoutRequired: true,
    },
    checkedFiles: [
      "scripts/poc-video-workflow.mjs",
      "scripts/build-cover-size-selection-index.mjs",
      "scripts/generate-cover-targets-image2.mjs",
      "scripts/ingest-codex-image2-cover-target.mjs",
      "scripts/build-semi-auto-config-html.mjs",
      "SKILL.md",
      "references/cover-design.md",
      "references/image-generation-routing.md",
      "references/quality-gates.md",
      "README.md",
    ],
    failures,
  };
  writeFileSync(join(outDir, "cover-target-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
