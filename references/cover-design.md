# Cover Design

Use this reference before final packaging for any social video. The cover/thumbnail is not an afterthought; it is the viewer's first decision surface and must be designed from the same content strategy as the video.

## Research Anchors

- YouTube Help says viewers usually see thumbnail and title first, and recommends audience targeting, rule-of-thirds composition, readable fonts, simple design, and device-aware large images.
- YouTube custom-thumbnail guidance recommends large 16:9 images, common image formats, and policy-safe thumbnails.
- TikTok Support defines a video cover as the thumbnail shown in places such as profile and search, selected before posting.
- X Media Studio allows selecting a video frame or uploading a custom thumbnail, and warns that mismatched aspect ratios can cause playback issues.
- X creative specs list PNG/JPEG thumbnails, matching aspect ratio, and platform-specific image/video aspect ratios.
- Bilibili/Chinese creator-cover guidance consistently emphasizes clear subject, high image quality, concise readable text, strong composition, and content-consistent atmosphere.

## Required Artifact

Every final-quality run must write `workflow/cover-design.json` before packaging. It must include:

- `researchSynthesis`: 3-6 bullet summary of platform thumbnail lessons used for this cover.
- `sharedContentPromiseMultiPlatformVariants`: must be `true` for platform publishing packages.
- `platformSpecificDesignsGenerated`: must be `true` for common-platform cover packages because each platform has a different click surface; keep the same content truth while adapting layout, information density, and safe area.
- `contentCategoryStrategy`: inferred category strategy such as knowledge/tutorial, story/entertainment, review/product, news/analysis, or vlog/lifestyle.
- `platformCoverStrategies`: one strategy per output target, including decision surface, click logic, text density, safe area, layout bias, and Image 2 prompt role.
- `competitorResearchPlan`: when to use network search or category competitor scans, how sources are recorded, and the no-copy boundary.
- `masterCoverConcept`: the shared click promise and content truth used across platform variants.
- `masterCoverConcept.compositionTemplate`: the selected layout template for this topic. The reference-style `problem-to-proof transformation cover` is only one candidate, not the universal default.
- `masterCoverConcept.compositionReason`, `compositionBlueprint`, and `uiQualityBars`: why this template fits the title/script and which UI/layout quality rules must be preserved.
- `resolutionPresets`: standalone upload/social export sizes and ratios, such as 3840x2160, 1920x1080, 1280x720, generic horizontal 4:3 1600x1200, Bilibili common 1146x717, 1080x1920, 1080x1440, Instagram Reels 420x654, and square 1200x1200.
- `platformTargets`: compatibility metadata for upload/social targets. These are strategy-specific variants sharing one content truth, not blind crops.
- `videoInternalCover`: the cover frame asset that matches the MP4 canvas. It is exported for continuity/review and is rendered inside the MP4 only when explicitly requested.
- `image2CoverPromptFile`: `workflow/cover-image2-prompts.json`, containing GPT Image 2 visual prompts derived from the title plus narration/script and adapted to platform strategy variants, plus the resolution preset list.
- `coverImage2QualityGateFile`: `workflow/cover-image2-qc.json`, containing pre-generation prompt QC plus post-generation bitmap eligibility. If no real Image 2/Codex bitmap with integrated cover typography is present, `finalCoverQualityEligible` must be `false` and the package is review-only.
- `clickMotivation`: one of the video's primary click reasons, such as result-method, problem-avoidance, contradiction-explanation, conflict, or clear-promise.
- `coverQaScore`: the 100-point cover readiness score covering click motivation, main visual clarity, text readability, platform fit, content truth, brand consistency, and freshness.
- `rasterExport`: PNG/JPG export evidence, including each file's dimensions, byte size, and size-limit pass/fail.
- `rootOutputCopies`: compatibility metadata pointing at user-facing PNG/JPG cover files in the topic-scoped `最终成品/`. Do not leave duplicate cover copies in the output root after final packaging.
- `viewerDecision`: what the viewer should understand or feel within one second.
- `coverTitle`: the viewer-facing title used by the cover package. When the input brief has `title`, use the title description after stripping chapter/course prefixes such as `第 03 章：`; record `coverTitleSource: "brief.title"`.
- `coverPromise`: the single viewer-facing promise the cover makes.
- `curiosityGap`: the unresolved tension, question, contradiction, or surprising claim that makes the viewer want the answer.
- `hookText`: the short readable text, preferably 4-10 Chinese characters for mobile-first Chinese covers and no more than two text groups.
- `payoffText`: optional second text group that states the promised outcome; it must be shorter than the hook and cannot duplicate the video title.
- `visualSubject`: the dominant image or metaphor; it must be inspectable at small size.
- `emotionalSignal`: the visible emotion or tension, such as confusion, loss, pressure, contradiction, reveal, danger, desire, or transformation.
- `composition`: focal point, rule-of-thirds or centered poster logic, negative space, and play-button/timecode collision avoidance.
- `typography`: font role, weight, contrast, and mobile readability rule.
- `colorContrast`: dominant palette, accent color, and how the focal signal separates from the background.
- `smallPreviewTest`: the expected result at 120-180 px wide; hook and visual subject must remain legible.
- `platformVariants`: legacy-compatible output file paths and dimensions for each resolution preset; these must record the platform strategy and a `creativeRole` such as `platform-specific-click-strategy`.
- `contentTruth`: how the cover accurately reflects the video, avoiding clickbait or a promise the video does not pay off.
- `rejectList`: concrete failures such as tiny text, generic AI shine, too many elements, misleading hook, low-res still, copied creator style, and wrong ratio.
- `defaultCoverEngine`: must be `image2-integrated-typography-cover` for normal runs.
- `selectedCoverAsset`: records the Image 2/Codex `image_gen` complete cover selected from the brief or `--codex-image-assets-dir`; when absent, or when only a background/subject asset is available, the run must record that the integrated typography bitmap is prompt-pending and the rendered cover is a degraded review fallback, not the old default.

