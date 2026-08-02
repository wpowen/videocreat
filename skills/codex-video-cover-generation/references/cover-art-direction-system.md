# Cover art-direction system

Use this reference when planning or regenerating a platform-submission cover. It adds a reusable art-direction layer without weakening the existing platform, evidence, ingest, or QC contracts.

## Method

Apply `cover-art-direction-system-v1` in this order:

1. Derive only the cover-relevant content fields from the locked title and narration: audience, one-sentence promise, short hook, optional payoff, dominant subject, visual metaphor, credible evidence, mood, and banned elements. Never paste the full narration into the image prompt.
2. Lock the native platform target, ratio, safe area, and small-preview decision surface before choosing a style.
3. Select exactly one compatible style atom. A style atom is reusable visual language, not a complete cover template.
4. Fuse the selected atom into the cover prompt's subject, composition, typography, color, material, texture, and negative constraints. Never append a raw style block after a generic cover prompt and never mix multiple atoms.
5. Preserve the title hierarchy: A-layer short hook for first read, B-layer complete meaning when needed, and at most one C-layer badge or proof label. Only approved verbatim strings may render.
6. Generate one native-ratio bitmap per target. Variants share the content promise and selected style but recompose for each platform; they are not crops of one master bitmap.
7. Inspect the result at native size and at 120-180 px width. The first glance must reveal the topic/promise; the second glance must reveal the subject, proof, or metaphor.

## Style atoms

Every atom exposes `anchors`, `coverAdaptation`, `presenterPolicy`, `textPolicy`, `surfaceMode`, `backgroundPolicy`, `mustPreserve`, and `avoid`. The planner must record the selected id, selection reason, and those eight fields in `workflow/cover-design.json` and `workflow/cover-image2-prompts.json`.

### `cinematic-presenter-proof`

- Best for: knowledge tutorials, creator methods, personal-IP explainers, product demonstrations.
- Anchors: one large presenter or proof subject, integrated oversized hook, one truthful proof object, directional light, foreground/midground/background separation.
- Cover adaptation: make the presenter/proof object and title one composition; use one comparison, check, warning, or result signal only when supported by the script.
- Presenter policy: allow a presenter only for genuinely presenter-led topics; preserve an authorized identity reference when supplied.
- Text policy: one hook plus at most one supported proof label; no generic methodology badge by default.
- Surface mode: dark.
- Background policy: cinematic topic-colored field; amber or cream must not become a universal presenter background.
- Must preserve: identity reference when supplied, approachable topic-appropriate expression, mobile title readability, low element count.
- Avoid: generic angry presenter, fabricated metrics, UI dashboard, card pile, cheap sales-poster finish.

### `editorial-type-metaphor`

- Best for: strategy, abstract ideas, opinion, cognition, system thinking.
- Anchors: restrained editorial grid, generous designed negative space, large readable type as spatial structure, one precise metaphor growing from the lettering, limited neutral palette with one accent.
- Cover adaptation: let the title become a path, threshold, container, wall, window, fault line, or other topic-bound structure; subordinate all labels.
- Presenter policy: no presenter unless an authorized identity reference is explicitly supplied.
- Text policy: one headline and, only when essential, one short source-supported line.
- Surface mode: light.
- Background policy: clean gallery-like semantic field; warm off-white is allowed only when the topic supports it.
- Must preserve: correct Chinese glyphs, clear first-read title, one metaphor, deliberate alignment.
- Avoid: empty large type, decorative illustration beside unrelated text, multiple palettes, over-distorted lettering.

### `tactile-document-collage`

- Best for: history, culture, stories, investigations, memory, archival material.
- Anchors: layered documents or map fragments, tactile paper edges, print grain, restrained annotations, one dominant editorial headline.
- Cover adaptation: build the visual evidence from a small number of meaningful fragments whose overlap creates the narrative or reveal.
- Presenter policy: no presenter unless an authorized identity reference is explicitly supplied; artifacts carry the story.
- Text policy: one dominant headline; supporting fragments remain non-readable unless approved.
- Surface mode: muted.
- Background policy: low-saturation topic-colored field behind localized paper artifacts; paper is an object, not the automatic canvas.
- Must preserve: tactile depth, designed hierarchy, readable headline, content-specific artifacts.
- Avoid: random scrapbook piles, unreadable filler copy, clean flat-card UI, nostalgic texture unrelated to the topic.

### `monumental-chinese-type`

