# Quality Gates

## Required Files

- `brief.json`
- `script/narration.txt`
- `script/narration-spoken.txt`
- `script/storyboard.md`
- `script/subtitles.srt`
- `workflow/commands.json`
- `workflow/tool-candidate-selection.json`
- `workflow/voice-direction.json`
- `workflow/voice-subtitle-manifest.json`
- `workflow/sync-timecode-plan.json`
- `workflow/cover-design.json`
- `workflow/content-presentation-design.json`
- `workflow/aesthetic-brief.json`
- `workflow/aesthetic-quality-rubric.md`
- `workflow/motion-template-selection.json`
- `workflow/design-plan.json`
- `workflow/image2-prompts.json`
- `workflow/visual-asset-manifest.json`
- `workflow/quality-scorecard.md`
- `AUTHORIZATION.md`
- `renders/final.mp4`
- `logs/ffprobe.json`
- `logs/blackdetect.log`
- `logs/volumedetect.log`
- `logs/qc.json`
- At least three `screenshots/*.png` for opening, middle, and ending review points.
- At least one `cover/*` image for the requested target platform; cross-platform packages must include platform-specific standalone variants. Default cross-platform output should include YouTube `16:9`, Bilibili `4:3`, Bilibili horizontal-safe `16:9`, Douyin/TikTok `9:16`, X video-match, and X square/feed variants.

## Media Checks

Pass criteria for the local video workflow:

- Duration: matches the generated plan derived from the actual narration/content length, unless the user explicitly requested a fixed duration.
- Resolution: 1920x1080 for this horizontal video workflow.
- FPS: 30 preferred.
- Video codec: H.264 or a locally playable MP4 codec.
- Audio: present, AAC or compatible MP4 audio.
- Audio/video sync: stream durations should be effectively equal after muxing, normally within one frame plus encoder tolerance; the QC log must report the audio/video duration delta.
- Final audio loudness: `volumedetect` must show audible口播 volume, with mean volume not below `-36 dB` and max volume not below `-18 dB`; prefer a normal spoken-video range around `-30 dB` to `-18 dB` mean volume.
- Voice backend: Chinese videos must use `cosyvoice_local` or `melotts_local` unless `--allow-say-fallback` was explicitly used and reported as degraded.
- MeloTTS parameters: Chinese runs must use language `ZH`, CPU device by default, and a recorded speed value, normally around `0.95`.
- Voice direction: `workflow/voice-direction.json` exists and names speech style, pace, tone, pause policy, and sentence completeness rules.
- Punctuation pause policy: `workflow/voice-direction.json` records `pauseDurations.commaLikeSeconds` as `0.5` and `pauseDurations.sentenceEnd` as `tts-default`; `script/narration-spoken.txt` must not add a newline immediately after comma-like punctuation (`，`, `,`, `、`).
- Audio dynamics: final narration should use compression, dynamic normalization, limiting, or loudness normalization when volume varies noticeably; the manifest must record the filter chain when used.
- Spoken narration: `script/narration-spoken.txt` exists and uses sentence-end or semantic-beat line breaks for TTS pauses when口语化/conversational is requested.
- Sync timecode: `workflow/sync-timecode-plan.json` exists and defines the shared timing source for narration, subtitles, main visual scenes, progress indicators, and opening/cover continuity. Long口播 should use ASR/forced-alignment evidence when available.
- Content presentation design: `workflow/content-presentation-design.json` exists and defines topic type, audience state, content jobs, hierarchy, display logic, visual metaphor, layout system, motion purpose, aesthetic bar, and reject list.
- Cover design: `workflow/cover-design.json` exists and states research synthesis, platform targets, viewer decision, cover promise, curiosity gap, hook text, payoff text when used, visual subject, emotional signal, composition, typography, contrast, small-preview test, platform variants, content truth, and reject list.
- Aesthetic brief: names visual territory, taste goal, avoid list, composition/color/type/imagery/motion rules, and skill/capability routing.
- Motion template selection: `workflow/motion-template-selection.json` exists and names selected template, source platform logic, motion jobs, semantic binding, implementation path, fallback policy, verification, and reject list.
- Visual planner: design plan exists and names video type, template kit, per-scene shot template, image role, and motion language.
- Image assets: each scene has an inserted original illustration/image asset and an image2-compatible prompt, even when the run uses local fallback.
- Captions: `.srt` file exists and readable safe-area captions are visible in frames; scene-summary text alone does not count as subtitles for a long口播 video.
- Semantic visual sync: main scene titles, diagrams, and progress indicators must advance according to the same timecode plan as the subtitles. Equal-duration visual scenes are a failure for uneven long narration unless the narration was deliberately produced to match them.
- Cover files: cover images are present, readable at mobile-preview size, match target aspect ratios, and accurately represent the video's promise.
- Video-internal cover: `workflow/cover-design.json.videoInternalCover` exists and its ratio matches the final MP4 canvas; standalone platform covers must not be substituted into the video when their ratio differs.
- Cover click logic: cover image is not merely a title card. It must show a platform-ready click reason through contradiction, curiosity gap, transformation, evidence/reveal, or emotional metaphor.
- Cover intro or platform cover: the final video package must either start with a designed cover/thumbnail frame or explicitly mark the cover as an upload-only platform asset. If the user asks for a beginning cover, it must be visible in the first seconds of the MP4.
- No internal evidence labels: final viewer-facing frames must not show workflow/QC/debug labels such as `sync-timecode`, `同源时间轴`, caption indices, file paths, renderer names, or other implementation evidence. Keep those in logs and manifests.
- Black frames: `blackdetect` has no meaningful black segment.
- Screenshots: opening, middle, and ending frames are nonempty.
- Motion: final videos must include scene-level animation or camera/element movement consistent with the design plan; static card-only output is a failure unless the user explicitly requested slides.
- HTML motion templates: when rendering HTML-driven visuals, use `templates/html-motion/motion-template-registry.json` or a documented custom template, and record the choice in `workflow/motion-template-selection.json`.
- Motion validation: reusable HTML motion templates must pass `scripts/validate-html-motion-templates.mjs` after template edits, or the final package must include equivalent screenshot/motion-difference evidence under `logs/`.

