# GPT Image 2 Visual Series

Use this reference when a run wants high-quality generated images to serve as full-screen video pages (base frames) for scenes outside the personal-IP route: knowledge cards, guide boards, relationship maps, atlas cards, hooks, mood pages, interface plates, and consistency grids.

## Boundary With the Personal-IP Route

The personal-IP route is untouched. Its persona manifests, `plan-vertical-personal-ip-image.mjs`, `render-ip-diagram-native-pages.mjs`, and all personal-IP QC gates stay exactly as documented in `references/ip-diagram-creator-integration.md`. Personal-IP briefs keep routing there.

This reference generalizes the same design philosophy to non-persona visual series, so the Planner can choose "generated pages as the visible video frames" for more content types. Which series (if any) a video uses is a Planner decision recorded in the run's planning artifacts; this document and the catalog only guarantee the capability to produce excellent elements.

## Design Philosophy (borrowed from personal-IP)

1. **Native full-screen page**: each generated page is a full-screen, native-aspect base frame, never a cropped/letterboxed insert.
2. **Fixed style DNA + executable style spec**: every series locks a DNA description **and** an executable `styleSpec` (rendering medium, background, accent, icon/detail style, palette rule), injected verbatim into every page prompt of a run (the non-persona analogue of the fixed persona manifest). GPT Image 2 pages are generated independently with no cross-image memory, so a text-only mood description is not enough to hold a look across pages — the medium and palette must be pinned to concrete values.
3. **Series continuity**: one run shares one style lock (`workflow/image2-series-style-lock.json`); pages vary content, never the rendering medium or palette.
4. **Multi-page coverage**: one page owns one contiguous narration beat; a single all-purpose page is rejected by default (same growth rule as the personal-IP image-count plan).
5. **Provenance and QC**: every generated page records `source_generated_image` provenance in a manifest shaped like the personal-IP native-page manifest, so the existing native-page provenance audit can consume it without modification.

## Style Spec (the hard lock)

Each series carries a `styleSpec` object that is the executable half of the style lock. It is rendered as a "Style specification (hard lock)" block at the **top** of every page prompt, above positioning and topic, so the constraints land before the model improvises:

- `renderingMedium` — the single medium for all subjects and modules, with excluded mediums named explicitly (e.g. "one consistent soft editorial illustration; never photography, never watercolor, never cartoon line-art"). This is the field that stops a set from drifting photo → watercolor → cartoon across pages.
- `background` — a concrete background treatment and color (e.g. "warm off-white near #F6F1E7 on every page").
- `accent` — the single accent hue and its use; all other saturated colors forbidden unless a bounded exception is named.
- `iconAndDetailStyle` — repeated icon/panel/frame/stroke/corner treatment.
- `paletteRule` — the total color budget.

The style lock (and its `lockId` hash) incorporates the `styleSpec`, so editing a spec produces a new lock and a re-plan; reusing the same output directory reuses the spec verbatim. QC verifies the spec is present and that every page prompt embeds the exact `renderingMedium` string (`styleSpecPresent`, `promptsIncludeRenderingMediumLock`). The catalog validator requires all five fields on every series and requires `renderingMedium` to name its exclusions with "never …".

## Catalog

The machine-readable series library is `assets/gpt-image-2-visual-series-catalog.json`. Validate it with `scripts/validate-image2-series-catalog.mjs` after any edit.

| seriesId | Name | Best for | Default text policy |
| --- | --- | --- | --- |
| `knowledge-encyclopedia-card-v1` | 科普百科卡 | subject profiles, roundups, ratings, structured facts | text-safe |
| `strategy-guide-board-v1` | 步骤攻略板 | tutorials, ordered steps, priorities, checklists, pitfalls | text-safe |
| `relationship-map-poster-v1` | 关系图谱页 | character/faction/concept relationships, org structures | text-safe |
| `collection-atlas-card-v1` | 图鉴收藏卡 | per-specimen profiles (animals, plants, objects); museum/cute tones | text-safe |
| `editorial-cover-hook-v1` | 杂志封面式开场页 | opening hooks, chapter dividers, topic reveals | text-safe |
| `surreal-carrier-poster-v1` | 超现实创意载体页 | wonder hooks, concept metaphors, transitions, endings | text-safe |
| `oriental-ink-atmosphere-v1` | 新中式水墨氛围页 | culture topics, pacing breaths, calm endings | text-safe |
| `interface-mockup-plate-v1` | 界面示意板 | tool/SaaS/product walkthroughs without real screenshots | text-safe only |
| `photo-collage-grid-v1` | 一致性拼贴网格页 | recaps, progressions, multi-state comparisons | text-safe only |

Series status starts as `candidate`. A series may be promoted to `approved` (like `image2-explainer-board-v1`) only after a final self-test video passes QC with that series active.

## Method Sources and Rights Safety

Distilled method-only from:

- `https://github.com/hskaildm/gpt-image-2-curated-prompts` — four-part prompt skeleton (positioning statement, module checklist, visual requirements, negative exclusion), variable topic slots, integrated Chinese typography direction, cross-frame consistency wording.
- `https://github.com/peterRooo/awesome-gpt-image-2-prompts` — category taxonomy, structured record schema, quality grading, capability evidence (dense Chinese plates, labeled diagrams, consistent grids).
- Plus the existing YouMind method library (`references/gpt-image-2-prompt-library.md`) and the personal-IP philosophy (`references/ip-diagram-creator-integration.md`).

