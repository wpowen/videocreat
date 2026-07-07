# Short-Form Hook Design

Use this reference when the brief explicitly targets Douyin, TikTok, YouTube Shorts, Reels, a generic vertical short-form package, a portrait/`9:16` canvas, or a short-form/短视频 package. A horizontal explainer may still have a hook or first-three-second promise, but those words alone do not activate this vertical short-form contract.

## Core Rule

The first three seconds must be designed as a retention contract, not an intro. The MP4 should start at content time 0 with an audience-facing tension, promise, or proof object. Covers are upload assets by default; they may influence the first frame, but they must not become a silent title-card pre-roll unless the user explicitly asks for that.

## Ten-Second Shape

For a roughly 10 second video, use this structure:

- `0.0-1.0s`: Pattern interrupt. Show the contradiction, risk, visual oddity, or result before explaining it.
- `1.0-3.0s`: Promise plus curiosity gap. Tell the viewer what they will understand, get, avoid, or see, while leaving one unresolved question.
- `3.0-6.0s`: Mechanism. Reveal the first causal step, process, state change, or decision rule.
- `6.0-8.5s`: Proof/example. Show a concrete before/after, example, data point, source-board, UI state, or comparison.
- `8.5-10.0s`: Payoff loop. Resolve the opening promise and echo the opening visual so the video feels complete and rewatchable.

## Framework Routing

Use the current framework instead of adding a separate short-video stack:

- `kinetic-editorial-explainer` is the default first-scene template for contradiction, claim, warning, mistake, or hook beats.
- `interactive-proof-board` fits evidence, cause/effect, mystery, diagnosis, and claim-validation beats.
- `semantic-timeline-reveal` fits process, method, workflow, step-by-step, and education beats.
- `data-curve-trace` fits sourced numeric trends, ranked comparisons, and metric movement.
- `dark-saas-magic-ui` fits product/tool/UI transformations only when the main surface is inspectable and the topic calls for a product-like stage.
- `typed-black-white-opener` is allowed only for an explicitly requested in-video typed opener.

## Image2 And Aesthetic Use

Image2/Codex `image_gen` should improve taste without taking over deterministic video logic:

- Use Image2 for high-polish still subjects, visual metaphors, editorial texture, product/scene backgrounds, source-board plates, and cover-integrated typography.
- Use the Image2 explainer-board route for dense education/workflow/mechanism scenes when a source plate clarifies the idea.
- Keep exact Chinese text, subtitles, numbers, claims, logos, axes, and final labels in deterministic HTML/SVG/CSS layers unless the approved cover engine is intentionally integrating cover typography.
- Every Image2 candidate needs a scene-level `visualAssetDecision`: purpose, placement, fallback, source status, and why the generated image is not generic decoration.
- Generated images are video layers. They should reserve safe space for headline/subtitle overlays and support crop, scan, push-in, or detail rhythm inside the scene.

## Aesthetic Bar

The hook should look designed, not merely fast:

- Name the visual territory before rendering: editorial, proof-board, product-surface, classroom-board, data-newsroom, story-lab, or another content-fit territory.
- Use one dominant visual idea per beat. Do not stack many unrelated widgets, stickers, charts, and callouts in the first frame.
- Keep mobile readability first: one big claim, one support line, and one safe subtitle line.
- Reserve mobile app chrome space: for `1080x1920` vertical output, leave at least the top `220px` blank before any title, key claim, face, card, arrow, or decorative marker, so status bars and top navigation do not cover content.
- Use contrast through scale, crop, timing, and state change, not only red text or a black background.
- If dark backgrounds are used, record the explicit dark-stage reason and design foreground/background material contrast. Full black is not the default for hooks.
- Preserve topic-specific variation. Consistency comes from quality gates, not from forcing every short video into the same house style.

## Required Artifact

Vertical short-form runs must write `workflow/short-form-hook-plan.json` with:

- target canvas and platform profile;
- first-frame promise;
- first-three-second contract;
- 10 second structure;
- motion template choices;
- per-scene Image2/aesthetic decisions;
- caption-safe policy;
- top mobile safe-area policy;
- payoff loop;
- reject list and QC expectations.

## QC Signals

Short-form packages should fail review if any of these are missing:

- `shortFormHookPlanPresent`;
- `firstFramePromiseVisible`;
- `contentPropositionWithin3s`;
- `firstThreeSecondVisualDensityOk`;
- `shortFormImage2AestheticDecisionPresent`;
- `shortFormPayoffLoopPresent`;
- `shortFormCanvasMatchesTarget` for vertical `1080x1920` output.
- `topSafeAreaReservedForMobileChrome` for vertical `1080x1920` output.