- Best for: events, conflict, warnings, launches, high-energy social topics, short decisive hooks.
- Anchors: enormous Chinese hook as the main object, strong perspective or compression, small scale references, dramatic contrast, controlled motion or impact cues.
- Cover adaptation: turn the title into architecture, terrain, stage, route, obstacle, or impact object while keeping glyphs intact.
- Presenter policy: no presenter unless an authorized identity reference is explicitly supplied; the title is the subject.
- Text policy: one short headline only, with no subtitle, badge, or comparison label.
- Surface mode: dark.
- Background policy: deep high-contrast semantic field; never default cream paper.
- Must preserve: title legibility, one visual center, native-ratio breathing room, strong scale contrast.
- Avoid: ordinary title over a background image, broken Chinese characters, edge-dependent text, multiple competing subjects.

### `analytical-magazine-system`

- Best for: news, markets, business, AI trends, policy, product analysis.
- Anchors: authoritative editorial hierarchy, one credible object or causal diagram fragment, sparse labels, structured lines, restrained high-contrast color blocks.
- Cover adaptation: fuse the main judgment with a curve, map, fault line, timeline fragment, threshold, or system node; keep supporting information minimal.
- Presenter policy: no presenter unless an authorized identity reference is explicitly supplied; the causal object is the subject.
- Text policy: one judgment headline; no generic badges, method copy, or invented data.
- Surface mode: light.
- Background policy: crisp cool publication field with one semantic accent; avoid parchment and beige newsprint.
- Must preserve: content truth, clear judgment, one inspectable evidence signal, publication-like discipline without imitating a real publication.
- Avoid: fake mastheads or logos, dense fake data, stock handshake imagery, finance-template noise, full dashboard layouts.

### `research-mechanism-plate`

- Best for: science, medicine, engineering, mechanisms, research-heavy explainers.
- Anchors: one mechanism or specimen as hero, precise diagrammatic relationships, disciplined labels from the approved whitelist, lab/editorial material realism, calm evidence-led color.
- Cover adaptation: reveal one causal mechanism at cover scale rather than explaining the whole paper or process.
- Presenter policy: no presenter unless an authorized identity reference is explicitly supplied; the mechanism is the hero.
- Text policy: one headline and at most one factual, source-supported label.
- Surface mode: light.
- Background policy: cool clinical or technical field; never default yellow paper or generic neon science.
- Must preserve: plausible structure, one evidence hierarchy, clean typography, distinction between known fact and illustrative metaphor.
- Avoid: dense paper figures, invented labels or numbers, medical overclaim, generic neon science imagery, infographic overload.

## Selection rules

- Honor an explicit compatible `brief.coverStyleId` or `brief.coverArtDirectionStyleId`; fail closed on an unknown id.
- Otherwise select from title, narration-derived frames, content category, visual metaphor, and target platform. Prefer the most specific content match; use `cinematic-presenter-proof` only as the knowledge/tutorial fallback.
- Keep one style id across platform variants for the same cover concept. Adapt composition and density per target without changing the art-direction identity.
- Record `selectionMode` as `explicit` or `auto`, plus a human-readable `selectionReason`.

## Semantic color system

Apply `cover-semantic-color-system-v1` after selecting the style atom:

1. Select exactly one semantic family from the title, narration-derived content, visual metaphor, and content category: `civic-blueprint`, `lab-cyan`, `digital-violet`, `market-emerald`, `warning-crimson`, `living-earth`, `literary-plum`, `archive-oxide`, or the fallback `studio-cobalt`.
2. Let the selected style atom choose the surface mode: `light`, `muted`, or `dark`. The same topic may therefore remain semantically coherent while different style atoms produce materially different backgrounds.
3. Let the platform control small-preview contrast, safe area, and density only. Do not let YouTube, Bilibili, vertical video, or square feed force one default hue.
4. Record methodology version, semantic family id/label, selection mode/reason, surface mode, background colors, accents, and background policy per target.
5. Honor explicit `brief.coverColorFamilyId` or `brief.coverPaletteId`; fail closed on an unknown id.

Warm yellow, cream, parchment, or paper textures may appear only when supported by the topic and then only as localized material unless the user explicitly requests a full-canvas paper treatment. They are never the automatic background.

## Provenance boundary

This system is an original adaptation of the reusable idea "cover task + exactly one style atom + integrated prompt" observed in AdrianPunk's Punk-Skill at commit `ab6e7e73b78fad519b1aa46621b25accb1e656e2`. The upstream repository did not publish a license at review time, so do not copy its prompt text, screenshots, style files, or article-platform ratios. Reuse only the abstract separation of responsibilities and keep this project's video-platform, lineage, target-ratio, and QC contracts authoritative.
