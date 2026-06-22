# Integration Roadmap

## Decision

Use `html-video` as an optional renderer/template gallery inside the current workflow, not as a wholesale replacement.

## Why

- The current `video-maker` workflow already handles brief normalization, staged evidence, voice/subtitle manifests, render commands, QC, screenshots, and packaging.
- `html-video` adds a useful content-graph and per-frame HTML rendering path for richer motion-card visuals.
- The researched clone needed a workspace workaround because `packages/studio-next` depended on unavailable `@hyperframes/*` packages in this environment.

## Minimal Integration

1. Keep `.agents/skills/video-maker/scripts/video-workflow.mjs` as the default orchestration backbone.
2. Add a renderer adapter that accepts:
   - `brief.json`
   - `workflow/video-design.json`
   - `workflow/visual-planner.json`
   - `script/subtitles.srt`
   - local audio assets
3. Emit:
   - `html-video` content graph
   - per-frame HTML files
   - MP4 render
   - logs and manifest compatible with existing QC.
4. Fall back to HyperFrames/FFmpeg automatically when `html-video` is unavailable or fails twice.

## Future Work

- Stabilize an adapter boundary instead of importing `html-video` internals directly.
- Add vertical 9:16 templates for Shorts/TikTok/X.
- Add thumbnail/cover generation from the first frame.
- Add optional VMAF when a reference video exists.
- Add explicit AI-labeling checklist per platform before upload workflows.
