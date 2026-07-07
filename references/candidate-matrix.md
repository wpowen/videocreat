# Candidate Matrix

This matrix reflects the June 2026 audit of the local `videocreat` workspace plus current public documentation. Treat vendor availability and pricing as time-sensitive.

| Area | Recommended default | Fallback | Do not default | Reason |
| --- | --- | --- | --- | --- |
| Workflow orchestration | Existing `video-workflow.mjs` stages plus this skill's contract | Manual staged files under `workflow/` | One-shot prompt-to-MP4 without evidence | Current repo already preserves brief, sources, article, storyboard, manifests, commands, QC, and package proof. |
| Agentic stage gates | OpenMontage-style gate vocabulary expressed as `workflow/production-plan.json` plus `workflow/external-capability-fusion-plan.json` | Manual reviewer checklist | Replacing the local workflow with OpenMontage wholesale | We want its staged production discipline, not another orchestration owner. |
| Visual renderer | `html-video` content graph + per-frame HTML for templateable motion cards | Existing `video-maker.mjs --renderer hyperframes` or `--renderer ffmpeg` | Replacing all current workflow logic with `html-video` | `html-video` is useful for HTML-rendered visuals, but current workflow owns rights, voice, package, and QC evidence. |
| Programmatic React video | Remotion-style typed props and variant planning for reusable/batch scene templates | Current HyperFrames/html-video project | Migrating renderer to Remotion before a separate migration plan | Remotion is strong for parameterized videos; the immediately useful part is props discipline and batch render contracts. |
| Raw video generation | None by default | User-provided authorized clips or local generated placeholders | Veo/Runway/Sora as default | Veo/Runway require API/account/paid usage; Sora API is deprecated; generated video also needs rights and labeling review. |
| Raw footage editing | Video-Use-style raw-footage inventory, edit decision list, cut-boundary review, and normalization plan | Manual clip manifest plus FFmpeg trims | Ingesting platform downloads or unclear-license clips | The useful pattern is agent-friendly clip organization and evidence-backed edits, only for authorized footage. |
| Shot planning | Original storyboard generated from brief/material | Platform abstract best-practice checklist | Copying creator shot sequences | Creator/platform research may inform hook, retention, caption density, and pacing, not expressive copying. |
| Images/assets | Type-specific design plan + image2-compatible prompts + original local SVG inserted assets | Explicit `--image-source image2` GPT Image 2 generation with `OPENAI_API_KEY`, or user-provided licensed assets with manifest | Commercial stock, unclear-license media, copied thumbnails, or unplanned decorative placeholders | Default sample must be reproducible and rights-safe without accounts, but the workflow should be ready to generate richer images when explicitly enabled. |
| Voice | Local `cosyvoice_local -> melotts_local` by default, with selected backend written to `workflow/voice-subtitle-manifest.json` | Explicit `--allow-say-fallback` only for degraded smoke evidence | Voice cloning, reference audio, real-person imitation, paid TTS, or silent substitution by default | Keeps generation local, high-quality, and reviewable while avoiding likeness/private-upload risk. |
| Subtitles | Generated `.srt` plus burned-in safe-area text | Sidecar captions only | No captions | Platform guidance emphasizes captions and text overlays for short-form clarity. |
| Music | Generated sine/pad bed with low volume | Silence | Commercial music or platform-library music | Local generated tone avoids licensing ambiguity. |
| Editing/transitions | HTML/CSS motion, frame timing, safe-area captions | FFmpeg concat/card cuts | Heavy template pack with unknown license | Keeps render deterministic and reviewable. |
| Media diagnostics/recovery | FFmpeg-style `ffprobe`, `volumedetect`, `silencedetect`, `blackdetect`, screenshots, and conservative re-encode recipes | Manual playback notes | Claiming success from render exit code alone | FFmpeg remains the best low-level proof surface for stream, loudness, silence, black frame, and mux issues. |
| Color/typography | System fonts and original palettes | Plain high-contrast cards | Downloaded fonts without license | Avoids font licensing drift. |
| Cover/thumbnail | `image2-integrated-typography-cover`: Image 2/Codex owns the finished thumbnail art plus integrated title/subtitle/badge typography, per `references/cover-design.md` | Local SVG/HTML only for export sizing and text-repair when no bitmap exists; review-grade drafts go under `最终成品/评审级封面-非上传终版/` | Decorative title-card SVG as the default cover, first-frame still, external/copied thumbnails, or hard-cropped ratio fits | Cover must read as a professional thumbnail tied to the video's click promise, not a title card or MP4 still. |
| QC | ffprobe, blackdetect, screenshots, duration/resolution/codec/audio checks, rights manifest | Manual playback note with file hashes | Claiming completion from render exit code only | Evidence must prove the media file exists and is inspectable. |
| Reference-video alignment | Sample reference frames, candidate frames, side-by-side contact sheets, timestamped mismatch report | Style-level reference notes only | Pixel-level fidelity claims without metrics | Alignment can improve dynamic/design matching, but fidelity levels must be labeled and proven. |

## Recommended Chain

Brief/material -> local/source research -> original script -> storyboard/timing -> type-specific design plan -> image2 prompts/local inserted visuals -> `html-video` per-frame HTML renderer -> local CosyVoice/MeloTTS narration -> local generated music -> MP4 export -> ffprobe/blackdetect/screenshots -> evidence package.

Use this when `research/html-video-research/html-video/packages/cli/dist/index.js` exists and can render without external accounts.

## Fallback Chain

Brief/material -> existing `.agents/skills/video-maker/scripts/video-workflow.mjs` with `--voice-backend cosyvoice_local` or `--voice-backend melotts_local` -> HyperFrames or FFmpeg renderer -> local TTS/music -> package/QC.

Use this when `html-video` is absent, its package graph is broken, Chromium/rendering fails, or the task needs current project compatibility more than template exploration.

## Unusable Or Non-Default

- OpenAI Sora Videos API: deprecated and scheduled for shutdown on September 24, 2026.
- Runway/Veo: useful paid/API candidates, but not default without explicit account, budget, and policy permission.
- Commercial stock/music/fonts: not default unless the user supplies clear license proof.
- Voice cloning/reference voice: blocked unless the user supplies explicit authorization and the task is lawful and policy-safe.
- macOS `say`: not a default Chinese narration route for this skill; only permitted with explicit degraded fallback.
