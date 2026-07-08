# Image Generation Routing

Use this reference when a run needs polished generated stills, cover art, or scene inserts.

## Research Snapshot

Primary references checked:

- OpenAI Images and vision docs: `https://platform.openai.com/docs/guides/images`
- Google Gemini image generation docs: `https://ai.google.dev/gemini-api/docs/image-generation`
- Adobe Firefly API docs: `https://developer.adobe.com/firefly-services/docs/firefly-api/`
- Adobe Firefly Generate Image tutorial: `https://developer.adobe.com/firefly-services/docs/firefly-api/guides/how-tos/firefly-generate-image-api-tutorial`
- Adobe Firefly style/structure reference concepts: `https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/style-image-reference/`
- Stability AI API reference: `https://platform.stability.ai/docs/api-reference`
- TikTok Creative Codes pacing reference: `https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads`
- YouMind GPT Image 2 prompt collection: `https://github.com/YouMind-OpenLab/awesome-gpt-image-2/blob/main/README_zh.md`
- hskaildm curated GPT Image 2 prompts: `https://github.com/hskaildm/gpt-image-2-curated-prompts`
- peterRooo awesome GPT Image 2 prompts: `https://github.com/peterRooo/awesome-gpt-image-2-prompts`
- haloshin ip-diagram-creator: `https://github.com/haloshin/ip-diagram-creator`

The YouMind collection is used only as a prompt-method reference: category taxonomy, structured field patterns, dynamic placeholders, composition/material/lighting language, and negative constraints. Do not copy community examples, exact layouts, brands, IP, logos, or creator styles into this workflow.

The hskaildm and peterRooo collections follow the same method-only boundary (both declare no license and transcribe community prompts): borrow the four-part prompt skeleton (positioning statement, module checklist, visual requirements, negative exclusion), variable topic slots, integrated Chinese typography direction, cross-frame consistency wording, category taxonomy, and structured record schema. Their distilled, rights-safe result is the visual series catalog in `assets/gpt-image-2-visual-series-catalog.json` (see `references/gpt-image-2-visual-series.md`).

The ip-diagram-creator repository is used as a planner/prompt/native-source/QC reference and may become the primary teaching visual planner when routed. It can drive director plans, page cards, personal-IP role assets, white-canvas hand-drawn visual DNA, diagram shot lists, Agent collaboration diagrams, PPT director page cards, and native direct-generation jobs. Do not copy its example assets or make generated bitmaps own final exact Chinese text.

## Provider Roles

| Tool/provider | Use in this skill | Best for | Not for |
| --- | --- | --- | --- |
| Codex built-in `image_gen` | Default project-bound bitmap generation in Codex App sessions, especially final cover handoff | Fast scene-specific images, visual metaphors, covers, manual inspection | Scene captions/claims/logos inside pixels, unattended batch production without workspace copy; cover typography is the explicit exception |
| OpenAI Images API | Explicit API path via `--image-source image2` | Scriptable generation or edits when `OPENAI_API_KEY`, cost, and review are acceptable | Default local runs or hidden credential-dependent generation |
| Adobe Firefly / Photoshop generative edit | Future polish/edit route after an image is selected | Brand/commercial workflow, style/structure reference, expand, object/background edits | Silent default dependency or unrecorded account/credit usage |
| Google Gemini image generation | Future optional provider slot | High-resolution/professional image variants or real-time-grounded graphics when selected | Current default path; deprecated Imagen-specific workflows |
| Stability AI | Future optional provider slot | Provider diversity, image generation/editing experiments | Current default path without explicit provider choice |
| Canva / Figma | Editable design handoff | Social graphics, cover editing, design review surfaces | MP4 scene-image generation as a hidden render dependency |

## Default Routing Rule

