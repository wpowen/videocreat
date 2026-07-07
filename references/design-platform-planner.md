# Design Platform Planner

Use this reference when a brief asks for stronger aesthetics, UI taste, interaction, animation, or videos that feel less like PPT. The platforms below are inspiration sources and planning lenses. Do not copy their showcased designs, site recordings, screenshots, templates, components, or brand expression unless the source license and attribution are explicitly recorded.

## Platform Interpretations

| Platform | What it contains | Use it for video planning | Transfer into video as |
| --- | --- | --- | --- |
| Landing Love | Animation-focused landing-page gallery with full-page video recordings and categories such as 3D, SaaS, AI, portfolio, dark mode, ecommerce, studio, illustration, and minimal. | Study how a screen earns motion: scroll rhythm, staged reveal, parallax, micro-interaction, and moving proof. | Motion verbs, reveal timing, camera/pointer feeling, first-second movement. |
| Landbook | Curated website design gallery updated daily, with categories such as landing, portfolio, blog, ecommerce, case study, product listing, and product page. | Extract premium composition: hero hierarchy, whitespace, type scale, restrained color, and editorial product framing. | Taste contract, layout density, typographic hierarchy, material quality. |
| Awwwards | Award platform for designers, developers, studios, and agencies; winning sites include Site of the Day/Year and developer recognition. | Raise the creative bar beyond templates: concept-first art direction, memorable transitions, brave composition, technical ambition. | Hero concept, signature transition, creative risk, non-generic scene language. |
| One Page Love | Curated one-page website gallery with thousands of shipped one-pagers and section references/templates. | Turn a video into one continuous argument: hook, proof, mechanism, example, close, with no dead section. | Narrative scroll structure, single-page information economy, progress reveal. |
| Mobbin | Large UI/UX reference library for mobile and web apps, searchable screenshots, user journeys, flows, videos, prototypes, and Figma copy workflows. | Borrow interaction logic, not pixels: onboarding flow, state changes, empty/success/error states, screen-to-screen continuity. | App-like state transitions, journey cards, step validation, microcopy rhythm. |
| CollectUI | Daily interface inspiration gallery with latest designs, designer/category/trending navigation, favorite/save behavior, and compact card-grid browsing. | Study how curated UI patterns are grouped, scanned, tagged, and compared without becoming a screenshot dump. | Original component cards, category chips, stateful proof panels, scan-friendly gallery rhythm. |
| Pinterest UI样式 | Chinese Pinterest board titled `UI样式`, surfaced as 150 ideas around UI design, icon design, app/web/mobile UI, cards, dashboard, finance, and e-learning references. | Build moodboard logic: cluster recurring motifs, color/material families, icon/card patterns, and topic-specific interface atmospheres. | Moodboard clusters, icon-card rhythm, surface families, palette/material notes, visual vocabulary. |
| Lapa Ninja | Landing-page inspiration library with thousands of landing pages, screenshots, video recordings, categories, examples, learn/resources/templates. | Build conversion-grade video structure: promise, value proof, demo, trust, CTA, visual showcase. | Hook logic, benefit ladder, social-proof/evidence beats, landing-page pacing. |
| Framer Gallery | Framer community gallery and marketplace for creative websites, templates, responsive pages, categories, and no-code production patterns. | Use componentized motion and responsive sections as a mental model for video modules. | Reusable scene sections, component transitions, no-code prototype feel. |
| Aceternity UI | Copy-paste React/Next.js components and templates with Tailwind CSS and Framer Motion, including animated cards, hero sections, backgrounds, loaders, text effects. | Map abstract ideas into high-impact UI primitives: spotlight, parallax, lamp, typewriter, card stack, sticky reveal. | Component-level motion grammar and polished hover/focus illusions. |
| 21st.dev | Community registry for React components/templates plus Magic/MCP-style generation and variation workflows. | Make the planner generate multiple style options before locking the direction; prefer crafted UI blocks over generic AI averages. | Style variation planner, component selection, remix rules, anti-generic gate. |
| Siteinspire | Curated showcase of fine web design and talent, with style/type/subject/platform categorization and weekly discovery. | Tune taste and restraint: typography, spacing, editorial composition, identity-fit, and category-aware selection. | Curation filter, typographic restraint, portfolio/editorial taste checks. |

