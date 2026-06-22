# Aesthetic System

Use this reference whenever the user asks for a video to feel more alive, premium, tasteful, retention-oriented, or less like PPT.

## Principle

Aesthetic quality is a planning artifact, not a last-minute decoration. Before rendering, write:

- `workflow/aesthetic-brief.json`
- `workflow/aesthetic-quality-rubric.md`
- `workflow/content-presentation-design.json`
- `workflow/motion-template-selection.json`
- `workflow/design-plan.json`
- `workflow/image2-prompts.json`
- `workflow/visual-asset-manifest.json`

The video should have a named visual territory, scene-specific visual metaphors, and a clear reason for color, type, composition, imagery, and motion choices.

Strict adherence rule: the rendered video must follow the selected aesthetic brief and design plan. Do not substitute a static SVG slideshow, generic text cards, centered paragraph screens, or mismatched UI simply because it is faster to render. If a renderer fallback is used, it must still preserve the planned template kit, inserted visual assets, safe zones, typography hierarchy, color rules, caption treatment, and motion language.

## Capability Routing

| Capability | Use for | When to route |
| --- | --- | --- |
| `$design` / `DESIGN.md` | Durable design source of truth: taste rules, visual language, tokens, and review criteria | The repo or workflow needs a lasting visual contract |
| `awesome-design-md` | Mature brand/product style templates such as Linear, Stripe, Notion, Vercel, Claude | The user wants a premium known-product aesthetic direction |
| `creative-production:moodboard-explorer` | Broad visual territories, mood, audience feeling, art direction options | The aesthetic direction is not selected yet |
| `creative-production:scene-explorer` | Reusable scene/metaphor libraries and environment prompts | The topic needs richer visual contexts |
| `creative-production:shot-explorer` | Camera, crop, macro, angle, and framing options from a selected visual anchor | The core image exists but framing needs stronger retention |
| `creative-production:generative-polish` | Premium lighting, texture, depth, background mood, and final visual finish | The deterministic layout/copy is locked and needs polish |
| `visual-ralph` / visual verdict | Screenshot/reference comparison and iteration until visual threshold is met | A concrete visual target or generated reference exists |
| GPT Image 2 / image2 | Original high-polish still images, backgrounds, visual metaphors, editorial texture | API credentials and review boundary are available; exact text remains deterministic |

## Aesthetic Brief Fields

Every run should define:

- Taste goal: what feeling should make the viewer stay.
- Content presentation design: topic type, audience state, content jobs, information hierarchy, display logic, visual metaphor, layout system, and motion purpose.
- Visual territory: the named design world.
- Mood keywords: concrete visual cues, not abstract compliments.
- Avoid list: anti-patterns such as pure text cards, cheap gradients, random decoration, or repeated layouts.
- Composition rules: focal point, safe zones, foreground/midground/background.
- Color rules: base palette, accent usage, contrast, and one-note-palette avoidance.
- Typography rules: hierarchy, scale, line count, and caption separation.
- Imagery rules: what image2/generative layers own and what deterministic layers own.
- Motion rules: scene-specific movement that reveals meaning.
- Capability routing: which skill/tool should be invoked when the current quality gap appears.

## Review Rubric

Pass only when the rendered screenshots show:

- Immediate first-second curiosity or tension.
- One strong focal idea per scene.
- A complete content presentation system, not isolated decorative screens.
- A visible visual metaphor or insert asset, not only headline text.
- Intentional negative space and no text collisions.
- Tasteful color restraint with high contrast.
- Distinct typography hierarchy.
- Motion language connected to meaning.
- Generated imagery does not own final Chinese text, claims, subtitles, logos, or numbers.

For final video delivery, screenshot review alone is not enough when animation is required. Select a motion template from `templates/html-motion/motion-template-registry.json` or document a custom template, then verify motion with one of:

- renderer evidence from `html-video`/HyperFrames plus a written per-scene motion plan;
- two same-scene frame grabs with a visible change in moving elements;
- a short motion-difference check recorded under `logs/`.

## Novel-Writing Video Direction

For `writing-method` videos, prefer:

- cinematic editorial story lab;
- warm paper and deep ink;
- manuscript pages, clues, chapter cards, corkboard threads, rewrite lens, edit desk;
- paper wipes, node cascades, lens sweeps, and cut-mark motion;
- deterministic Chinese headline/subtitle overlays on top of generated or local visual layers.

Avoid:

- lecture slide layouts;
- centered text blocks on every scene;
- generic book/pen stock-style backgrounds;
- dense paragraphs;
- AI-generated Chinese text inside image2 outputs.
- stripping out animation or camera movement to reduce render time.