## Design Method

Use this sequence before creating the image:

1. Extract the core viewer pain, desire, or contradiction from the script.
2. Use both the user-provided title and the spoken narration/script to translate the topic into a one-second click promise. Do not simply paste the video title onto a card.
3. Infer content category and set the category strategy:
   - **Knowledge/tutorial**: promise a usable result, show proof/method object, use problem/result copy such as `这一步别做错`, `看完就会`, or `别再X`.
   - **Story/entertainment**: foreground conflict, suspense, pressure, relationship change, or hidden truth.
   - **Review/product**: foreground real result, comparison, score, product close-up, or buying/usage consequence.
   - **News/analysis**: foreground credible object, chart, timeline, cause/effect split, and one clear impact.
   - **Vlog/lifestyle**: foreground real scene, person/state, location/object detail, and lower text density.
4. If category or platform behavior may have shifted, run a focused web/category scan before prompt generation. Record official platform guidance and 3-5 competitor-cover observations as abstract click logic; do not copy layout, assets, creator identity, brand, or exact wording.
5. Choose one of these thumbnail patterns:
   - **Contradiction**: wrong belief versus right mechanism, before versus after, failure versus fix.
   - **Curiosity gap**: a strong question or missing explanation the video resolves.
   - **Transformation**: low state versus high state with the mechanism visible.
   - **Evidence/reveal**: one concrete artifact, result, or hidden rule made visually inspectable.
   - **Emotional close-up/metaphor**: a face, hand, object, or symbolic scene carrying obvious feeling.
6. Build the cover with no more than 2-3 major visual elements: hook text, subject/metaphor, and one accent signal.
7. Make the hook readable at mobile grid size. Use large type, high contrast, and strong negative space.
8. Apply platform strategy before rendering: decide text density, crop-safe area, grid/list/search role, and which information the viewer must see first.
9. Check content truth: the video must pay off the promise in the opening and body.
10. Remove platform/spec labels, workflow labels, captions, file paths, renderer names, and any production evidence from the visible cover.
11. Check the cover does not look like a PPT slide: no course-heading-first layout, no small body copy, no decorative card grid, no internal process labels, and no full title repeated as the dominant visual when a sharper hook is available.