## Planner Rules

1. Select platform lenses by job, not popularity:
   - motion/interactivity: Landing Love, Awwwards, Aceternity UI, Framer Gallery;
   - premium layout/taste: Landbook, Siteinspire, Awwwards;
   - narrative/landing logic: One Page Love, Lapa Ninja;
   - app/journey logic: Mobbin;
   - interface-pattern curation: CollectUI;
   - moodboard/style vocabulary: Pinterest UI样式;
   - component/remix logic: 21st.dev, Aceternity UI, Framer Gallery.
2. Convert references into abstract controls:
   - `visualJob`: what the viewer must understand;
   - `motionVerb`: reveal, trace, compare, inspect, transform, accumulate, resolve;
   - `interactionFeeling`: hover, focus, drag, scroll, snap, active state, prototype transition;
   - `layoutContract`: focal point, density, safe zone, hierarchy;
   - `logicContract`: hook, evidence, mechanism, flow, payoff.
3. The planner must write `workflow/design-platform-planner.json` before rendering. It should include selected platforms, per-platform interpretation, selection rationale, anti-PPT rules, scene assignments, and source URLs.
4. Do not use platform screenshots as final assets by default. Generate original HTML/SVG/image prompts and keep exact Chinese text in deterministic layers.
5. Final QC should fail if the design-platform planner is absent when the brief explicitly asks to use design inspiration sites, aesthetics, UI components, interaction, animation, or anti-PPT logic.

## CollectUI / Pinterest Transfer Rules

Use these two sources as curation logic, not asset sources.

CollectUI is strongest when a video scene needs to feel like a professional product/interface surface: use compact cards, category chips, favorite/feedback-like micro-states, designer/gallery curation, and a single enlarged proof panel. In video, this should become original deterministic HTML/SVG UI, not a captured CollectUI page.

Pinterest UI样式 is strongest when the visual direction is not selected yet: group pins into motif families such as finance cards, e-learning dashboards, mobile app onboarding, icon systems, profile cards, and web app panels. In video, this should become a style vocabulary recorded in `workflow/aesthetic-brief.json`, `workflow/design-platform-planner.json`, and `workflow/image2-prompts.json`; it must not copy pinned layouts, icon sets, app screens, creator names, or Behance/Dribbble source compositions.

When either source is active, each scene assignment should answer:

- `patternFamily`: app surface, card, icon system, dashboard, e-learning, finance, gallery, profile, or mobile state.
- `originalizationRule`: what will be changed so the output is not a copied UI.
- `motionVerb`: scan, inspect, reveal, compare, cluster, zoom, or resolve.
- `safeTextOwner`: deterministic renderer owns Chinese text, labels, subtitles, numbers, and claims.
- `antiPptGuard`: no full-screen screenshots, no decorative collages, no repeated card wall with no narrative job.

## Source URLs

- Landing Love: https://www.landing.love/
- Landbook: https://land-book.com/
- Awwwards: https://www.awwwards.com/
- One Page Love: https://onepagelove.com/
- Mobbin: https://mobbin.com/
- CollectUI: https://collectui.com/
- Pinterest UI样式: https://www.pinterest.com/hmq1285/ui%E6%A0%B7%E5%BC%8F/
- Lapa Ninja: https://www.lapa.ninja/
- Framer Gallery: https://www.framer.com/community/gallery/
- Aceternity UI: https://ui.aceternity.com/
- 21st.dev: https://21st.dev/
- Siteinspire: https://www.siteinspire.com/
