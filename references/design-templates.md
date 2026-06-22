# Design Templates

Use this reference when the user says the video feels like PPT, when a new genre needs a visual language, or before adding image assets.

## Planner Rule

The planner must decide the video type before rendering. The output must include:

- `workflow/content-presentation-design.json`: topic type, audience state, content jobs, hierarchy, display logic, visual metaphor, layout system, and motion purpose.
- `workflow/sync-timecode-plan.json`: shared timing source for narration, captions, scene changes, progress indicators, and opening/cover continuity.
- `workflow/cover-design.json`: platform targets, cover promise, hook text, dominant visual subject, composition, typography, contrast, platform variants, content truth, and reject list.
- `workflow/motion-template-selection.json`: chosen HTML motion template, platform/library logic, semantic binding, interaction feeling, fallback policy, and verification.
- `workflow/design-plan.json`: video type, template kit, shot templates, layout, motion language, and per-scene asset role.
- `workflow/image2-prompts.json`: GPT Image 2 compatible prompts for every inserted visual.
- `workflow/visual-asset-manifest.json`: selected asset source, local fallback, insertion mode, and generation failures.
- `cover/*`: rendered cover variants for the requested platform ratios.

If these files are missing, the run is not complete.

The planner must design the content presentation and cover promise before designing individual frames. A good frame is not just attractive; it makes the next idea easier to understand. The cover, first seconds, captions, and main visual chapters should feel like one promise being paid off.

## HTML Motion Template Library

Use `templates/html-motion/motion-template-registry.json` as the local starting point for designed motion:

- `kinetic-editorial-explainer`: for concept explainers, contradiction hooks, writing-method videos, and premium editorial kinetic typography.
- `semantic-timeline-reveal`: for models, steps, processes, chapter structures, and shared timecode progress.
- `interactive-proof-board`: for argument, diagnosis, mystery, cause-effect, and evidence-board videos.

These templates are intentionally local-first: CSS keyframes, SVG, and Web Animations API are enough for deterministic frame capture. Use external animation libraries only when the template would otherwise become unmaintainable.

## Core Kits

| Video type | Use when | Visual language | Core shots |
| --- | --- | --- | --- |
| `writing-method` | novel writing, story craft, chapter hooks, reversals | editorial story lab: manuscripts, paper depth, clues, annotation lines | anomaly hook, doorway scene, conflict triangle, chapter question thread, rewrite lens, edit desk |
| `tutorial-explainer` | how-to, workflow, tool tutorial | demonstration layers: problem close-up, process map, checklist proof | problem, method map, before/after, checklist |
| `professional-explainer` | general education, product/strategy explanation | evidence board: cinematic title, cards, charts, proof layer | claim, evidence, model, rule |

## Image2 Prompt Policy

- Prompts must ask for video insert assets, not complete slides.
- Ask for depth layers, visual metaphor, and safe areas for title/subtitles.
- Avoid portraits, celebrity likenesses, logos, platform UI, dense tiny text, copied thumbnails, and creator packaging.
- Default to `image2-dryrun`: write prompts and insert deterministic local SVG assets.
- Use `--image-source image2` only when API credentials, cost boundary, and publication review are acceptable.

## PPT Failure Signals

Treat these as defects:

- Each scene is mostly a headline plus subtitle with no visual metaphor.
- The asset role is "background decoration" instead of a topic-specific shot.
- Motion is only text fade-in, with no foreground/background depth.
- The same layout repeats without scene-specific camera or transition intent.
- Main scenes advance on fixed equal durations while the narration has uneven semantic pacing.
- The package has no platform-specific cover, or the cover reads like a random frame instead of a designed viewer promise.
