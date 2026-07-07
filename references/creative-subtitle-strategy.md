# Creative Subtitle Strategy

Use this reference when the subtitle layer needs to become a designed, animated, content-aware overlay instead of a plain caption bar.

## Design Standard

Creative subtitles are part of the visual system. They must feel like a premium UI, editorial, mobile, documentary, or kinetic layer chosen for the topic, not a generic decoration added after render.

High-quality subtitle design must satisfy five constraints:

- Readability first: the viewer can read the active cue without pausing.
- Timecode fidelity: animation follows `subtitleCues[]` and `workflow/voice-subtitle-manifest.json`; it never creates new TTS cuts.
- One active spoken line: visual wrapping may be sequenced, but wrapped lines cannot stack at the same timestamp.
- Content semantics: style and emphasis must match the cue job, such as hook, quote, proof, metric, warning, step, or bilingual support.
- Motion restraint: motion can reveal, focus, highlight, or resolve; it cannot compete with the spoken text.

## Aesthetic Dimensions

Planner should choose from the caption catalog by aesthetic dimension:

| Dimension | Use For | Examples |
| --- | --- | --- |
| `material-depth` | premium glass, AI/tool, soft modern explainers | Prism Glass, Liquid Blur, Crystal Plate |
| `typographic-editorial` | quotes, documentary, writing/story craft, source-led proof | Editorial Rule, Proof Highlight, Book Margin Note |
| `rhythmic-emphasis` | hook, contradiction, keyword punch, short-form retention | Kinetic Slab, Premium Karaoke Tokens, Liquid Highlighter |
| `interface-native` | product demos, SaaS, workflows, data/tool scenes | Command Palette, Product Toast, Stat Counter Lockup |
| `mobile-safe-retention` | Douyin/TikTok/Reels/Shorts, thumb-safe captions | Vertical Live, Vertical Thumb Guard, Social Sticker |
| `low-obstruction` | strong image/footage scenes, documentary, clean background | Edge Caption Rail, Minimal Borderless, Dimmer Band |
| `language-hierarchy` | bilingual, interview identity, translation hierarchy | Split Bilingual, Interview Lower Third, Caption Stack |
| `voice-identity` | podcast, voice note, interview, recap | Waveform Base, Capsule Transcript, Voice Note |

## Creative Subtitle Content Types

The subtitle planner may enrich visual metadata while preserving the spoken cue:

- `emphasisTokens`: short phrases to bold, tint, underline, chip, or marker-highlight. These are visual-only and cannot split audio.
- `semanticCueType`: one of `hook`, `question`, `contrast`, `proof`, `metric`, `warning`, `step`, `quote`, `identity`, `translation`, `recap`.
- `tone`: `calm`, `premium`, `urgent`, `playful`, `technical`, `documentary`, `editorial`, or `mobile`.
- `speakerLabel`: narrator, role, source, or interview identity shown as a small deterministic label.
- `secondaryText`: translation or explanatory support line. It must be lower hierarchy and cannot replace the primary spoken cue.
- `motionVerb`: `rise`, `scan`, `punch`, `wipe`, `type`, `underline`, `dock`, `spotlight`, `snap`, `settle`.

## Example Creative Captions

These examples show the intended content range. They are not a fixed script library.

| Cue Job | Primary Caption | Emphasis Tokens | Good Style Families |
| --- | --- | --- | --- |
| Hook | `为什么观众总是在这里划走？` | `观众`, `划走` | mobile, kinetic |
| Contrast | `普通字幕解释内容，高级字幕组织注意力。` | `普通字幕`, `高级字幕`, `注意力` | editorial, kinetic |
| Metric | `完播率提升，往往来自更少的阅读阻力。` | `完播率`, `阅读阻力` | ui, editorial |
| Step | `先压缩信息，再放大关键词。` | `压缩信息`, `放大关键词` | ui, kinetic |
| Quote | `读者不是被说服的，是被下一秒勾住的。` | `下一秒`, `勾住` | editorial, glass |
| Warning | `别让视觉换行，反过来切碎口播。` | `视觉换行`, `切碎口播` | alert/kinetic, ui |
| Bilingual | `字幕要像界面组件，而不是黑色补丁。` | `界面组件`, `黑色补丁` | bilingual, glass |
| Product | `这一步不是点击按钮，是确认状态已经改变。` | `状态`, `改变` | ui, glass |