## Methodology Execution Contract

The cover engine must run the methodology before choosing or rendering a layout. `workflow/cover-design.json` and `workflow/cover-image2-prompts.json` must expose this strategy so reviewers can see why the cover exists:

- `coverCreativeStrategy.contentAssets.coreViewpoint`: what the video proves.
- `coverCreativeStrategy.contentAssets.userPain`: the viewer problem being struck.
- `coverCreativeStrategy.contentAssets.resultPromise`: what the viewer gets after clicking.
- `coverCreativeStrategy.contentAssets.contrarianPoint`: the unfinished idea, contrast, or hidden reason.
- `coverCreativeStrategy.contentAssets.visualMetaphor`: the main inspectable object or scene.
- `coverCreativeStrategy.contentAssets.credibleEvidence`: the proof, step, comparison, or result that makes the promise trustworthy.
- `coverCreativeStrategy.clickMotivation`: the primary decision trigger, such as result-method, problem-avoidance, contradiction-explanation, conflict, or clear-promise.
- `coverCreativeStrategy.copywriting`: the hook/payoff formula and title-complement rule.
- `coverCreativeStrategy.visualHierarchy`: the 2-3 major elements and their first-read order.
- `coverCreativeStrategy.qaChecklist`: the one-second decision, small-preview, truth, and anti-PPT checks.

Only after this strategy exists should the engine select a composition template. The selected template is a layout response to the strategy, not the strategy itself. A reference image can inspire quality bars, depth, hierarchy, and finish, but it must not become a universal template.

## High-Click Knowledge Cover Prompt Contract

For knowledge/tutorial, creator-methodology, AI/tool/workflow, video-operation, and short-video profile covers, the cover engine must apply the `high-click-knowledge-cover-v1` prompt contract before writing `workflow/cover-image2-prompts.json`.

This contract is adapted from the user-provided high-click B站/YouTube and short-video cover prompt. It is not a one-off example image. It is the default Image 2 cover methodology for this category family:

1. Extract the topic, target audience, core selling point, and 4-8 character dominant Chinese title from `brief.title`, `brief.coverTheme`, `brief.objective`, and the spoken narration/script.
2. Use a professional high-click knowledge-cover composition, not a configuration page, internal evidence board, PPT title card, workflow mock, or decorative title card.
3. For horizontal B站/YouTube-style covers, compose natively in the target ratio: left side original knowledge presenter / personal-IP speaker / strong proof subject, center or right oversized Chinese title, lower before-vs-after proof card, upper growth arrow or warning/action signal. First read: title. Second read: subject. Third read: proof.
4. For vertical Douyin/TikTok/Reels/Xiaohongshu-style covers, keep the presenter or core subject in the center, place the main title in the middle safe area, put the subtitle directly below it, and keep proof/arrow/warning elements around the subject without using the top or bottom as critical text zones.
5. Show at least one click driver: cognitive gap, strong contrast, pain warning, result promise, reusable method, or mistake alert. For cover/click/creator-growth topics, the proof card may use approved example labels such as `改前`, `改后`, `点击率 2.1%`, and `点击率 11.3%`. For other topics, use `改前` / `改后` plus graphic marks unless the script provides truthful numeric evidence.
6. Use a strict text whitelist. Image 2 may render only the approved title, subtitle/method line, action badge, and approved proof labels. No extra Chinese/English words, random numbers, platform names, pseudo captions, UI labels, handwritten filler, watermarks, logos, QR codes, or technical/workflow labels may appear.
7. Use 3-4 dominant colors at most. Prefer strong contrast: dark/deep neutral or clean background, white/yellow/red accent hierarchy, and a background that never competes with the title or subject. Topic-specific palettes can replace black, but contrast must stay high.
8. Presenter/persona expression is a quality bar, not a generic tension knob. Default knowledge-cover presenters should look focused, confident, clear, approachable, or lightly surprised. Do not let repeated pain-warning language collapse every cover into frowning, angry, anxious, scolding, exaggerated grimace, or furrowed-brow faces; use tense expressions only when the actual topic/script needs them.
9. Reject cheap marketing poster style, overdone cyberpunk, cluttered element piles, tiny text, misspelled or distorted Chinese, cut-off typography, subject/title overlap, copied creator layout, unauthorized likeness, and clickbait promises the video does not pay off.

