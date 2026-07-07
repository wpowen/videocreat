# Typography Motion System

Use this reference when generated videos contain meaningful on-screen text: titles, subtitles, body copy, labels, metrics, quotes, UI states, cover text, or annotations.

## 1. Open Font Research

Prefer open fonts with clear redistribution terms and stable upstreams. Treat "free to use" and "open source" as different claims.

| Family | License | Best use | Source |
| --- | --- | --- | --- |
| Noto Sans/Serif CJK | OFL-1.1 | default CJK UI/body/captions and broad CJK coverage | https://github.com/notofonts/noto-cjk |
| Source Han Sans/Serif | OFL-1.1 | Adobe/Google CJK family; premium CJK sans/serif fallback | https://github.com/adobe-fonts/source-han-sans / https://github.com/adobe-fonts/source-han-serif |
| LXGW WenKai | OFL-1.1 | warm handwritten annotations, story notes, human marginalia | https://github.com/lxgw/LxgwWenKai |
| Inter | OFL-1.1 | modern Latin UI, mixed-language product scenes, captions | https://github.com/rsms/inter |
| IBM Plex | OFL-1.1 | technical, enterprise, data/research tone | https://github.com/IBM/plex |
| JetBrains Mono | OFL-1.1 | code, numbers, terminal/diagnostic UI, tabular metrics | https://github.com/JetBrains/JetBrainsMono |
| Libre Baskerville | OFL-1.1 | Latin editorial quotes and serif contrast | https://github.com/impallari/Libre-Baskerville |

Render policy:

- Do not load remote font CSS during deterministic local render.
- Use local font stacks by default.
- If a run bundles `.ttf`, `.otf`, `.woff`, or `.woff2` files, include the license text and source URL in a font ledger.
- Generated images may not invent final readable Chinese text. Exact text remains deterministic HTML/SVG/CSS unless the cover path explicitly uses reviewed Image 2 integrated typography.

## 2. Font Style Design

Typography is a scene system, not a single font choice. Every scene should decide:

- **Role**: headline, support body, caption, numeric proof, UI label, annotation, quote, cover title.
- **Voice**: editorial, product UI, data proof, kinetic hook, warm note, documentary, bilingual.
- **Scale**: first-read headline must be visibly different from second-read support copy.
- **Weight**: use weight contrast before adding decoration.
- **Width and line count**: keep titles short; do not make paragraphs the primary visual.
- **Spacing**: letter spacing stays `0` for CJK and most video UI. Use line height and whitespace, not tracking tricks.
- **Contrast**: text must pass visually against motion and generated imagery, not only on a static background.
- **Font pairing**: pair at most two families per scene: one display family and one support/mono family.

Premium typography usually means fewer styles with stronger hierarchy:

- one oversized idea;
- one controlled support line;
- one accent device such as underline, slab, sticker, rule, focus ring, or metric rail;
- stable caption band that does not compete with the headline.

## 3. Text Presentation Modes

Choose a mode based on the scene job:

| Mode | Use when | Form |
| --- | --- | --- |
| `editorial-display` | documentary, quotes, literary scenes | large serif/sans contrast, rules, paper underline |
| `kinetic-poster` | hook, contradiction, retention beat | huge keywords, accent slab, mask reveal |
| `product-ui` | product demos, UI workflows, bilingual support | UI font stack, state chip, focus ring |
| `data-mono` | metrics, rankings, proof | tabular numbers, mono units, trend rail |
| `warm-annotation` | writing/story craft, notes, marginalia | WenKai-style note, ink circle, hand annotation |

Rejected modes:

- centered paragraph cards;
- all text at the same size and weight;
- random font changes per line;
- decorative type that reduces legibility;
- text over generated images without a deterministic contrast layer.

## 4. Text Motion Families

Motion must explain the text role.

| Motion family | Verb | Good use | Guardrail |
| --- | --- | --- | --- |
| `line-rise-rule-draw` | reveal | editorial headline and quote | line remains readable at first active frame |
| `word-pop-mask-sweep` | pressure | hook keywords and contrast | no continuous shake; keyword remains stable while read |
| `state-shift-focus-ring` | transform | product/UI state changes | focus motion must point to a real state change |
| `numeric-count-rail-grow` | accumulate | metrics and rankings | only count/animate values present in data/script |
| `annotation-ink-swipe` | inspect | story notes and writing craft | handwriting feel cannot replace readable text |

Use CSS transforms, opacity, masks, underline scale, and color emphasis. Avoid blur-heavy entry, long rotations, bouncing captions, or motion that changes subtitle timing.

## 5. Design And Render Contract

Every final-quality run should write `workflow/typography-motion-plan.json` before rendering. It must include:

- catalog reference: `assets/typography-style-catalog.json`;
- open-font license policy;
- global font stacks;
- per-scene type treatment;
- per-role font stack, weight, line height, and tracking;
- per-scene motion family and semantic reason;
- readable text ownership;
- reject list and accessibility/reduced-motion guards.

`workflow/design-plan.json` pages must carry `typographyMotion.layerClass` so rendered frames apply the selected type family and motion treatment.

Typography is not only a subtitle layer. It applies to every meaningful video text surface: opening hooks, left/right scene text, labels, motion notes, metric numbers, UI state chips, quotes, annotations, and captions. The video frame renderer should inherit the same design ambition as the cover engine: the text must be a designed visual object with hierarchy, semantic information, and motion, not a plain paragraph placed beside a card.

When comparing against cover design quality, the video frame must preserve these cover-grade rules:

- The primary text has a one-second first read, like a thumbnail hook.
- Supporting text explains the scene job or proof, not just repeats the narration.
- The layout is selected from the scene job; it may be kinetic, editorial, UI-state, metric-rail, or annotation-led.
- Cards are optional supporting surfaces, not the universal layout. Repeated left-text/right-card pages are a regression.
- Generated or stock visuals may sit behind text, but deterministic text layers and semantic info rails must remain visible.

The quality gate should fail when:

- `workflow/typography-motion-plan.json` is missing;
- scene pages do not carry typography motion classes;
- scene pages do not carry a `textPresentation` mode;
- hard gates do not include typography plan presence and enforcement;
- exact readable text is delegated to unverified generated imagery;
- fonts are remotely loaded during render;
- animated text becomes clipped, hidden, or unreadable.
