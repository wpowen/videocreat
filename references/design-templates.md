# Design Templates

Use this reference when the user says the video feels like PPT, when a new genre needs a visual language, or before adding image assets.

## Planner Rule

The planner must decide the video type before rendering. The output must include:

- `workflow/content-presentation-design.json`: topic type, audience state, content jobs, hierarchy, display logic, visual metaphor, layout system, and motion purpose.
- `workflow/sync-timecode-plan.json`: shared timing source for narration, captions, scene changes, progress indicators, and opening/cover continuity.
- `workflow/cover-design.json`: one master cover concept, resolution presets, cover promise, hook text, dominant visual subject, composition, typography, contrast, exported size variants, content truth, and reject list.
- `workflow/motion-template-selection.json`: chosen HTML motion template, platform/library logic, semantic binding, interaction feeling, fallback policy, and verification.
- `workflow/design-plan.json`: video type, template kit, shot templates, layout, motion language, and per-scene asset role.
- `workflow/image-generation-strategy.json`: provider/tool routing for Codex built-in `image_gen`, explicit OpenAI Images API, edit/polish tools, and editable design handoff.
- `workflow/image2-prompts.json`: GPT Image 2 compatible prompts for every inserted visual, including Codex built-in `image_gen` bitmap runs.
- `workflow/visual-asset-manifest.json`: selected asset source, local fallback, insertion mode, generation failures, and content-binding metadata.
- `workflow/visual-relevance-audit.json`: per-scene proof that the image prompt and selected visual asset cover the current narration/headline keywords.
- `workflow/visual-rhythm-plan.json`: per-scene proof that long narration segments have visible crop/focus/scan/detail changes instead of one unchanged still.
- `cover/*`: rendered cover exports for the requested resolution presets.

If these files are missing, the run is not complete.

The planner must design the content presentation and cover promise before designing individual frames. A good frame is not just attractive; it makes the next idea easier to understand. The cover, first seconds, captions, and main visual chapters should feel like one promise being paid off.

## HTML Motion Template Library

Use `templates/html-motion/motion-template-registry.json` as the local starting point for designed motion:

- `kinetic-editorial-explainer`: for concept explainers, contradiction hooks, writing-method videos, and premium editorial kinetic typography.
- `semantic-timeline-reveal`: for models, steps, processes, chapter structures, and shared timecode progress.
- `interactive-proof-board`: for argument, diagnosis, mystery, cause-effect, and evidence-board videos.
- `typed-black-white-opener`: for explicitly requested black/white typed title openers; do not insert it by default because the normal MP4 starts directly on the first content scene.
- `dark-saas-magic-ui`: for SaaS, AI product, tool launch, and workflow demo shorts that need a black spatial stage, large kinetic product promise, gradient CTA, and floating UI objects.
- `data-curve-trace`: for sourced numeric trends, metric curves, growth/decline stories, and endpoint/inflection callouts. Read `references/data-driven-motion.md` first and do not plot unsourced values.

These templates are intentionally local-first: CSS keyframes, SVG, and Web Animations API are enough for deterministic frame capture. Use external animation libraries only when the template would otherwise become unmaintainable.

## Core Kits

| Video type | Use when | Visual language | Core shots |
| --- | --- | --- | --- |
| `writing-method` | novel writing, story craft, chapter hooks, reversals | editorial story lab: manuscripts, paper depth, clues, annotation lines | anomaly hook, doorway scene, conflict triangle, chapter question thread, rewrite lens, edit desk |
| `tutorial-explainer` | how-to, workflow, tool tutorial | demonstration layers: problem close-up, process map, checklist proof | problem, method map, before/after, checklist |
| `professional-explainer` | general education, product/strategy explanation | evidence board: cinematic title, cards, charts, proof layer | claim, evidence, model, rule |
| `school-education` | schools, classrooms, courses, lessons, students, teachers, learning methods | fresh learning board: classroom whiteboard, notebook layers, worked examples, quiz checkpoints | lesson question, concept note, worked example, quiz checkpoint, memory map |
| `dark-saas-product` | SaaS, AI product, tool launches, workflow demos, release stings | dark magic UI stage: black space, subtle purple horizon glow, large prompt card, gradient CTA, floating product objects | kinetic promise, prompt invocation, CTA transform, result field, integration ring, export burst |

Each kit must carry its own `themeKey` and visible canvas treatment. Do not collapse unrelated kits into the same warm paper/yellow background; shared quality comes from hierarchy, motion discipline, caption safety, and QC gates, not from one reusable color surface.

## Style Archetypes

Use `videoType` for content structure and `styleArchetype` for visual treatment. A brief may set `visualStyle`, `styleArchetype`, `styleTemplate`, or `style`; otherwise the workflow infers the archetype from the title, objective, audience, and scenes. The archetypes are abstract patterns from common explainer/talking-head/video-essay formats; do not copy a creator's packaging, shot order, avatar, thumbnail formula, or brand treatment.

