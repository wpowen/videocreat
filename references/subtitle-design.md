# Subtitle Design

Use this reference when improving subtitle appearance, caption motion, or platform-specific caption treatment.

## Research Anchors

- TikTok for Business creative guidance recommends vertical `9:16`, keeping content visible inside the UI safe zone, prioritizing the first seconds, using captions or text overlays for context, and keeping text density readable at roughly `5-10` words per second.
- Google Ads / YouTube Shorts guidance emphasizes vertical assets for Shorts and notes that mobile overlays can occupy the viewing surface, so important text must remain concise and safe-zone aware.
- W3C WebVTT defines subtitle/caption cues as time-aligned text resources and explicitly supports styling cues with CSS. It also notes that authors are generally encouraged to keep cues on one line unless a line break is necessary.
- Existing workflow rules already require one-line sequential visual subtitles, per-cue TTS timing, caption-safe motion, and deterministic HTML/CSS text ownership.

## Subtitle Design Contract

Every final-quality run should write `workflow/caption-style-plan.json` before rendering. It must include:

- `globalContract.safeArea`: the stable subtitle safe area, normally `bottom-caption-band`.
- `globalContract.displayMode`: `single-line-sequential`.
- `globalContract.timingOwner`: actual per-cue TTS timings from `workflow/voice-subtitle-manifest.json`.
- `catalogReference`: `assets/caption-style-catalog.json`.
- `strategyReference`: `references/creative-subtitle-strategy.md`.
- `styleCatalog`: reusable caption treatments selected from the catalog, including glass, editorial, kinetic, UI/HUD, bilingual, mobile, minimal, and audio families.
- `scenes`: one caption style record per scene, with `sceneId`, `selectedStyleId`, `fallbackStyleId`, `layerClass`, semantic cue types, emphasis plan, geometry, typography, contrast, motion, and safe-area rules.
- `rejectList`: failures that make the subtitle feel cheap or unsafe.

## Design Rules

- Keep subtitles as a first-class visual layer, not a default black rectangle dropped on top of the frame.
- Style must adapt to platform and content type: vertical short-form needs a higher mobile-safe pill; product/tool scenes can use a glass-console treatment; story/documentary scenes can use an editorial lower-third; hook scenes can use a kinetic punch band.
- Styling must not create new TTS cuts, change cue timing, or turn visual line breaks into audio segmentation.
- Use one visible subtitle line at a time. If an audio cue has multiple visual lines, show them sequentially as separate visual cues, not stacked together.
- Preserve high contrast on every frame. Depth, blur, borders, and accent rails are allowed only when they make text easier to read.
- Motion should be limited to opacity, small vertical movement, scan/glass accents, or short punch emphasis. It must settle during the active cue and never obscure the words.
- Exact Chinese captions belong in deterministic HTML/CSS/SVG layers, never baked into generated scene images.
- Keyword emphasis is allowed only as visual metadata such as `emphasisTokens`, `semanticCueType`, `motionVerb`, `speakerLabel`, or `secondaryText`. It may bold, tint, underline, chip, marker-highlight, or briefly scale important words, but it must not split or rewrite the spoken cue.
- The Planner should choose a concrete style from `assets/caption-style-catalog.json` and follow `references/creative-subtitle-strategy.md` when the brief asks for aesthetic subtitles, animation, UI-like caption treatment, or keyword emphasis.

## QC Requirements

Final packages should fail QC unless:

- `workflow/caption-style-plan.json` exists and has `status: active-premium-caption-style-plan`.
- `logs/qc.json` passes `captionStylePlanPresent` and `captionStylePlanEnforced`.
- `workflow/quality-consistency-contract.json` lists `captionStylePlanPresent` and `captionStylePlanEnforced` as hard gates.
- Every scene contract carries a caption style binding with `safeArea: bottom-caption-band` and `displayMode: single-line-sequential`.
- Every selected caption style is present in `assets/caption-style-catalog.json` and has a deterministic `rendererClass`.
- The rendered HTML frame includes the selected caption style class and passes the frame layout overlap audit.
- Subtitle routing changes pass `scripts/validate-caption-strategy-routing.mjs`, including vertical/product/data/image-first/quote/writing-hook collision cases and negative mentions such as `不是数据、产品或素材说明`.

## Sources

- TikTok for Business, Creative best practices for performance ads: `https://ads.tiktok.com/help/article/creative-best-practices`
- Google Ads Help, YouTube Shorts ads asset specs and best practices: `https://support.google.com/google-ads/answer/16041697`
- W3C, WebVTT: The Web Video Text Tracks Format: `https://www.w3.org/TR/webvtt1/`
- MDN, `prefers-reduced-motion`: `https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion`