1. Cover generation is Image 2-first by default through Context Image2 / Codex built-in `image_gen` in Codex App sessions. The workflow must first run the core cover engine and write `workflow/cover-design.json`, `workflow/cover-image2-prompts.json`, `workflow/cover-size-selection.json`, and `workflow/context-image2-cover-requests.json`; then Context Image2 renders each requested native-ratio bitmap from that package-bound request file. Use that bitmap as the complete cover, with the main Chinese title, subtitle/method line, badge, visual subject, lighting, texture, and depth integrated in the same image. Deterministic SVG/HTML overlays are fallback/text-repair only after review. Export the approved cover design to resolution presets; when platform click logic requires a different composition, generate a platform-specific integrated cover rather than blindly cropping. If no integrated bitmap is present, record the cover as prompt-pending and render only a degraded professional review fallback, not the old title-card cover. The OpenAI Images API route is only `--image-source image2` explicit opt-in, not the default cover path.
2. Scene image generation is optional. Do not insert a generated scene image merely because a provider, prompt, or asset file exists.
3. Write a per-scene `visualAssetDecision` before rendering. It must state whether a generated image is used, where it goes, why it helps, and what deterministic fallback owns the scene when it is not used.
4. Use Codex built-in `image_gen` for project-bound image assets when the scene has a concrete subject, visual metaphor, or approved explainer-board job that benefits from bitmap treatment.
5. Prefer deterministic HTML/SVG/CSS, MG components, charts, state machines, timelines, countdowns, and kinetic typography for abstract concepts, process explanations, rules, comparisons, and data/flow scenes unless the Image2 explainer-board route below is active.
6. Copy selected outputs into the workspace before they are referenced by video artifacts.
7. Keep scene captions, numeric claims, UI labels, and logos in deterministic HTML/SVG/CSS layers. For covers only, approved title/subtitle/badge text should be integrated into the Image 2 bitmap because thumbnail typography is part of the visual hook.
8. Treat OpenAI Images API, Firefly, Gemini, Stability, Canva, and Figma as explicit opt-in routes unless the user asks for that provider.

## Bounded Parallel Generation

Image generation may run concurrently only when the request artifact explicitly says it is safe:

- Valid manifests use `parallelGenerationPolicy.allowed: true`, a default concurrency, a maximum concurrency, and a request-level stable id plus expected output path.
- Default concurrency is 2. Use `CODEX_VIDEO_IMAGE2_CONCURRENCY` or a script flag such as `--concurrency 2` to tune it; do not use unbounded `Promise.all` against provider calls.
- Parallelism applies to independent generation calls only. Artifact mutation, resize/export, ingestion, and final QC should run after outputs are saved, or otherwise preserve deterministic request-to-output mapping.
- Do not parallelize a page that depends on another freshly generated page as its reference. If identity or style consistency is needed, every request must attach the same fixed context image set or style lock from the manifest.
- If any output cannot be matched back to its request id, prompt path, target id, and expected dimensions, treat the batch as incomplete and regenerate or ingest manually.

## Image2 Explainer-Board Route

Use this route when the brief, user request, or scene language asks for Image2/GPT Image, science/education explanation, `ponchi-e`-like diagram structure, high information density, infographic, storyboarded slides, or diagram-rich teaching visuals.

The approved default visual preset is `image2-explainer-board-v1` in `assets/visual-presets/image2-explainer-board-v1.json`. Active packages must write `workflow/visual-preset-lock.json` with that preset id, active scenes, render contract, and reject list.

This route is allowed to generate a dense visual board, but only as video source material:

- The bitmap is a storyboard plate under deterministic HTML/SVG/CSS text, MG, subtitle, and safe-area layers, not a finished PPT page.
- Exact Chinese text, subtitles, numbers, claims, UI labels, source labels, and logos remain deterministic. The generated image may contain icons, arrows, blank label plaques, abstract placeholder strokes, panels, and visual hierarchy.
- Prompt language should generalize named styles into rights-safe traits such as "soft friendly public-explainer illustration" and "high-density briefing-board layout". Do not name or copy Irasutoya, government-agency slides, brands, IP, creator styles, community examples, or exact source layouts in final generation prompts.
- The planner must record `visualAssetDecision.explainerBoard` plus the selected source. In dryrun mode, record the prompt and blocker; with `--image-source image2` or `--image-source codex-builtin`, insert the bitmap only when safe placement and visual rhythm are available.
- The render should crop/scan/push into board modules as separate visual beats: establishing board, problem/context module, process/causal chain, evidence/comparison module, and takeaway strip.
- The locked render treatment uses a readable light education stage, top-left deterministic headline, top-right deterministic summary, and a large lower multi-module board. It must not regress to an empty right-side card, fixed left-text/right-card PPT layout, internal page labels, Trace JS labels, or full dark stage without a recorded dark strategy.