`workflow/cover-design.json` must record `highClickCoverPromptContract.methodologyVersion: "high-click-knowledge-cover-v1"`, and every item in `workflow/cover-image2-prompts.json.prompts` must carry the same prompt contract. The prompt QC gate should fail if this contract disappears from knowledge/tutorial or creator-methodology cover prompts.

## Layout Template Library

Select a cover layout from the content. Do not force every cover into the same reference style.

Use `problem-to-proof transformation cover` for click-improvement, problem/solution, and "why nobody clicks/reads/watches" topics:

- Left: oversized pain/question hook that names the viewer's problem.
- Middle: a weak/failed draft/card/image with X, warning, or "wrong path" signal.
- Center: a strong arrow or motion cue that makes transformation obvious.
- Right: a premium result/proof board with target/check, success object, or improved cover/story outcome.
- Bottom: 4-6 method-step icons/beads that summarize the path, such as selection, audience, promise, design, text, test/review.

Use other templates when they fit better:

- `method-roadmap cover`: messy draft/idea cluster -> path/milestones -> finished sample. Use for planning, snowflake, chapter outline, revision loop, or sample-building topics.
- `misdirection-reveal contrast cover`: wrong interpretation versus hidden truth, with a ripped layer, spotlight, or clue reveal. Use for reversal and misdirection.
- `ledger-payoff reveal cover`: clue ledger, promise entries, payoff object. Use for foreshadowing and payoff topics.
- `character-pressure cover`: desire, obstacle, pressure line, choice/debt marker. Use for character arcs, antagonists, and relationship debt.
- `before-after craft cover`: weak fragment versus vivid fragment, correction marks, craft magnifier. Use for dialogue voice, prose texture, and removing AI flavor.

Use Image 2 for the complete cover: depth, lighting, material, target/check/proof objects, premium finish, and the main Chinese title/subtitle/badge typography. Keep deterministic overlay layers only for fallback/text-repair after review, not as the default typography system.

## Platform Logic

| Preset / use | Default export size | Design emphasis | Guardrail |
| --- | --- | --- | --- |
| Shared promise | All targets | Same video truth, same title/script payoff, same core hook family | Do not make unrelated concepts per platform; adapt strategy, not truth |
| YouTube horizontal | 3840x2160 and 1280x720 | Thumbnail plus title as the click decision: very low text count, high contrast, one proof object, curiosity/result promise | Optimize for truthful CTR plus watch-time payoff, not clickbait |
| Generic horizontal 4:3 | 1600x1200 | Taller horizontal preview/card: same click promise, larger central proof object, less edge-dependent information | Do not stretch a 16:9 design; preserve the hook and subject in the 4:3 safe area |
| Bilibili horizontal/common | 1920x1080 and 1146x717 | List/search card: Chinese-first hierarchy, series identity, slightly higher information density, visible method proof | Main hook still dominates; avoid PPT/course title layout |
| Douyin/TikTok/Kuaishou vertical | 1080x1920 | Profile/search cover plus first-frame continuity: searchable topic, centered critical hook, low-medium text density | Keep important content inside center 3:4/vertical safe area; do not rely on tiny side details |
| Vertical profile | 1080x1440 | Homepage grid scan: topic + promise must be legible in dense creator profile | Center critical hook and subject |
| Instagram Reels cover | 420x654 | Profile-grid conversion: cleaner editorial cover, central subject, fewer elements, brand/series consistency | Treat as a designed grid asset, not a random extracted frame |
| Square social card | 1200x1200 | Feed/share scan: centered hook and proof object | Preserve the same promise with square-specific balance |
| Video opening frame | Match final MP4 ratio, normally 16:9 in this POC | Continuity between click promise and opening scene | Never use a platform-specific crop inside the video unless the video itself has that ratio |

