# Motion Library Strategy

Use this reference when a video would benefit from richer motion assets, reusable open-source components, or 3D/depth-driven scenes. The default remains local HTML/CSS/SVG/WAAPI because exact Chinese text, subtitles, timing, and deterministic rendering are more important than visual novelty.

## Principle

Do not use a motion library because it looks better in isolation. Use one only when it makes the viewer understand a relationship, state change, proof, spatial structure, comparison, or payoff faster than the base template.

Motion-library selection must preserve:

- exact text in deterministic HTML/SVG/CSS layers;
- subtitles in a stable caption safe area;
- scene timing bound to narration/subtitle timecode;
- Remotion-inspired frame/progress/easing primitives recorded in `workflow/motion-template-selection.json`;
- rights-safe locally authored assets or licensed open-source code;
- screenshot and motion-difference verification;
- a fallback that marks the output degraded if the selected motion language is lost.

## Default Ladder

| Tier | Default decision | Use when | Avoid when |
| --- | --- | --- | --- |
| `base-css-waapi` | Always start here | Clean type hierarchy, simple reveal, caption-safe cards, deterministic render | The timeline becomes hard to maintain or the scene needs real path/3D/data logic |
| `animejs-2d` | Preferred first add-on | DOM/SVG choreography, staggered cards, text beats, path drawing, spring-like emphasis | Plain CSS keyframes are enough, or timing is not tied to the script |
| `d3-diagram` | Data/structure add-on | Charts, ranked bars, process graphs, force-free diagrams, data transforms | Decorative charts, unverifiable numbers, or copied dashboard styling |
| `data-curve-trace` | Preferred data-curve template | One or two sourced time-series curves, endpoint callouts, inflection highlights | Unsourced values, dense multiseries analysis, or formula/physics relationships better handled by Manim |
| `roughjs-sketch` | Style add-on | Hand-drawn proof boards, story maps, lesson sketches, writing-method diagrams | Serious data/news visuals where sketch style weakens authority |
| `lottie-authored` | Asset-loop add-on | Locally authored or explicitly licensed icon/illustration loops | Unknown public `.json` assets, exact claims baked into animation, or remote URLs |
| `motion-js` | App-like transition add-on | React/Vue/JS UI state transitions, shared-layout feel, gesture-like micro-motion | Static html-video templates can do the job with CSS/WAAPI |
| `threejs-depth` | High-cost special case | Spatial models, 3D object hierarchy, camera orbit/push, depth as explanation | Decorative 3D, unreadable text, blank/slow WebGL, or more than a few scenes per video |
| `galacean-vfx-layer` | Optional visual-effects layer | Particle atmosphere, fireworks, energy beams, scan/focus effects, short transition bursts, or 2D/3D effect inserts with a semantic scene job | Dense text/data scenes, persistent decoration, unclear asset rights, subtitle collisions, or whole-renderer replacement |
| `gsap-exception` | Not a default open-source route | Only if an explicit production need beats license simplicity and the license is accepted | Open-source portability, installer-facing skill defaults, or general reusable templates |

## Scene Routing

| Scene job | Recommended stack | Reason |
| --- | --- | --- |
| Strong hook, contradiction, quote punch | CSS/WAAPI, then Anime.js if sequencing gets complex | Keeps text sharp while adding controlled kinetic hierarchy |
| Process, checklist, curriculum, model steps | CSS/WAAPI progress driver; D3 for generated geometry; Anime.js for stagger | Progress must follow narration, not a free-running loop |
| Evidence board, causal proof, mystery reveal | Rough.js for authored sketch texture; D3 for connector/layout math; Anime.js for reveal timing | Reduces hand-built connector work while preserving exact labels |
| Data/stat scene | `data-curve-trace` for simple sourced curves; D3 for complex scale/layout; Manim only for formula/physics/geometric relationships | Lets the visual encode real values without drawing charts manually while avoiding unnecessary renderer complexity |
| Abstract system or spatial metaphor | Three.js, optionally driven by Anime.js 4.5 Three adapter | 3D is justified only when depth/camera/object relation carries meaning |
| Hook, reveal, transition, risk scan, product activation, or payoff that needs visual effects | Galacean visual-effects layer after reading `references/galacean-visual-effects.md` and `assets/galacean-effects-capability-catalog.json` | Effects are justified only when they focus attention, reveal a state change, carry a spatial metaphor, or make a payoff beat visible while captions remain topmost |
| Cover or platform thumbnail | Static SVG/PNG/JPG; optional D3/Rough.js during generation only | Upload covers need crisp inspection, not runtime motion |
| Subtle icon loop | Lottie only when locally authored or license-recorded | Avoids recreating complex icon motion by hand without pulling unknown assets |

## Library Selection Record

If any library beyond CSS/WAAPI is used, extend `workflow/motion-template-selection.json` with:

```json
{
  "libraries": [
    {
      "name": "animejs",
      "version": "4.5.0",
      "license": "MIT",
      "source": "npm",
      "role": "timeline choreography for SVG connector reveal",
      "whyNeeded": "CSS keyframes would duplicate timing logic across eight evidence nodes.",
      "sceneScope": ["scene-02", "scene-03"],
      "fallback": "Freeze to the final connector state and mark renderer degraded.",
      "verification": ["motion-difference", "caption-safe-area", "timecode-bound-progress"]
    }
  ]
}
```

Required fields: `name`, `version`, `license`, `role`, `whyNeeded`, `sceneScope`, `fallback`, and `verification`.

## Remotion-Inspired Primitive Layer

Before selecting an add-on library, record the base motion primitive that the library must serve. Borrow from the Remotion plugin's animation rules:

- frame-driven state: derive progress from scene timecode/render frame, not wall-clock timers;
- explicit easing: choose a cubic-bezier curve for entrance, trace, emphasis, or hold;
- transition accounting: overlapped transitions must be reflected in `workflow/sync-timecode-plan.json`;
- deterministic text reveal: use string slicing/typewriter or grouped semantic text blocks, not random per-character effects.

This layer is recorded as `remotionMotionPrimitives` in `workflow/motion-template-selection.json` and as `remotionPrimitive` on every `workflow/motion-grammar-plan.json` scene component. It improves motion quality while preserving `html-video` as the current renderer.

## Open-Source Component Policy

- Prefer libraries with permissive licenses such as MIT or ISC.
- Prefer importing small modules over whole packages when the package is broad, especially D3.
- Reuse concepts and APIs, not third-party demo art direction, exact code, text, screenshots, or branded composition.
- Record all non-local assets in `workflow/visual-asset-manifest.json`; code library use belongs in `workflow/motion-template-selection.json`.
- Lottie assets must be locally authored or explicitly licensed. The player license is not proof that a downloaded animation asset is usable.
- Three.js scenes must keep exact Chinese text outside WebGL unless a separate deterministic HTML/SVG overlay owns it.
- Galacean effect JSON, textures, sprites, Spine rigs, and model assets must be locally authored or explicitly licensed. Treat `effects-runtime` as a player/runtime capability; the runtime license does not prove that a third-party effect asset is usable.
- Galacean visual effects must keep exact viewer-facing Chinese text in deterministic HTML/SVG/CSS/subtitle layers. Canvas/WebGL may carry effects, atmosphere, particles, and abstract texture, not final claims.

## Verification Gates

A library-backed template passes only when:

- `workflow/motion-template-selection.json` records the selected library and scene scope;
- `workflow/motion-template-selection.json` records Remotion-inspired frame-driven primitives for every scene;
- scene progress is driven by the same timecode plan as subtitles and narration;
- opening and later screenshots prove visible, intentional change;
- pixel difference is accompanied by human-inspectable subject/caption-safe evidence;
- WebGL/canvas scenes are nonblank and framed at 1920x1080;
- Galacean visual-effects scenes, when active, have `workflow/galacean-effects-plan.json`, pre/peak/post screenshots, asset provenance, caption-safe layer order, and deterministic fallback;
- final package QC still passes audio/video duration, subtitle, cover, and black-frame checks;
- fallback behavior is explicit when the renderer cannot preserve the selected library.

Hard failures:

- using a library for background decoration only;
- adding 3D where text readability or subtitles degrade;
- copying third-party examples without license and provenance;
- activating Galacean/effects-runtime as a whole renderer or persistent decoration layer instead of a scene-level effect layer;
- using Galacean effect assets with unknown rights or letting effects cover subtitles, data labels, source notes, or key proof text;
- introducing GSAP or paid/proprietary assets as a portable skill default;
- selecting all libraries globally instead of per-scene.

## Recommended POC Order

1. `animejs-proof-board`: replace hand-written connector/card choreography in one evidence-board template.
2. `data-curve-trace`: render a sourced time-series line from `workflow/data-series.json` with axis, trace, endpoint callout, and source footnote.
3. `d3-data-reveal`: generate a value-bound ranked-bar, grouped chart, or dense trend component when simple SVG path logic is insufficient.
4. `roughjs-story-map`: generate hand-drawn path/board assets for writing/story/teaching videos.
5. `threejs-depth-opener`: one opening or model scene with HTML subtitle overlay and nonblank canvas validation.
6. `galacean-vfx-payoff-layer`: one hook, transition, or ending payoff effect using project-authored/licensed effect assets, with subtitles topmost and pre/peak/post screenshots.
7. `lottie-authored-icon-loop`: only after an authored/licensed Lottie source exists.

Stop after each POC if the screenshot, motion-difference, or caption-safe evidence is worse than the base template.
