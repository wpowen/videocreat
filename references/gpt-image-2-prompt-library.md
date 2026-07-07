# GPT Image 2 Prompt Library Adaptation

Use this reference when a run needs GPT Image 2 / Codex `image_gen` still assets for video covers, thumbnails, scene inserts, product visuals, storyboards, or poster-like support images.

## Source Boundary

Primary inspiration source:

- `https://github.com/YouMind-OpenLab/awesome-gpt-image-2/blob/main/README_zh.md`
- `https://youmind.com/zh-CN/gpt-image-2-prompts`

Additional method sources:

- `https://github.com/hskaildm/gpt-image-2-curated-prompts` — four-part prompt skeleton (positioning statement, module checklist, visual requirements, negative exclusion), variable topic slots, integrated Chinese typography direction, cross-frame consistency wording.
- `https://github.com/peterRooo/awesome-gpt-image-2-prompts` — category taxonomy, structured record schema with quality grading, capability evidence for dense Chinese plates, labeled diagrams, and consistent grids.

Treat every collection as a prompt-method library, not as a copy source. YouMind is CC BY 4.0; the two additional repositories declare no license and transcribe community prompts, so the boundary is stricter: never paste their prompts into final user packages. For this skill, borrow only reusable structure: taxonomy, prompt fields, dynamic slots, composition discipline, material/lighting language, and negative constraints. The distilled, rights-safe product of these methods is the visual series catalog `assets/gpt-image-2-visual-series-catalog.json` (contract: `references/gpt-image-2-visual-series.md`).

## Borrowed Method

Map every generated image prompt through three axes before writing the final prompt:

1. Use case: YouTube/short-video thumbnail, poster/flyer, infographic/education visual, comic/storyboard, product marketing, ecommerce main image, app/web design, profile/avatar, game asset, or abstract background.
2. Style: photography, cinematic film still, illustration, sketch/line art, comic/graphic novel, 3D render, chibi/Q style, isometric, pixel art, oil painting, watercolor, ink/Chinese style, retro/vintage, cyberpunk/sci-fi, or minimalism.
3. Subject: person/character, product, food/drink, fashion item, vehicle, architecture/interior, landscape/nature, cityscape/street, diagram/chart, text/typography, or abstract texture.

Then write the prompt as a structured production brief:

- `type`: the artifact role, such as scene insert, integrated cover, storyboard frame, product shot, diagram background, or texture plate.
- `subject`: the concrete visible subject and what must be recognizable.
- `style`: medium, reference-free visual treatment, quality bar, and camera/rendering language.
- `layout`: canvas ratio, focal placement, foreground/midground/background, crop-safe zones, caption/title safe zones, and motion-ready negative space.
- `lighting_and_material`: lighting direction, contrast, texture, surface behavior, depth, lens/camera treatment, and finish.
- `content_binding`: current narration beat, headline, and at least three scene keywords.
- `allowed_text`: only for cover integrated typography or intentionally text-led graphics; otherwise keep exact Chinese text in deterministic HTML/SVG/CSS.
- `dynamic_slots`: variable placeholders for topic, subject, palette, background, visual metaphor, title, subtitle, or badge, so future runs can adapt without rewriting the pattern.
- `negative_constraints`: no watermark, logo, platform UI, copied creator style, celebrity likeness, random letters/numbers, dense labels, pseudo text, extra Chinese text, or generic decoration.

## Video-Specific Adaptation Rules

- Scene insert prompts must generate material for a video layer, not complete slides. The image should leave safe space for deterministic title/subtitle layers and survive crop, push-in, scan, and focus changes.
- Exception: when the Image2 explainer-board route is active, the prompt may ask for a dense explainer/storyboard board inspired by prompt-library methods for education/infographic slides. It is still a video source plate, not a finished PPT page: the generated bitmap owns module structure, icons, arrows, blank label plaques, visual hierarchy, and texture; deterministic HTML/SVG/CSS owns exact Chinese text, labels, subtitles, numbers, claims, and source notes.
- Cover prompts may ask Image 2 to render approved Chinese thumbnail typography as part of the bitmap. The prompt must include a strict text whitelist and forbid all other readable text.
- Abstract/process/chart scenes should normally stay deterministic MG/chart/typography. Use generated images when the scene has a concrete subject, location, product, character, cinematic proof object, material metaphor, or an approved explainer-board storyboard job that can be split into video crops.
- For multi-scene or storyboard-like output, preserve visual continuity through shared palette, subject details, lighting logic, and recurring material motifs, while changing shot role and camera distance per scene.
- Prompt examples from the library that include real brands, logos, IP, named people, creator styles, or exact source layouts must be generalized into original, rights-safe placeholders before use.

### Explainer-Board Prompt Pattern

Use for science, education, tool/workflow, model/mechanism, and high-density teaching scenes when Image2 is explicitly requested or the planner selects a visual board.

The approved video preset is `image2-explainer-board-v1`. Prompts should not include that internal id as visible text, but prompt manifests must carry it through `visualPresetId` and the run must write `workflow/visual-preset-lock.json`.

Required adaptation:

- Generalize named styles into safe traits: soft/friendly public-education illustration plus high-density briefing-board structure.
- Ask for a 16:9 multi-panel board with problem/context, central process or causal chain, evidence/comparison, icon clusters, flow arrows, and a takeaway strip.
- Require a storyboard split plan: wide board, module crop, central process crop, evidence crop, takeaway crop.
- Forbid readable generated text except abstract placeholder strokes and blank label plaques.
- Reserve title and subtitle safe zones so the renderer can place deterministic text without covering the image.

## Prompt QC

A generated-image prompt is acceptable only when it answers all of these:

- What artifact is being generated and where will it sit in the video?
- What scene narration or cover promise does it visualize?
- Which use-case/style/subject axes were selected?
- Which exact details must be visible, and which exact text must not be generated?
- Where are the overlay-safe zones?
- How will the asset support at least two crop/focus/scan states inside the final scene?
- What negative constraints prevent generic, copied, or text-corrupted output?