| Style archetype | Use when | Visual treatment | Motion jobs |
| --- | --- | --- | --- |
| `animated-infographic` | general science, mechanisms, abstract ideas, business models | diagram objects, icons, simplified scenes, layered metaphors | assemble, transform, compare, zoom-to-part |
| `whiteboard-lesson` | formulas, worked examples, step-by-step academic explanation | whiteboard strokes, marker highlights, notebook fragments | draw, underline, step reveal, answer flip |
| `classroom-board` | school, classroom, student/teacher/course topics | fresh board, notebook layers, quiz checkpoints, memory maps | board reveal, notebook slide, checkpoint reveal |
| `data-newsroom` | data, finance, policy, markets, trends | chart panels, evidence grids, numeric emphasis | chart build, compare, anomaly highlight, trend trace |
| `screen-demo` | software tutorials, product demos, workflows | browser/window frames, cursor paths, before-after panels | cursor trace, zoom, checklist tick, before-after wipe |
| `kinetic-typography` | short-form口播, strong opinions, hooks, quote-driven videos | high-contrast type stage, punch words, minimal symbols | word punch, snap zoom, contrast flip, beat cut |
| `hybrid-presenter` | talking-head plus graphics, commentary, personal-brand lessons | presenter-safe studio zone, side evidence cards, B-roll slots | side-card reveal, B-roll insert, proof overlay |
| `documentary-editorial` | history, people, social issues, long video essays | archive paper, maps, timelines, chapter cards | slow pan, timeline trace, map reveal |
| `narrative-story-lab` | novel writing, story analysis, craft examples | manuscripts, annotation rails, clue boards | paper depth, evidence pinning, lens sweep |

Style selection must be recorded in `workflow/design-plan.json`, `workflow/content-presentation-design.json`, `workflow/aesthetic-brief.json`, and `workflow/quality-consistency-contract.json`. QC must verify that a style archetype is selected and carried into every scene contract.

## Data-Driven Motion

When `data-newsroom` or any scene mentions data, metrics, curves, trends, growth/decline, rankings, percentages, or comparable numeric evidence, the planner must decide whether the scene needs measured data.

- If measured data is needed, create `workflow/data-source-plan.json`, `workflow/data-series.json`, and `workflow/data-motion-plan.json` before rendering.
- Prefer `data-curve-trace` for one or two sourced time-series curves.
- Use D3 only when scale/layout/transforms would make hand-authored SVG brittle.
- Use Manim only when the curve is formula-driven, physical, geometric, or parametric rather than just a measured time series.
- If values cannot be sourced, render a qualitative concept diagram and record `dataEvidenceStatus: "qualitative"` instead of drawing fake precise curves.

## Full-Content Coverage

When a brief includes full source material (`sourceMaterial.path`, `sourceText`, `fullText`, `chapterText`, etc.), the workflow must treat the source as the coverage contract by default. The rendered narration should cover the full material, not a short teaching digest, unless the run explicitly declares summary/condensed intent with `--allow-condensed-source`, `allowCondensedSourceMaterial: true`, or a summary-like `contentMode`.

Every run with source material writes `workflow/content-coverage.json`; final QC must fail if full-source coverage is below the required ratio. Scene lists also must not be silently truncated: raise `--max-visual-frames` for long-form videos instead of relying on the default visual frame cap.
If a brief points at `sourceMaterial.path`, `sourceMaterials[].path`, or `sourcePath`, that path must exist and be readable before rendering. A missing source path is a hard failure because otherwise the workflow can accidentally produce a short digest while appearing to satisfy full-content mode.

## Image Prompt Policy

- Before writing Image 2 / Codex `image_gen` prompts, read `references/gpt-image-2-prompt-library.md`. Borrow its prompt methodology only: use-case/style/subject taxonomy, structured prompt fields, dynamic slots, composition/material/lighting language, and negative constraints.
- Prompts must ask for video insert assets, not complete slides. The only exception is the Image2 explainer-board route, which may generate a high-density diagram/storyboard board as source material for video crops, while deterministic layers still own exact text, captions, numbers, and labels.
- Prompts must include the current scene narration beat and content keywords so Codex built-in imagegen, Image2 API, and local fallback visuals are meaning-bound rather than generic decoration.
- Prompts must ask for images that can survive motion: foreground/midground/background, crop-safe subject placement, safe area for overlays, and enough texture/detail for push-in or scan states.
- Ask for depth layers, visual metaphor, and safe areas for title/subtitles.
- Record the selected prompt axes and dynamic slots in `workflow/image2-prompts.json`, so later real Image 2 generation can reuse the scene-specific prompt contract.
- For science, education, tool/workflow, model/mechanism, or high-information-density briefs, evaluate `visualAssetDecision.explainerBoard` before rejecting Image2 merely because the scene is abstract. If active, generate a text-safe board with icons, arrows, blank label plaques, panel structure, and crop-ready modules.
- When the explainer-board route is active, preserve the approved `image2-explainer-board-v1` treatment: light readable stage, large lower multi-module board, compact top-left title, compact top-right summary, and no empty side card or internal debug/page labels. Record this in `workflow/visual-preset-lock.json`.
- Avoid portraits, celebrity likenesses, logos, platform UI, dense tiny text, copied thumbnails, and creator packaging.
- Default to `image2-dryrun`: write prompts and insert deterministic local SVG assets.
- In Codex app sessions, use `--image-source codex-builtin --codex-image-assets-dir <dir>` after generating project-bound bitmap assets with built-in `image_gen`; this does not require `OPENAI_API_KEY`.
- Use `--image-source image2` only when API credentials, cost boundary, and publication review are acceptable.

## PPT Failure Signals

Treat these as defects:

- Each scene is mostly a headline plus subtitle with no visual metaphor.
- The asset role is "background decoration" instead of a topic-specific shot.
- Motion is only text fade-in, with no foreground/background depth.
- The same layout repeats without scene-specific camera or transition intent.
- Main scenes advance on fixed equal durations while the narration has uneven semantic pacing.
- The package has no resolution cover exports, or the cover reads like a random frame/PPT slide instead of a designed viewer promise.