Both new repositories declare no license and transcribe community prompts. Treat them exactly like the YouMind boundary: borrow structure and method, never paste community prompts, creator styles, brands, IP, celebrity likeness, or real platform UI into prompts or deliverables. Source entries built on those elements were excluded during distillation, and the catalog validator scans for rights-unsafe tokens.

## Text Policy

- **text-safe (default)**: the bitmap owns zero readable text; blank plaques and abstract strokes mark label positions; deterministic HTML/SVG/CSS overlays own all exact Chinese text. This follows the existing imagery rules unchanged.
- **integrated-chinese (opt-in, per-series)**: the bitmap renders an exact per-page whitelist of short Chinese strings, following the two existing precedents — the Image2 integrated-typography cover and the personal-IP native pages with required readable Chinese text. Hard requirements:
  - only series with `integrated-chinese` in `supportedTextPolicies`;
  - every page prompt carries its exact whitelist and forbids all other readable text;
  - every whitelisted string passes a proofread gate (human review or OCR-assisted) before final use — the QC artifact records `integratedTextProofread.status`;
  - wrong, unreadable, or extra text ⇒ regenerate the page or downgrade it to text-safe with deterministic overlays.

Long body paragraphs stay deterministic in both policies; the whitelist is for short titles, module labels, tags, and badges.

## Producing a Page Set

```bash
node .agents/skills/codex-video-workflow/scripts/plan-image2-series-pages.mjs \
  --series knowledge-encyclopedia-card-v1 --out <dir> \
  --topic "水豚" --aspect 9:16 --text-policy integrated-chinese \
  --required-text "水豚图鉴;基础档案;习性;冷知识" \
  --content-file script/narration-spoken.txt
```

1. **Plan**: writes per-page prompts under `prompts/<seriesId>-pages/`, plus `workflow/image2-series-contract.json`, `image2-series-image-count-plan.json`, `image2-series-image-jobs.json`, `image2-series-style-lock.json`, `image2-series-qc.json`, and a provenance `workflow/manifest.json`.
2. **Generate**: produce one bitmap per page prompt with Codex built-in `image_gen` (default) or the explicit `--image-source image2` API route — same provider rules as `references/image-generation-routing.md`. Dryrun/prompt-only is a valid stopping point in semi-auto mode.
3. **Ingest**: re-run the script with `--source-images <p1.png;p2.png;...>` to copy, hash, and aspect-verify the bitmaps and finalize provenance.
4. **Proofread** (integrated-chinese only): review every whitelisted string; record the result before the pages may enter a video.

The style lock is created once per output directory and reused on re-runs (create-once-reuse, mirroring persona-manifest reuse). Regenerating a single failed page must reuse the same lock so the set stays coherent.

## Planner Decision Rules

- Main workflow writes `workflow/visual-series-routing-plan.json` for every run and mirrors each scene decision into `visualAssetDecision.visualSeries`. The artifact must retain matched signals, rejected candidates, text policy, series status, generation status, and the precedence winner.
- Route precedence is strict: explicit non-negated personal-IP intent wins first; then authorized real screenshots/data/user-owned source material; then an explicit valid `visualSeriesId`; then content-shape scoring; finally the existing explainer-board/deterministic fallback. `personalIp: false`, `"off"`, `{ "enabled": false }`, `不要个人 IP`, and `do not use personal IP` are opt-outs, not activation signals.
- Scene/content mapping is: subject profile/roundup/rating/science structure → `knowledge-encyclopedia-card-v1`; tutorial/steps/checklist/pitfalls → `strategy-guide-board-v1`; character/faction/concept edges → `relationship-map-poster-v1`; item-by-item specimens → `collection-atlas-card-v1`; opening hook/divider/reveal → `editorial-cover-hook-v1`; wonder/metaphor/transition → `surreal-carrier-poster-v1`; culture/breath/calm ending → `oriental-ink-atmosphere-v1`; tool/SaaS/product UI without authorized screenshots → `interface-mockup-plate-v1`; same-subject recap/progression/multi-state comparison → `photo-collage-grid-v1`.
- Candidate series are `recommend-only`: they may prepare a page-generation route but must not silently auto-enter final composition. Only an approved series that satisfies the catalog threshold may set `autoActivated: true`; explicit draft selection remains non-final until its provenance/QC gates pass.
- Match series to scene role using `appliesTo`/`plannerGuidance` in the catalog. Do not mix multiple series inside one video without an explicit design reason recorded in the aesthetic brief; one video normally locks one series plus deterministic HTML/SVG scenes.
- Mechanism/teaching scenes keep evaluating the approved `image2-explainer-board-v1` route first; personal-IP briefs keep the personal-IP route. Series pages are for the remaining scene types or full "图鉴流"-style videos where generated pages carry the whole visual line.
- Deterministic layers still own subtitles, numeric claims, source notes, and anything outside the whitelist. The lower 18% subtitle-safe band must stay clean in every page.

## QC Expectations

`workflow/image2-series-qc.json` must pass, including: catalog registration, native canvas plan, style-lock injection into every prompt, image-count plan compliance, text-policy compliance, subtitle-safe-band declaration, and (on ingest) aspect verification. Integrated-chinese sets additionally carry `integratedTextProofread` with a final reviewed status. Pages without a passing QC artifact and provenance manifest must not enter final composition.