Batch exports should keep one user-facing upload directory, `最终成品/`, inside each topic directory, with a Chinese-readable selection index grouped by aspect ratio: `横版16比9`, `横版4比3`, `竖版9比16`, `竖版3比4`, `方形1比1`, and platform-specific crops such as `B站常用1146x717` or `Reels封面420x654`. Single output directories must write `workflow/cover-size-selection.json` and topic-scoped `最终成品/`; the final delivery directory may contain upload-ready native target-ratio images only. Missing native target-ratio targets must be listed in that topic's `最终成品/需原生重生成清单.md`; optional local recomposition previews may be saved only under `封面预览-非上传终版/` and must not appear in `最终成品/`. Multi-topic batch roots should be gathered with `scripts/build-cover-size-selection-index.mjs --root <batch-root>` to rebuild each topic's own `最终成品/` and produce a lightweight `_封面总索引/封面总索引.html` with links only; do not duplicate all final images into the batch root. The batch index command is a final-readiness gate: it must fail when `needsRegeneration` is non-empty unless `--allow-pending-native-targets` is passed for an explicitly partial review package.

The deliverable must never be cover-less. When a run has no native upload-ready target-ratio Image 2 cover at all — the common default口播/`image2-dryrun` case — the workflow must still surface review-grade draft covers inside `最终成品/` under a clearly-labeled `评审级封面-非上传终版/` subfolder, grouped by the same Chinese aspect labels, so the user always opens the package to a usable cover image. This subfolder is explicitly not the upload selection: the aspect-named upload group folders (`横版16比9/` etc.) still contain native upload-ready target-ratio covers only, and `humanSelectionContainsOnlyUploadReady`/`nonUploadReadyVisualFilesCopied` continue to describe those upload group folders. Review-grade drafts keep `uploadReady: false`, are recorded under `reviewGradeCoverFiles` / `reviewGradeCoverDirectory` in `workflow/cover-size-selection.json`, and every affected size still appears in `需原生重生成清单.md`;正式上传前仍需按该尺寸重新生成原生 Image 2 封面. This review-grade draft is a different category from the `COVER_LOCAL_RECOMPOSITION_PREVIEW=1` `localTargetRatioRecomposition` preview, which remains under the separate top-level `封面预览-非上传终版/` directory.

Semi-auto configuration pages must expose the cover package as a platform feature, not as an optional switch. The cover module must stay reviewer-friendly: one large final/sample cover preview on the left, one compact right-side options panel with the default cover toggle and one visible selectable target for every supported resolution in `workflow/cover-size-selection.json` / `workflow/cover-design.json.resolutionPresets`, including the video-internal opening cover. Each target preview must bind to the exact `cover/*` file for that target when available, show the dimensions and ratio, and label whether the asset is upload-ready or still needs native target-ratio Image 2 regeneration. Methodology, template, status, and final-delivery evidence belong in `workflow/cover-design.json`, `workflow/cover-image2-prompts.json`, `workflow/cover-image2-qc.json`, and `workflow/cover-size-selection.json`, not as bulky old blocks in the configuration page.

