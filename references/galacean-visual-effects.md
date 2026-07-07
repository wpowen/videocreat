# Galacean Visual Effects Layer

Use this reference when a video brief asks for visual effects, particles, fireworks, 2D/3D effects, energy beams, magical UI accents, or when Planner decides that a scene needs a premium effect layer to make a hook, reveal, transition, spatial metaphor, or payoff easier to feel.

Galacean Effects / `effects-runtime` is treated as a bounded visual-effects capability inside the existing visual motion system. It does not replace `codex-video-workflow`, `html-video`, narration timing, subtitles, cover design, rights records, or QC. The current framework remains the governor; Galacean-style effects are optional scene layers.

## Core Rule

Do not add an effect because the frame feels empty. Add an effect only when it performs a viewer-facing job:

- focuses attention on the current subject;
- makes a state change, transition, risk, reward, or reveal visible;
- gives an abstract concept a physical metaphor;
- raises the perceived production value without reducing readability;
- creates a payoff beat at the exact moment the narration earns it.

If the effect has no semantic job, it is decoration and should be rejected.

## When To Use Effects

Use a Galacean-style effect when the scene has one of these jobs:

| Scene job | Good effect role | Typical capability |
| --- | --- | --- |
| First-frame promise or strong hook | spotlight the promise, pull particles toward the main idea, create a subtle energy field | `focus-scan-spotlight`, `particle-atmosphere`, `energy-beam-reveal` |
| Reveal, payoff, success, milestone, transformation | burst, firework, ribbon trail, resolving glow | `firework-payoff`, `transition-burst`, `ui-activation-sparkle` |
| Transition between chapters, time periods, or mental states | sweep, portal, directional particle wipe, depth pass | `transition-burst`, `path-trail-trace`, `depth-orbit-3d` |
| Abstract system, platform, model, or invisible force | orbit, field lines, flow particles, layered 3D plane | `depth-orbit-3d`, `particle-atmosphere`, `energy-beam-reveal` |
| Risk, warning, anomaly, diagnostic scan | scan line, alert sparks, bounded noise, x-ray focus | `focus-scan-spotlight`, `ambient-falling-elements` |
| Product activation or UI magic moment | click sparkle, loading-to-done trail, panel transformation | `ui-activation-sparkle`, `path-trail-trace` |
| Celebration ending or CTA | final fireworks, confetti, resolved energy ring | `firework-payoff`, `particle-atmosphere` |

## When Not To Use Effects

Reject the effect when any of these are true:

- the scene is dense with exact Chinese text, subtitles, data labels, legal/medical/financial disclaimers, or other precision copy;
- the effect would sit on top of subtitles, body text, axes, source footnotes, or key proof panels;
- the scene is already visually busy due to B-roll, generated images, charts, or a native IP diagram page;
- the topic needs sober authority and the effect would make the claim feel unserious;
- the effect runs through the whole video as a persistent background loop;
- the only reason is "make it cool" or "fill empty space";
- the required Galacean JSON/texture/model/spine asset is not locally authored, licensed, or recorded in `workflow/visual-asset-manifest.json`;
- the renderer cannot prove nonblank canvas, frame stability, caption safety, and timing-bound motion;
- exact viewer-facing Chinese text would exist only inside WebGL/canvas/effect textures.

## Placement Rules

Effects must be placed relative to the content hierarchy, not by visual impulse.

Layer order for final frames:

1. background theme and safe-area matte;
2. scene material: photos, generated images, stock clips, diagrams, charts, UI panels;
3. Galacean background VFX: ambient particles, depth fog, far-field trails;
4. deterministic HTML/SVG/CSS content: headlines, body copy, labels, charts, proof cards;
5. Galacean foreground accent VFX: sparks, short bursts, scan rays, object-bound glow;
6. deterministic highlight overlays: callouts, masks, connectors, progress marks;
7. captions and subtitles, always topmost.

Spatial rules:

