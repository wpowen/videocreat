# Codex Video Workflow — Showcase Design System

## Source of truth

- Product and production behavior: `SKILL.md`, `scripts/poc-video-workflow.mjs`, and the structured catalogs under `assets/`.
- Current README evidence: `media/showcase/`, especially `core-demo/`, `personal-ip/`, `covers/`, `templates/`, and `visual-series/`.
- Motion meaning: `assets/motion-style-template-library.json` and the motion references under `references/`.
- Caption inventory: `assets/caption-style-catalog.json` and caption planning references under `references/`.
- Release language must distinguish a configurable catalog, a review render, a QC-passed video, and a publishing-ready package.

## Brand

The product should feel like a small editorial production studio: precise, visual, calm, and evidence-led. It is not presented as a novelty effects generator. The primary promise is that one brief can become a reviewable video, cover set, configuration surface, and quality record.

The showcase uses warm paper, ink black, mineral blue, copper, and restrained coral. Dark product scenes may switch to midnight navy with cyan accents, but every scene keeps the same typographic discipline and editorial voice.

## Product goals

1. Let a new visitor understand the complete workflow within the first screen of the README.
2. Demonstrate motion with concrete content and a named semantic job, not abstract template thumbnails.
3. Prove that real images, native Personal-IP pages, captions, covers, and configuration screens enter the final media pipeline.
4. Make full-auto and semi-auto operation understandable without requiring prior knowledge of the repository.
5. Keep capability counts credible by attaching them to catalogs, runtime artifacts, provenance, and QC evidence.

## Personas and jobs

- Creator: wants a fast path from an idea to a polished, platform-ready review package.
- Content lead: wants to choose style, voice, format, covers, and page-level direction before rendering.
- Reviewer: wants to see what is real, what is a preview, what passed QC, and what still blocks release.
- Contributor: wants stable entry points, explicit contracts, and examples that explain why a template exists.

## Information architecture

The README follows a persuasion sequence:

1. Promise and primary demo.
2. Concrete motion examples: content, movement, and meaning.
3. Full-auto and semi-auto operation.
4. Caption atlas, color systems, and cover logic.
5. Personal IP and layered whiteboard.
6. Visual-page and real-image routing.
7. Skills, evidence package, installation, and honest release boundaries.

The capability reel follows the same order so the README and video reinforce one another.

## Design principles

- One scene, one idea. Every scene has one claim, one visual proof, and one reason to continue.
- Motion explains. It must reveal grouping, causality, transformation, progression, comparison, or completion.
- Real content first. Screenshots, native pages, covers, and visual-series images are semantic objects, not background decoration.
- Captions stay readable. A single active narration caption owns the bottom safe band; style samples never compete with it.
- Counts need context. `160`, `68`, and `44` are presented as catalogs or configuration surfaces, never as independent finished videos or render engines.
- Status remains honest. Review previews, native outputs, QC passes, and publishing readiness use different labels.

## Visual language

- Base: `#F5F0E6` paper, `#15191F` ink, `#C6563C` coral, `#C9973E` copper, `#2D6F78` mineral teal.
- Dark UI: `#0C1320`, `#142236`, `#58D3D8`, `#FB6B72`.
- Type: system Chinese sans for body and labels; condensed or black-weight display type for hooks; monospace only for technical evidence.
- Surfaces: paper cards, fine rules, quiet shadows, rounded product panels, and hand-drawn annotations. Avoid glossy generic gradients as the default language.
- Motion: trace, connect, compare, scan, accumulate, lock, and resolve. Decorative floating or random staggering is not a primary action.

## Components

- Hero: one strong promise, a single primary demo link, and a compact capability line.
- Semantic example plate: left title and meaning, center content object, right motion legend. The legend names the action and what it communicates.
- Evidence board: source cards, connecting thread, focused conclusion, and provenance note.
- Process track: labeled stages, current node, completed nodes, and a result card.
- Product path: real interface image with input, processing, and output focus states.
- Cover wall: real 16:9, 9:16, and 1:1 assets with a selected rationale.
- Caption museum: one large plane divided into eight districts, all 68 style names visible, one current district in focus, and one active narration caption.
- Personal-IP spread: two native pages with consistent character and layout, plus a clear non-likeness statement.
- Whiteboard overlay: stable base page, drawn path, circled node, colored semantic fill, then a reading hold.
- Provenance note: source type, native or preview status, and claim boundary.

## Accessibility

- Maintain WCAG AA contrast for body copy and captions.
- Keep active narration captions in the bottom safe band with a single readable line whenever possible.
- Do not rely on color alone for process state; use labels, shapes, and completion marks.
- README images require descriptive alt text and linked full-size versions when dense.
- Motion must preserve a final hold long enough to read and should avoid rapid flashing.

## Responsive behavior

- README media stacks into one column on narrow screens; paired comparison images remain individually clickable.
- Dense configuration captures use full-width links rather than tiny multi-column thumbnails.
- Video scenes are authored for 16:9, with critical text inside a conservative center and bottom safe area.
- Vertical Personal-IP examples remain native 9:16 assets and are never produced by cropping a horizontal master.

## Interaction states

- Configuration UI: default, selected, hover/focus, language-switched, review-required, and blocked states.
- Motion examples: establish, animate, resolve, and reading hold.
- Caption museum: overview, district focus, representative sample, and overview return.
- Cover and material selection: candidate, selected, rejected with reason, pending native generation, and QC passed.

## Content voice

Use short, concrete Chinese-first language. Name the content, the motion, and the meaning: “节点推进代表阶段完成,” not “炫酷时间线.” Avoid hype that cannot be proven. English copy should be direct rather than literal or promotional filler.

## Implementation constraints

- Final motion demos are deterministic HTML-to-frame renders at 1920×1080 and 30 fps, encoded with H.264/AAC.
- Narration uses a local supported TTS backend; captions derive from the final spoken script and remain deterministic.
- README media must live outside ignored production directories and include stable relative links.
- Native Personal-IP imagery keeps provenance and persona consistency; generic hosts never claim the user's likeness.
- Whiteboard animation modifies only semantic foreground layers and keeps captions topmost.
- Final packages include probe, black-frame, audio, screenshot, text-safety, asset-manifest, and provenance evidence where applicable.

## Open questions

- Which cover targets should be regenerated as native Image2 bitmaps before the next public release?
- Should the public README lead with the Chinese or English capability reel audio track?
- Which of the nine visual-page routes should receive full standalone demo videos after this general-purpose reel?