Aspect-ratio adaptation is not a substitute for native cover generation. A finished Image 2 cover with integrated title/subtitle/badge cannot be hard-cropped just to satisfy `4:3`, `3:4`, Reels, Bilibili common, or square exports, and it also cannot be dropped into a visible letterbox/matte frame. Final upload-ready exports require true target-ratio Image 2 bitmaps. If the run only has a non-target-ratio bitmap, the target must be marked `needs-native-target-ratio-image2` / `uploadReady: false` in `workflow/cover-size-selection.json`, listed in `最终成品/需原生重生成清单.md`, and excluded from the final delivery directory. Do not hide a ratio mismatch with visible top/bottom or left/right blurred bands, white/cream frames, outlines, matte borders, hard crops, layered duplicate artwork, or synthetic side panels.

If a native Image 2/Codex target-ratio asset is not yet present and the user explicitly asks to preview missing `4:3` or `3:4` gaps, the workflow may output a clearly marked `review-only-local-target-ratio-recomposition` temporary file under `封面预览-非上传终版/` only when `COVER_LOCAL_RECOMPOSITION_PREVIEW=1` is set. This is a native-canvas local recomposition, not a true Image 2 native bitmap: it must rebuild the hierarchy for the target canvas, avoid blank areas, avoid overlapped/duplicated artwork, avoid hard crop, keep `uploadReady: false`, keep metadata fields `image2NativeTargetRatioReady: false` and `localTargetRatioRecomposition: true`, and remain excluded from `最终成品/` so later Codex built-in Image 2 or explicit API regeneration can replace it cleanly.

To finish missing target-ratio covers in Codex App, generate the missing native-ratio bitmap with Codex built-in Image 2 / `image_gen`, then run `scripts/ingest-codex-image2-cover-target.mjs --topic <topic-dir> --target <target-id> --source <codex-imagegen-png>`. This ingest step consumes the existing `workflow/cover-image2-prompts.json` evidence, verifies the generated bitmap has the target ratio, writes exact platform PNG/JPG exports, moves each target from `pendingNativeTargetRatioPrompts` to `fulfilledNativeTargetRatioExports`, and only then marks `uploadReady: true`. The explicit API alternative remains `scripts/generate-cover-targets-image2.mjs --root <batch-root-or-topic-root>` after `OPENAI_API_KEY` is available. If neither route has a real Image 2/Codex bitmap, the target must stay pending rather than create local substitute artwork.

Batch completion must be missing-only. The generator must derive its scope from all three authoritative surfaces: `workflow/cover-size-selection.json.entries`, `workflow/cover-design.json.resolutionPresets`, and `workflow/cover-image2-prompts.json.pendingNativeTargetRatioPrompts`. If a standard target exists in `resolutionPresets` or the pending prompt list but is absent from `entries`, it is still a missing target and must be generated or listed in `需原生重生成清单.md`. Already upload-ready native targets must not be regenerated during gap filling. The final batch gate is `scripts/build-cover-size-selection-index.mjs --root <batch-root>` without `--allow-pending-native-targets`; any pending target means the package is incomplete, not fully upload-ready.

## Platform Headline Lettering

Research-backed cover generation must treat title lettering as a primary visual object, not as ordinary UI text. The default cover path must select a platform headline system before prompt generation and before SVG/HTML overlay:

- **YouTube / Bilibili horizontal:** use explosive short Chinese hooks with thick dark strokes, hard shadows, sticker/slab backers, angled overlap, and one proof object. The title should read in one glance before any method detail.
- **Douyin / TikTok / Kuaishou vertical:** use a centered mobile-safe hook, 4-8 dominant Chinese characters, strong outline, high-contrast badge, and a visual payoff that stays readable in profile/search grids.
- **Instagram Reels / square feed:** use cleaner poster-like lettering, but still preserve a strong main hook, compact subtitle, and one central proof metaphor.
- **Knowledge/tutorial content:** the main title names the problem or result; the subtitle states the specific method point. Do not let English method names such as `Payoff Ledger` dominate the first read unless the audience/title requires it.
- **Visual proof:** decorative UI panels are not enough. The visual subject must be a concrete hook tied to the topic, such as clue threads, promise entries, marked manuscript fragments, payoff stamp, before/after draft, character pressure line, or reveal tear.
- **Anti-PPT rule:** reject clean course-heading layouts, small body copy, evenly spaced presentation panels, and neutral typography. A refined cover may be clean, but it still needs platform-native click tension.