- Keep the subtitle/caption band reserved. Effects may pass behind it only when opacity is low and text contrast remains unchanged.
- Keep headline, body, chart axis, source footnote, and proof-card bounding boxes clear.
- Background effects should live in the outer thirds, behind the subject, or at low opacity.
- Foreground effects should be short-lived and anchored to a subject, transition edge, button, chart endpoint, or payoff object.
- Full-screen bursts are allowed only during a transition or ending payoff, and they must leave the next readable frame clean.
- 3D/depth effects need their own safe stage area; do not place exact text inside the 3D scene unless a deterministic overlay owns the text.

Timing rules:

- Effects start and end from `workflow/sync-timecode-plan.json` and subtitle cue windows, not wall-clock loops.
- Default accent duration is 0.6-2.0 seconds.
- Background atmosphere may run for a whole scene only if it stays quiet and changes slowly.
- Firework/payoff bursts should peak on the narrated conclusion word, CTA, or resolved visual state.
- Transition effects should overlap the outgoing/incoming scene only when the overlap is recorded in the timecode plan.

Intensity rules:

- Default opacity range: 0.15-0.45 for background, 0.35-0.75 for short foreground accents.
- Avoid high-frequency flicker, full-white flashes, and random strobe behavior.
- Use reduced-motion fallback for accessibility or long-form sober scenes.

## Capability Catalog

The Planner must load `assets/galacean-effects-capability-catalog.json` before selecting effects. The catalog is a capability menu, not proof that every effect asset is already licensed. Each selected item still needs local asset provenance, timing, placement, fallback, and QC evidence.

Core capabilities:

- `particle-atmosphere`: quiet ambient field, dust, sparks, soft symbolic motion.
- `firework-payoff`: celebratory burst for reveal, success, or ending payoff.
- `energy-beam-reveal`: beam, ray, pulse, or line that reveals a concept or connects two states.
- `path-trail-trace`: trail following a workflow, timeline, route, or cursor-like action.
- `focus-scan-spotlight`: scan, lens, sonar, or focus ring used for diagnosis and attention.
- `transition-burst`: scene-change wipe, portal, shockwave, or particle dissolve.
- `depth-orbit-3d`: layered depth, 3D orbit, object field, or spatial metaphor.
- `ui-activation-sparkle`: button, card, or product-state activation accent.
- `ambient-falling-elements`: rain, snow, leaves, shards, data bits, or warning particles.
- `texture-video-plane`: image/video/texture plate inside an effect scene.
- `spine-character-motion`: character/creature skeletal motion only when Spine assets and licenses are explicit.
- `rich-text-effect-plate`: stylized text plate for non-final exact copy; final Chinese claims must stay in deterministic overlay layers.

## Planner Artifact

When Galacean visual effects are active, write `workflow/galacean-effects-plan.json` before rendering.

