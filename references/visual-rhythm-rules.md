# Visual Rhythm Rules

Use this reference when scenes feel like one still image held under a long voiceover.

## Product Problem

If one visual stays unchanged while narration continues, the user reads the frame once and then has no new visual reason to keep watching. This is especially risky for short social videos where the opening seconds carry most of the attention burden.

## Operating Rule

Audio owns semantic timing; visuals must create visible events inside that timing. Generated images are only one possible material source.

- Do not split TTS only to force visual cuts.
- Do not divide total duration evenly across unrelated visuals.
- Use actual per-frame TTS durations from `workflow/voice-subtitle-manifest.json`.
- For each narration-bound scene, generate a `visualRhythm` plan with at least two visible states.
- No visible state should remain unchanged beyond `MAX_SCENE_WITHOUT_VISUAL_CHANGE_SECONDS`.
- If a scene is abstract/process-oriented, use deterministic visual events such as countdown state changes, chart growth, comparison swaps, card cascades, cursor traces, type punches, or diagram builds instead of inserting a generated bitmap, unless `visualAssetDecision.explainerBoard.active` approves a text-safe Image2 storyboard plate.

## Scene Beat Pattern

Use these states before adding extra scenes:

1. `establish`: full image/subject appears with clear context.
2. `push-in`: crop or camera moves toward the current spoken idea.
3. `counter-crop`: focus moves to the opposing detail, consequence, or evidence.
4. `detail-scan`: a line, mask, highlight, or scan makes the viewer inspect the image.
5. `resolve-wide`: return to a calmer composition before the next scene.

## When To Generate More Than One Image

Generate or request an additional scene image when:

- One narration scene exceeds the rhythm threshold and the same image cannot support meaningful crop/focus changes.
- The audio changes subject, time, location, actor, or claim.
- The image metaphor cannot represent the next spoken beat without becoming generic.
- A crop would hide the important subject or collide with title/subtitle safe areas.

## Rendering Rule

Generated image mode should render the image as a sequence:

- Only enter generated image mode when `visualAssetDecision.useGeneratedImage` is true.
- Multiple timed crops/focus states can come from one source image.
- Exact text overlays remain outside the generated pixels.
- Generated images are supporting material, not the whole scene design.
- Explainer-board images must be treated as crop-ready source plates under `image2-explainer-board-v1`: establish the whole board, then crop/scan into modules while deterministic overlays own exact text.
- Motion note, MG panel, platform overlay, and template signature layers must remain present as deterministic HTML/SVG/CSS layers.
- Those deterministic layers must be placed behind, beside, or below the generated image so they do not cover the image subject, headline, or subtitle band.
- Rhythm markers and scan/highlight layers may be used only when they do not collide with subtitles.

## Static Full-Page Diagram Rule

When a generated image is a complete teaching page, PPT-style diagram page, or `ip-diagram-creator` native-final frame, do not treat it like a crop-ready photograph.

- Keep the source page full-screen and fixed for its page window.
- Do not create rhythm by changing crop, zoom, pan, scale, x/y offset, or focal point between subtitle cues.
- Do not add a visible card, shadow, matte, frame, or border around the page to make it feel like a slide inside the video.
- Create visible events with semantic page changes, foreground marker strokes, progress indicators, highlights, reveal masks, subtitles, or deterministic overlays that do not move the base page pixels.
- If the complete page has layout overlap or unreadable generated text, repair/regenerate the page before video render instead of shrinking, reframing, or bouncing it.

## QC Expectations

The run must write `workflow/visual-rhythm-plan.json`.

`logs/qc.json` must pass:

- `visualRhythmPlanPresent`
- `visualRhythmDensityOk`
- `generatedImagePurposeFit`
- `generatedVisualDesignLayersPresent`
- `frameAudioTimingBound`
- `visualSubtitleSingleLine`
- `ipDiagramBaseImageStable` when native generated diagram pages are used as final frames.
- `ipDiagramNoPerCueCropPanZoom` when native generated diagram pages are used as final frames.