## Image2 Visual Series Route

Use this route when the planner selects a series from `assets/gpt-image-2-visual-series-catalog.json` for scenes where high-quality generated pages serve as full-screen base frames (knowledge cards, guide boards, relationship maps, atlas cards, hooks, mood pages, interface plates, consistency grids). Full contract: `references/gpt-image-2-visual-series.md`.

- The route generalizes the personal-IP native-page design philosophy (native full-screen pages, fixed style DNA, series continuity, multi-page coverage, provenance + QC) to non-persona series. The personal-IP route itself is untouched and keeps its own contract.
- Plan page sets with `scripts/plan-image2-series-pages.mjs`; it writes per-page prompts, an image-count plan, a series style lock, QC, and a provenance manifest shaped like the native-page manifest.
- `workflow/image2-series-image-jobs.json` records `parallelGenerationPolicy`; jobs may be generated concurrently only while preserving the shared style lock and slot order.
- Text policy is per-series: `text-safe` follows the standard deterministic-text rules; `integrated-chinese` is a per-series opt-in that follows the cover-typography and personal-IP precedents and requires an exact whitelist plus a proofread gate before final use.
- Series selection is a planner decision recorded in the scene's `visualAssetDecision` with the chosen `seriesId`; series pages must still bind to scene narration through `workflow/visual-relevance-audit.json`.
- Mechanism/teaching scenes still evaluate the approved `image2-explainer-board-v1` route first; personal-IP briefs still route to the IP Diagram Creator route below.

## IP Diagram Creator Route

Use this route when `workflow/ip-diagram-creator-plan.json` is active.

- When `primaryPlannerRoute` is true, scene prompts must cite the active `directorPlan`, scene `pageCard`, diagram mode, communication task, visual weight, main visual, and text-to-image ratio. The generated bitmap remains a source plate under deterministic HTML/SVG/CSS text.
- Active routes must also write `workflow/ip-diagram-creator-native-jobs.json`. These jobs are valid inputs for directly using the original framework to produce role sheets, knowledge cards, PPT-style diagram pages, or source plates before video assembly.
- Generated images may be role reference assets, expression/action sheets, small creator scenes, visual metaphor plates, knowledge-card source boards, or PPT-style background/source plates.
- Prompt priority should follow the active plan's `characterAssetPolicy`: user-authorized role assets first, project-owned generated assets second, generic style references last.
- Prompt visual DNA should follow the active `characterAssetPlan`: white/near-white canvas, black minimal hand-drawn line art, slight pen wobble, adult IP presenter, lots of whitespace, sparse orange/red/blue annotations, and concrete execution Agents when useful.
- Generated images may include blank plaques, icons, arrows, panels, and non-readable sketch marks. They must not contain final exact Chinese claims, subtitles, labels, metrics, or UI copy; those remain deterministic HTML/SVG/CSS layers.
- Agent collaboration diagram prompts may ask for 2-6 small helper characters only when each helper has a concrete execution job. Avoid anonymous decorative mascots.
- If the environment has no image tool, write prompts and repair prompts only and mark image generation as pending; do not imply that a role asset or diagram was generated.

## Prompt Contract

Every scene prompt must include:

- Current narration beat.
- At least three content keywords from headline/body/spoken cue.
- A prompt-method record based on `references/gpt-image-2-prompt-library.md`: selected use-case axis, style axis, subject axis, and dynamic slots that bind the image to this scene.
- Asset role: background, metaphor, subject insert, texture, evidence visual, cover subject, etc.
- Composition rule: 16:9, clear foreground/midground/background, safe zone for overlays.
- Lighting/material rule: camera or rendering style, light direction, contrast, surface texture, depth, and finish.
- Motion readiness: image should survive crop, push-in, scan, and detail focus.
- Avoid list: no pseudo text, no Chinese text, no random letters, no watermarks, no logos, no platform UI, no dense readable labels, no celebrity likeness.
- If the scene uses ip-diagram-creator routing, include the selected IP diagram capability, role-reference priority, character visual DNA, scene assignment mode, `pageCard` communication task, main visual, text-to-image ratio, deterministic text owner from `workflow/ip-diagram-creator-plan.json`, and the native prompt/repair route from `workflow/ip-diagram-creator-native-jobs.json`.

Every cover prompt must additionally include:

- Title plus narration-derived click promise.
- One dominant visual subject, emotional signal, and curiosity gap.
- Selected thumbnail/poster use-case pattern from the prompt library, generalized into an original composition.
- Platform canvas and safe-zone requirements.
- Integrated Chinese thumbnail typography: exact main title, subtitle/method line, badge text, and any approved supporting microcopy generated from the title/script.
- Avoid list: no unapproved generated text, no random letters or numbers, no platform labels, no logos, no watermarks, no copied creator style.

## Context Image2 Cover Handoff

Final upload-ready covers in Codex App must use Context Image2 / Codex built-in `image_gen`, not a local SVG substitute.

- Core logic first: `workflow/cover-design.json` owns click strategy, category, title/script truth, platform variants, target dimensions, exact visible-text whitelist, and QC. `workflow/cover-image2-prompts.json` owns the GPT Image 2 prompt text.
- Handoff second: `workflow/context-image2-cover-requests.json` lists the current missing or non-upload-ready targets, provider `codex-context-image2`, tool `image_gen`, prompt file paths under `prompts/context-image2-covers/`, expected dimensions, and ingest commands.
- Generation third: the agent calls Context Image2 / `image_gen` for each request, using the manifest's bounded `parallelGenerationPolicy` when present, saves each PNG to the request's expected output, and runs `scripts/ingest-codex-image2-cover-target.mjs --topic <topic-dir> --target <target-id> --source <codex-imagegen-png>`.
- Validation last: ingest may mark `uploadReady: true` only when the source bitmap matches the target ratio and is recorded as a real Codex/Image2 asset. Review SVG/HTML covers stay review-only.
- Native-final personal-IP packages must not treat pending Context Image2 requests as final cover generation. Their QC must report `coverNativeImage2Ready:false` until an upload-ready native Image2/Codex cover target is ingested.
- Missing non-16:9 target covers such as `4:3`, `3:4`, square, Reels, and Bilibili common must not be backfilled with target-size local review drafts. Leave them pending for Context Image2/Image2 and list them in the regeneration manifest so users do not receive a cropped or locally recomposed file as the apparent 4:3 result.

## Do Not Generate / Do Not Insert

Skip generated bitmap insertion when:

- The scene is mainly a process, rule, checklist, chart, workflow, comparison, timing, or typography beat.
- Exception: do not skip when `visualAssetDecision.explainerBoard.active` is true and the generated board is used as a text-safe storyboard/source plate for an education/process/science explanation.
- The generated image would become a generic tech/portal/glow metaphor without a specific narrative job.
- The layout already has a stronger deterministic visual system such as MG panels, charts, state cards, countdowns, or kinetic type.
- The only reason to use the image is that `--image-source codex-builtin` or `--image-source image2` was selected.

## QC Expectations

The run must write:

- `workflow/image-generation-strategy.json`
- `workflow/image2-prompts.json`
- `workflow/visual-asset-manifest.json`
- `workflow/visual-relevance-audit.json`
- `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-creator-native-jobs.json`, and `workflow/ip-diagram-layout-audit.json` when teaching/personal-IP/knowledge-card/PPT route is active

`logs/qc.json` must pass `imageGenerationStrategyPresent`, `generatedImagePurposeFit`, `visualAssetsContentBound`, `ipDiagramCreatorNativeJobsPresent`, and `ipDiagramLayoutAuditPresent` when that route is active.