Required shape:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-visual-effects-planning",
  "governor": "codex-video-workflow",
  "active": true,
  "sourceFamily": "galacean-effects-runtime",
  "capabilityCatalog": "assets/galacean-effects-capability-catalog.json",
  "plannerDecisionSummary": "Use short payoff and transition effects only; no persistent decorative loop.",
  "rulesApplied": {
    "semanticJobRequired": true,
    "subtitlesTopmost": true,
    "exactTextOwnedByHtmlSvgCss": true,
    "wholeStackReplacementRejected": true
  },
  "selectedEffects": [
    {
      "id": "scene-03-payoff-firework",
      "sceneId": "scene-03",
      "capabilityId": "firework-payoff",
      "semanticJob": "mark the narrated result after the proof resolves",
      "triggerCue": "subtitle-018",
      "placement": {
        "layer": "foreground-accent",
        "anchor": "result-card-top-right",
        "avoidRegions": ["subtitle-band", "headline", "source-footnote"]
      },
      "timeRangeSec": { "start": 34.8, "end": 36.1 },
      "intensity": { "opacity": 0.62, "particleDensity": "medium" },
      "asset": {
        "path": "assets/effects/scene-03-payoff.json",
        "license": "project-authored",
        "provenance": "created for this package"
      },
      "fallback": "replace with deterministic SVG burst and mark galacean effect degraded",
      "verification": [
        "screenshots/scene-03-payoff-before.png",
        "screenshots/scene-03-payoff-peak.png",
        "logs/galacean-effects-qc.json"
      ]
    }
  ],
  "rejectedEffects": [
    {
      "sceneId": "scene-02",
      "capabilityId": "particle-atmosphere",
      "reason": "dense data labels and source footnote leave no safe effect region"
    }
  ],
  "qcRequirements": [
    "galaceanEffectsPlanPresent",
    "galaceanEffectsSemanticJobPresent",
    "galaceanEffectsCaptionSafe",
    "galaceanEffectsRightsRecorded",
    "galaceanEffectsMotionEvidencePresent",
    "galaceanEffectsNoTextOwnershipLeak"
  ]
}
```

Required selected-effect fields: `id`, `sceneId`, `capabilityId`, `semanticJob`, `triggerCue` or timecode binding, `placement`, `timeRangeSec`, `intensity`, `asset`, `fallback`, and `verification`.

Required rejected-effect fields: `sceneId`, `capabilityId`, and `reason`.

## Example Scene Decisions

Good decisions:

- A product demo scene uses `ui-activation-sparkle` for 0.8 seconds around the clicked CTA, behind subtitles and outside the body-copy box.
- A chapter transition uses `transition-burst` as a 0.5-second edge wipe, then clears before the new headline appears.
- A conclusion scene uses `firework-payoff` above the result card exactly when the narration states the payoff.
- An abstract system explainer uses `depth-orbit-3d` behind a deterministic HTML label layer to show three actors orbiting one constraint.

Bad decisions:

- Adding particles behind every scene because the style feels premium.
- Placing fireworks over subtitles or chart labels.
- Putting the final Chinese title inside an effect texture.
- Using a public demo effect JSON without license and calling it production-ready.
- Letting the Galacean renderer own the whole video timeline, voice, cover, or QC.

## Rendering And Fallback

Preferred integration pattern:

- keep the base scene in HTML/SVG/CSS;
- mount Galacean canvas as a background or foreground effect layer;
- drive effect state from the same scene timecode as subtitles;
- composite with FFmpeg only after layer order, opacity, and safe areas are verified;
- preserve a deterministic CSS/SVG fallback for each active effect.

Fallback rules:

- If the Galacean canvas is blank, slow, or unavailable, freeze or replace the effect layer; do not drop subtitles or exact text.
- If asset rights are unclear, disable the effect and record it as rejected.
- If caption safety fails, move, dim, shorten, or remove the effect.

## QC Gates

Active Galacean visual effects pass only when:

- `workflow/galacean-effects-plan.json` exists and selects or rejects effects per scene;
- `workflow/external-capability-fusion-plan.json` records Galacean as a bounded borrowed capability;
- `workflow/motion-template-selection.json` or `workflow/motion-style-template-selection.json` references the effect layer where relevant;
- selected assets appear in `workflow/visual-asset-manifest.json` with source, license, hash when available, and usage scope;
- screenshots include pre-effect, peak-effect, and post-effect states for each active effect scene;
- motion-difference evidence proves the effect is visible without becoming the only scene change;
- WebGL/canvas output is nonblank, correctly framed, and not slower than the render budget;
- captions remain topmost and readable;
- exact viewer-facing text remains in deterministic HTML/SVG/CSS or subtitle layers;
- `logs/qc.json` passes `galaceanEffectsPlanPresent`, `galaceanEffectsCaptionSafe`, `galaceanEffectsRightsRecorded`, and `galaceanEffectsMotionEvidencePresent`.

Hard failures:

- Galacean/effects-runtime is used as a full renderer replacement without a migration plan;
- effect assets have unknown rights;
- effect placement covers subtitles, data labels, source notes, or key proof text;
- visible implementation/library labels appear in final MP4 frames;
- exact Chinese claims exist only inside WebGL/canvas textures;
- no screenshots or motion evidence prove the active effect;
- the effect runs as generic decoration across unrelated scenes.

## Showcase

The local capability showcase is `media/galacean-vfx-showcase.html`. It demonstrates the intended layer behavior using local deterministic canvas/CSS approximations so users can see the planned visual jobs without requiring a production Galacean asset bundle. The showcase is not publication proof for any third-party effect asset; production runs still need `workflow/galacean-effects-plan.json`, asset provenance, render evidence, and QC.
