# Failure Cases

## html-video Workspace Install

Observed during local research:

- Full `pnpm install` initially failed because `packages/studio-next` resolved `@hyperframes/studio` -> `@hyperframes/sdk`, which was unavailable in this environment.
- Workaround for research clone: exclude `packages/studio-next` from `pnpm-workspace.yaml`, then run `pnpm install` and `pnpm -r build`.
- Verified after workaround: CLI/runtime build, `doctor`, `list-engines`, template search, and a sample MP4 render.

Decision: do not make `html-video` a hard dependency for the whole workflow until this package boundary is stable.

## Renderer Failure

If `html-video` import/render fails:

1. Log the failure under `logs/render-attempts.log`.
2. Retry only once if the error is transient.
3. Fall back to current `video-maker` HyperFrames/FFmpeg path.
4. Preserve the same brief, storyboard, authorization, subtitles, and QC evidence.
5. Preserve the same visual design plan, UI safe zones, inserted visual assets, and motion language. Do not fall back to a static text-card render unless the user explicitly requested slides or a static mock.

## Voice Failure

Default voice policy is fail-closed:

1. Try `cosyvoice_local`.
2. Try `melotts_local`.
3. If both fail, stop the run and preserve `logs/voice-cosyvoice_local.log`, `logs/voice-melotts_local.log`, and `workflow/commands.json`.

Use macOS `say` only when the caller explicitly passes `--allow-say-fallback`. In that case the scorecard and manifest must mark the voice as degraded fallback, not a final-quality Chinese narration path.

If audio is generated but final `volumedetect` shows mean volume below `-36 dB` or max volume below `-18 dB`, treat it as a voice failure, increase/repair the narration mix, and rerun QC before delivery.

## Sync Failure

Container-level stream duration equality is not enough. A video can have matching audio/video stream durations while still feeling wrong if the visible scene titles, diagrams, captions, or progress indicators advance on a different timing model than the narration.

Failure pattern:

1. Generate narration from the full script.
2. Allocate visual scenes by equal duration or by a separate storyboard estimate.
3. Allocate captions by character count.
4. Mux all streams successfully.
5. Viewers still feel the picture is ahead of or behind the voice because the main visual semantics are not driven by the spoken timeline.

Repair:

1. Build `workflow/sync-timecode-plan.json` after narration exists.
2. Prefer ASR or forced alignment for long口播; map the original script/subtitle chunks back to actual speech segments.
3. Drive main scene changes, subtitles, progress indicators, and cover-derived opening visuals from that same plan.
4. Log audio/video stream duration delta in `logs/qc.json`.
5. Review screenshots or frame samples at opening/middle/end against the current spoken section.

## Subtitle Wrapping Failure

Failure pattern:

1. Split TTS by visual subtitle line length instead of sentence or semantic-beat boundaries.
2. A word, quote, or sentence is cut into separate audio files, so playback sounds clipped even if the text is present.
3. Burned-in subtitles render all wrapped lines at once, creating stacked text in the safe area.

Repair:

1. Keep `script/subtitle-cue-narration-segments.json` as the audio cue source, with each cue preserving a complete sentence or complete semantic beat.
2. Put visual wrapping into `captionText` only; do not insert visual newlines into spoken TTS text.
3. Expand wrapped `captionText` into sequential one-line visual subtitle cues for SRT and burned-in captions.
4. Require `visualSubtitleSingleLine` in both `logs/qc.json` and `workflow/quality-consistency-contract.json`.
5. Run `scripts/validate-subtitle-cover-contract.mjs --out <output-dir> --brief <brief.json>` before delivery.

## Image2 Failure

Default `image2-dryrun` does not call the API. It records GPT Image 2 compatible prompts and inserts local SVG assets.

When `--image-source image2` is requested:

1. Require `OPENAI_API_KEY`.
2. Write requested prompts to `workflow/image2-prompts.json`.
3. Save generated images under `assets/image2/`.
4. If generation fails, stop by default and preserve the error in the terminal/logs.
5. Continue with local SVG fallback only when `ALLOW_IMAGE2_FALLBACK=1` is set, and record the failure in `workflow/visual-asset-manifest.json`.

## QC Failure

- Missing MP4, missing audio, duration outside requested range, or blackdetect hits are hard failures.
- Missing `workflow/sync-timecode-plan.json`, semantic timing drift, or fixed-duration main scenes over uneven long narration are hard failures.
- Failing subtitle/cover contract validation is a hard failure for final-quality packages with narration, subtitles, and covers.
- Missing `workflow/cover-design.json` or final cover images for final-quality delivery is a hard failure.
- Missing design plan, missing image2 prompts, missing visual asset manifest, or scenes without inserted visuals are hard failures.
- Platform readiness remains a warning until a human reviews licensing, AI labeling, upload policy, and editorial suitability.
