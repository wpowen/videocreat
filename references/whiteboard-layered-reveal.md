# Whiteboard Layered Reveal

Use this reference when a scene should feel hand-drawn while still preserving the current `codex-video-workflow` render stack, background design, subtitle timing, and exact component text.

The rule is narrow: the whiteboard engine may draw a keyed or alpha foreground sketch layer. It must not replace the framework renderer, redraw the entire video background, own subtitles, or stroke-trace small exact text as the final readable layer.

For `ip-diagram-creator` native-final pages, the same rule is stricter: the generated page is the fixed full-screen base layer. Whiteboard or hand-drawn animation may add foreground strokes, progress marks, circles, arrows, or reveal accents only. It must never move, crop, scale, bounce, redraw, or wrap the generated page.

## When To Activate

Activate only when a hand-drawn reveal improves comprehension, attention, or retention for a specific scene or scene group:

- workflow, process, pipeline, diagram, mechanism, tutorial, lesson, system-map, or comparison scenes;
- user explicitly asks for whiteboard, hand-drawn, marker, board, sketch, or drawing-style reveal;
- the current scene already has floating cards, components, icons, charts, or image groups that can be revealed semantically;
- the effect helps explain structure, not merely decorate a normal scene.

Do not activate it for every video. Record the decision in `workflow/external-capability-fusion-plan.json`, including rejected scenes where normal HTML motion is clearer.

## Layer Contract

Final render order must stay:

1. `background-base`: the current video framework background, theme, depth, lighting, and non-white stage.
2. `whiteboard-sketch`: keyed/alpha hand, marker, ink, outline, arrow, connector, or rough shape reveal for semantic foreground groups only.
3. `foreground-components`: exact framework-owned cards, images, icons, charts, labels, and colored component states.
4. `subtitles-overlays`: subtitles, caption effects, safe-area guards, logos, delivery overlays, and any timing-critical text.

Subtitles are always topmost. The whiteboard pass must never cover, mask, move, recolor, restyle, delay, or retime subtitle/caption layers.

When the base is a native IP diagram page, the layer order becomes `background-native-ip-diagram-page` -> `whiteboard-sketch/accent` -> `subtitles-overlays`. The generated page remains full-screen with a fixed transform for the whole page window.

## Planner Contract

For every active run, write `workflow/whiteboard-layered-reveal-plan.json` with:

- `active`: true or false;
- `trigger`: user request or planner scene reason;
- `sceneIds`: scenes using the effect;
- `backgroundPolicy`: `reuse-framework-background`;
- `drawPolicy`: `semantic-foreground-groups-only`;
- `subtitlePolicy`: `topmost-framework-owned`;
- `colorPolicy`: how colored foreground is restored after sketch reveal;
- `externalEngine`: engine/tool used for hand or stroke output;
- `layerOrder`: the four layers above;
- `rejectedScenes`: scenes where whiteboard reveal was considered and rejected;
- `requiredEvidence`: local paths for line art, source foreground, composited render, screenshots, and QC logs.

Also update `workflow/external-capability-fusion-plan.json` with a capability entry such as:

```json
{
  "id": "whiteboard-layered-reveal",
  "borrowedFrom": ["codex-whiteboard-video-skill", "whiteboard-video-engine"],
  "active": true,
  "trigger": "scene needs hand-drawn reveal over existing framework background",
  "whatWeBorrow": ["hand/stroke reveal", "draw-order pacing", "rough marker texture"],
  "frameworkOwner": "codex-video-workflow",
  "requiredEvidence": [
    "workflow/whiteboard-layered-reveal-plan.json",
    "workflow/layered-composite-render.json",
    "assets/whiteboard-floating-elements-lineart.*",
    "screenshots/*.png",
    "logs/qc.json"
  ]
}
```

## Asset Contract

When active, the package should include equivalent artifacts:

- `assets/whiteboard-background-layer.*`: framework background snapshot or rendered base plate;
- `assets/whiteboard-floating-elements-source.*`: exact foreground component/source plate with final color and text;
- `assets/whiteboard-floating-elements-lineart.*`: simplified foreground groups for stroke reveal;
- `renders/whiteboard-sketch-layer.*`: whiteboard/hand/stroke output, preferably transparent or keyable;
- `workflow/whiteboard-layered-reveal-plan.json`;
- `workflow/layered-composite-render.json` or an equivalent render graph;
- `screenshots/whiteboard-layer-proof-*.png` showing mid-animation and subtitle-safe frames;
- `logs/ffprobe.json`, `logs/blackdetect.log`, and `logs/qc.json`.

Use the framework source layer for exact small text, dense labels, numbers, and claims. Use the whiteboard layer for outlines, arrows, emphasis strokes, circles, checkmarks, underlines, connectors, and reveal pacing.

## Color And Visual Richness

Whiteboard output is allowed to be colorful, but color richness should normally come from the framework-owned foreground components after the sketch reveal. Acceptable treatments:

- monochrome or lightly colored sketch pass followed by colored component reveal;
- marker accent colors for arrows, underlines, ticks, and semantic groups;
- rough line textures, pressure variation, and draw-order pacing;
- topic-specific icon/card/image groups rendered by the main framework, then revealed by the sketch pass.

Avoid one-note white canvas scenes unless the brief explicitly asks for a whiteboard-only style. The default is hand-drawn motion over the current designed background.

## QC Gates

Fail or revise the run when:

- subtitles are sent through the whiteboard engine or appear below any hand/ink/component layer;
- the final video uses a plain white board because the base framework background was skipped;
- the whiteboard engine redraws the entire background instead of only semantic foreground groups;
- a native IP diagram page is moved, cropped, scaled, bounced, bordered, shadowed, or wrapped by the whiteboard pass;
- final readable text exists only as stroke-traced line art;
- colored foreground never resolves after the sketch pass;
- mid or final screenshots show double text, double borders, ghost outlines, clipped cards, or unreadable labels;
- hand/ink motion overlaps subtitles, safe-area captions, logos, or timing-critical overlays;
- `workflow/whiteboard-layered-reveal-plan.json` or `workflow/external-capability-fusion-plan.json` is missing.

## Proven Local POC

The validated local proof of concept is:

- `research/whiteboard-layered-subtitle-top-demo-20260701/whiteboard-layered-subtitle-top-demo.mp4`
- `research/whiteboard-layered-subtitle-top-demo-20260701/workflow/layering-strategy.json`
- `research/whiteboard-layered-subtitle-top-demo-20260701/workflow/external-capability-fusion-plan.json`
- `research/whiteboard-layered-subtitle-top-demo-20260701/workflow/layered-composite-render.json`
- `research/whiteboard-layered-subtitle-top-demo-20260701/logs/qc.json`

That POC proves the intended order: current framework background stays visible, the whiteboard engine draws only floating elements, colored components resolve above the sketch, and subtitles remain topmost.