## Rights Checks

The authorization record must state:

- Text/script source.
- Visual source.
- Image2 mode: `local`, `image2-dryrun`, or explicit `image2`, plus failure/fallback record when applicable.
- Voice source and backend.
- Voice direction and speech style.
- CosyVoice/MeloTTS manifest path and failure list when a fallback backend was tried.
- Music source.
- Font source.
- External media usage, if any.
- Manual review requirement for commercial/platform release.

Fail closed if any asset has unclear rights.

## Review Scorecard

Score each item as `PASS`, `WARN`, or `FAIL`:

- Reproducibility.
- Rights safety.
- Script originality.
- Aesthetic direction.
- Content presentation design.
- Visual design plan.
- Inserted visuals.
- Visual readability.
- Audio/subtitle alignment.
- Audio/video semantic sync.
- Cover/thumbnail strategy.
- Voice direction.
- Voice backend compliance.
- Render stability.
- Platform readiness.

Platform readiness should remain `WARN` unless a human has checked platform policy, AI labeling, licensing, and editorial suitability.

## Hard Failures

- Missing MP4, missing audio, duration outside requested range, or blackdetect hits.
- Audio that exists but is nearly silent.
- Audio with obvious uncontrolled loudness swings when local dynamic processing is available.
- Audio/video stream duration drift beyond tolerance, or visible main-scene timing that is not driven by the narration/subtitle timecode plan.
- Missing or invisible subtitles for long口播.
- Comma-like punctuation becomes a long pause, a sentence-level pause, or a line-break pause; explicit comma pauses above `0.5s` fail.
- Missing cover design artifact or final cover image for a final-quality run.
- Cover text unreadable at mobile-preview size, wrong target ratio, misleading promise, or title-card-only design with no click reason.
- User-requested opening cover missing from the MP4.
- Internal workflow/QC/debug labels visible in the final video.
- Missing design plan, missing image2 prompts, missing visual asset manifest, or scenes without inserted visuals.
- Missing motion template selection, or selected motion template not reflected in the render.
- Missing motion verification evidence when HTML motion templates are used or changed.
- Renderer fallback that drops the planned UI design, inserted visual assets, or motion language, unless the user explicitly requested a static/slides output.
