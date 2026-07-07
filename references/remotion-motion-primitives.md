# Remotion Motion Primitives

Use this reference when borrowing motion craft from the Remotion plugin without migrating the current renderer. The current production path remains `html-video`; Remotion contributes frame-driven animation discipline, reusable component props, easing vocabulary, transition accounting, and deterministic text animation rules.

## Borrowed Rules

- Drive visual state from render frame or scene-local progress, not wall-clock timers, random state, or free-running loops.
- Author timing in seconds, then convert to frames at render fps when a Remotion port is needed.
- Use explicit interpolate-style progress ranges with named easing curves such as `cubic-bezier(0.16, 1, 0.3, 1)` for crisp entrances and `cubic-bezier(0.45, 0, 0.55, 1)` for editorial holds.
- Treat transitions as timecode-affecting unless they are overlay-only. If a transition overlaps scenes, record its frame duration in `workflow/sync-timecode-plan.json` before render.
- Typewriter effects reveal deterministic string slices. Do not use per-character random opacity or effects that can make exact Chinese text unstable.

## Artifact Contract

Every final-quality HTML-motion run should include `remotionMotionPrimitives` inside `workflow/motion-template-selection.json`:

```json
{
  "remotionMotionPrimitives": {
    "schemaVersion": 1,
    "sourcePlugin": "remotion",
    "frameDrivenTimeline": {
      "owner": "workflow/sync-timecode-plan.json",
      "fpsAssumption": 30,
      "rule": "Every visual state change is reproducible from scene start/end time and render frame."
    },
    "triggerPolicy": {
      "baseline": "Every scene gets deterministic frame/easing discipline.",
      "enhancedMotion": "Enhanced trigger points are used for hooks, process steps, data reveals, evidence relationships, pressure beats, comparisons, traces, or transformations."
    },
    "sceneTriggerMap": [
      {
        "sceneId": "scene-01",
        "activationMode": "scene-enhanced-motion",
        "triggerSignals": ["first-scene-hook", "evidence-or-relationship-inspection"],
        "intensity": "medium-editorial",
        "triggerPoints": [
          { "point": "scene-start", "progress": 0 },
          { "point": "primary-reveal", "progress": 0.35 },
          { "point": "emphasis-or-inspection", "progress": 0.7 },
          { "point": "settle-for-transition", "progress": 1 }
        ]
      }
    ],
    "scenes": [
      {
        "sceneId": "scene-01",
        "motionVerb": "reveal",
        "triggerProfile": {
          "activationMode": "scene-enhanced-motion",
          "triggerSignals": ["first-scene-hook"],
          "sceneFit": "Scene has a semantic reveal that benefits from explicit frame-driven motion.",
          "intensity": "medium-editorial"
        },
        "frameClock": "derive progress from render frame or scene-local currentTime",
        "easing": "cubic-bezier(0.16, 1, 0.3, 1)",
        "transitionDiscipline": "record overlapped transition frames in sync-timecode-plan"
      }
    ]
  }
}
```

`workflow/motion-grammar-plan.json` should mirror the scene-level primitive on each component as `remotionPrimitive`, so edit passes can change scene motion without reopening renderer internals.

## Trigger Logic

There are two activation layers:

- `baseline-frame-discipline`: every scene gets deterministic frame/easing rules so any movement stays reproducible and caption-safe.
- `scene-enhanced-motion`: used only when scene content contains a real motion job such as a hook, process step, data/metric reveal, evidence relationship, pressure beat, comparison, trace, or transformation.

The human-readable trigger surface is `sceneTriggerMap`. Review it before rendering to confirm the enhanced scenes are the right scenes. If too many scenes are `high-emphasis`, reduce intensity or split the scene instead of making the whole video busy.

## Integration Boundary

Remotion may be used as a future renderer only after a separate migration plan covers voice timing, subtitles, covers, delivery manifests, rights records, local dependencies, and QC parity. Until then, use these rules to make `html-video` templates more dynamic and verifiable.

Hard failures:

- claiming Remotion integration while no local artifact records the borrowed rule;
- using React/Remotion as a shortcut that bypasses this skill's timing, voice, subtitle, cover, rights, or QC artifacts;
- adding transitions that silently shorten scenes and desync narration;
- using decorative motion with no script-bound motion verb.