## Planner Selection Strategy

For every run, Planner must:

1. Read `assets/caption-style-catalog.json`.
2. Select a primary caption group from scene job, platform, aspect ratio, content type, and visual density.
3. Select a concrete `selectedStyleId` and `fallbackStyleId`.
4. Write the reason in `workflow/caption-style-plan.json`.
5. Write `emphasisPlan` only when the cue has obvious semantic keywords; do not highlight every word.
6. Keep the same caption family within a scene cluster, but allow scene-level variation when the narration job changes.
7. Use the reduced-motion fallback when motion adds no meaning or when platform/safety constraints dominate.

Scene defaults:

- Opening hook: choose `kinetic` or `mobile`, with at most two emphasized tokens.
- Generic vertical short-form narration: choose `mobile`; first-screen promise remains a `hook` job but should still prefer mobile-safe geometry on 9:16 platforms.
- Quote/proof scene: choose `editorial` or `glass`, with a fine rule, quote frame, or proof underline.
- Product/workflow scene: choose `ui`, with dock, toast, command palette, timeline, or tooltip behavior.
- Data/metric scene: choose `ui` or `editorial`, emphasizing the metric and denominator.
- Strong image or raw-footage scene: choose `minimal`, `edge-caption-rail`, or `dimmer-band`.
- Bilingual/interview scene: choose `bilingual` or `audio`, with speaker/translation metadata.
- Negative mentions must not trigger the named family by themselves. For example, `不是数据、产品或素材说明` should stay in the generic vertical/mobile path unless chart data, a product surface, or authorized footage is actually present.

## Motion Rules

Allowed subtitle motion:

- opacity fade, short y-rise, small scale <= `1.08`, mask/clip reveal, underline sweep, glass scan, marker wipe, token pulse, tooltip dock, progress fill.

Forbidden subtitle motion:

- flashing red loops, large bouncing, random per-character jitter, camera-shake on text, spinning words, new simultaneous line stacks, animation that lasts longer than the readable hold, and anything that hides the active cue.

All motion must include `prefers-reduced-motion` or equivalent reduced-motion fallback in the HTML/CSS renderer.

## Integration Contract

`workflow/caption-style-plan.json` must include:

- `catalogReference`: `assets/caption-style-catalog.json`.
- `strategyReference`: `references/creative-subtitle-strategy.md`.
- `styleCatalog`: the available catalog or a selected shortlist with `rendererClass`.
- `scenes[]`: `selectedStyleId`, `fallbackStyleId`, `reason`, `semanticCueTypes`, `emphasisPlan`, `motion`, `safeArea`, and `displayMode`.

`workflow/design-plan.json` pages must carry `captionStyle.layerClass` so render frames can apply the selected CSS class.

QC must fail if the plan is missing, if the selected style is not present in the catalog, if text is clipped, if motion changes TTS timing, or if a visual-only line becomes a separate audio cue.

Run `scripts/validate-caption-strategy-routing.mjs` after changing subtitle routing. It generates horizontal, vertical, and writing-method test briefs, then verifies state-to-style routing for hook, generic vertical, product, data, image-first, bilingual, voice, quote, documentary, and collision/negation cases.

## Sources

- W3C WebVTT: https://www.w3.org/TR/webvtt1/
- MDN `::cue`: https://developer.mozilla.org/en-US/docs/Web/CSS/::cue
- MDN CSS animations: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations/Using_CSS_animations
- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- TikTok Creative Best Practices: https://ads.tiktok.com/help/article/creative-best-practices
- Google Ads YouTube Shorts specs: https://support.google.com/google-ads/answer/16041697