## Quality Rules

- Design at least one cover before final packaging; for cross-platform delivery, create one shared content promise and platform-specific strategy variants. Do not merely crop or stretch one cover when platform click logic differs.
- Write GPT Image 2 compatible cover prompts for platform strategy variants by default. Image generation owns mood, subject, texture, depth, metaphor, and finished Chinese cover typography: main title, subtitle/method line, badge, and any approved supporting microcopy.
- Run `workflow/cover-image2-qc.json` before accepting any cover as final-quality. Prompt QC must pass before generation, and final cover eligibility requires a real generated bitmap with integrated typography plus visual inspection. SVG-only, subject-only, or deterministic overlay fallback covers are review-only, even if dimensions and raster exports pass.
- The main cover engine is Image 2-first: a complete generated cover with integrated typography. Do not use the old decorative/title-card SVG logic as the default cover; keep local SVG/HTML only as export sizing plus fallback/text-repair.
- Export SVG source plus PNG/JPG raster files for every resolution preset. User-facing PNG/JPG cover copies belong under the topic-scoped `最终成品/` folder, grouped by Chinese aspect/platform labels; do not scatter title-named cover copies beside the MP4.
- Generate the standalone cover package separately from the video-internal cover asset. Standalone exports can follow upload ratios; the video-internal cover asset must match the MP4 canvas, but default MP4 renders start directly on the first content scene.
- The cover must be derived from the video's core promise, not from a random attractive frame.
- If the input has a title, the cover title must use the title description, while shorter hook text can reflow that title or sharpen its curiosity gap. Do not silently replace the title with an unrelated opening sentence.
- Use one primary hook, one visual subject, and one accent signal. Remove anything that does not help the click decision.
- Prefer a click-oriented hook over a descriptive title. For example, `读者不买灵感` is stronger than `小说不是灵感产品：读者情绪与商业承诺` because it creates contradiction and curiosity while staying truthful.
- The final cover should feel like a finished platform thumbnail, not a slide title card, UI card, or internal design mock.
- Test at small size by downscaling to mobile-preview width; the hook and subject must remain clear.
- The first seconds of the video should visually honor the cover promise so the click does not feel baited.
- When the user asks for the video to begin with a cover, render that cover into the first seconds of the MP4 while narration starts at 0s by default. Do not shift narration/subtitles later unless the user explicitly asks for a silent title-card opening. When no in-video cover is requested, the MP4 must start directly on the first content scene and `cover/*` remains the upload/thumbnail package.
- A beautiful cover is allowed to be restrained. Premium means hierarchy, spacing, contrast, image quality, and accurate promise.

## Hard Failures

- No cover artifact for a final-quality run.
- Missing `workflow/cover-image2-prompts.json` or Image 2 prompts that ignore the title/script click promise.
- Missing `workflow/cover-image2-qc.json`, failing prompt QC, or `finalCoverQualityEligible: false` being presented as final-quality.
- `workflow/cover-design.json` missing `defaultCoverEngine: "image2-integrated-typography-cover"` for a normal run.
- Missing PNG/JPG raster exports, missing `最终成品/` user-facing cover copies, or a cover file over its recorded size limit.
- A cover that cannot be read at mobile preview size.
- A cover whose aspect ratio does not match the target platform or video use.
- A cover that promises a different topic, result, or emotion from the actual video.
- A cover title that ignores the brief title description when the brief provides one.
- A cover that is only a title card, platform/spec mock, or decorative UI composition without a click reason.
- A cover generated by the old promise-seal/title-card SVG design as the normal path.
- Visible platform labels, aspect-ratio labels, workflow labels, debug text, timecode evidence, or renderer artifacts in the final cover.
- Copied creator thumbnail style, unauthorized likeness, unlicensed images/fonts, or platform-policy risky imagery.
