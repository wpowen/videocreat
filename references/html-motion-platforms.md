# HTML Motion Platforms And Template Routing

Use this reference before rendering any final-quality HTML/video visual. Motion is a content system, not decoration. The selected motion pattern must make the viewer understand a relationship, state change, reveal, contrast, or payoff faster than a static frame would.

## Research Anchors

- GSAP describes itself as a high-performance JavaScript animation library that can animate CSS, SVG, canvas, WebGL, colors, strings, and generic JavaScript objects. Its ScrollTrigger docs support scrub, pin, snap, and trigger-based motion, which is useful for timeline-like reveals.
- Motion.dev describes Motion as a high-performance web animation library with simple transforms, scroll animation, gestures, and native/hybrid animation engines. Use it when React or interaction-state transitions matter.
- Anime.js positions itself as an all-in-one JavaScript animation engine with timelines, staggering, SVG tools, springs, draggable, and scroll observer features. Use it for choreographed DOM/SVG sequencing when a small imperative timeline is enough.
- MDN and the W3C Web Animations API define timing and animation models for browser-native animation. Use WAAPI/CSS as the default local path when deterministic render and zero dependency are more important than library ergonomics.
- Codrops is a practical inspiration source for UI motion, creative coding demos, and interaction patterns. Extract abstract motion patterns only; do not copy code, visuals, or branded expression unless the license explicitly allows it and attribution is recorded.
- Rive uses state machines to connect animations and define interaction logic. Use it for interactive mascots, icons, or stateful product-like motion when `.riv` assets are authorized.
- Lottie is a JSON-based animation format for lightweight scalable animations. Use it for icon/illustration loops, loading markers, and compact motion inserts when the JSON asset is licensed or locally authored.
- Three.js is the default web 3D route for full 3D/WebGL scenes, depth-driven diagrams, or spatial camera movement. Use only when 3D carries meaning and can be verified as nonblank across viewports.

## Default Routing

| Need | Preferred local route | Optional platform/library | Reject when |
| --- | --- | --- | --- |
| Kinetic explainer cards | CSS keyframes + WAAPI template | Anime.js or GSAP timeline | It is only fade-in text with no semantic reveal |
| Timeline/progress reveal | CSS/WAAPI progress driver | GSAP timeline/ScrollTrigger | Scene timing is independent of narration/subtitles |
| Editorial evidence board | CSS transforms + SVG connectors | GSAP MotionPath | Motion hides or distracts from exact Chinese text |
| Micro-interactions/icons | CSS/SVG/Lottie authored locally | LottieFiles web player | Asset license is unknown or external URL is required |
| Stateful product-like interactions | Local state machine pattern | Rive state machine | No authorized `.riv` asset or state does not affect meaning |
| 3D/depth scenes | Three.js with screenshot/pixel checks | React Three Fiber | 3D is decorative, blank, slow, or text becomes unreadable |
| React UI motion | CSS/WAAPI for static render; Motion for app prototypes | Motion for React | Runtime adds complexity without improving the video |

## Required Artifact

Every final-quality run must write `workflow/motion-template-selection.json` before rendering. It must include:

- `selectedTemplate`: id from `templates/html-motion/motion-template-registry.json` or a documented custom template id.
- `sourcePlatformLogic`: platform/library method used, such as CSS/WAAPI, GSAP timeline, Motion, Anime.js, Rive, Lottie, or Three.js.
- `whyThisTemplate`: why the topic needs this motion structure.
- `motionJobs`: entrance, reveal, emphasis, transition, and exit jobs.
- `semanticBinding`: how the motion binds to script beats, subtitles, narration timecode, or scene meaning.
- `interactionFeeling`: what makes it feel responsive or alive even when rendered as video.
- `implementationPath`: exact template or renderer path.
- `fallbackPolicy`: what must remain true if the renderer falls back.
- `verification`: screenshot, motion-difference, or renderer evidence required.
- `rejectList`: concrete failures, including static card output, random motion, timing drift, unreadable text, and copied third-party demos.

## Template Selection Method

1. Read the script and identify the motion verb: reveal, compare, pressure, accumulate, resolve, rupture, choose, trace, zoom, orbit, or transform.
2. Choose a template from `templates/html-motion/motion-template-registry.json` whose `bestFor` matches the motion verb and topic type.
3. Bind the template to the shared timecode plan. Motion cannot run on an unrelated loop unless it is only subtle atmosphere.
4. Keep exact Chinese text deterministic in HTML/SVG/CSS layers. Do not bake exact claims into generated images.
5. Add one interaction-feeling layer even for rendered video: hover-like focus, magnetic pointer, parallax response, springy reveal, or stateful highlight.
6. Verify motion with at least two screenshots at different timestamps or a motion-difference check recorded under `logs/`.
7. Pixel-difference evidence is necessary but not sufficient. Also inspect that the intended subject, caption safe area, and active state are visible in the later frame.

## Hard Failures

- No `workflow/motion-template-selection.json` in a final-quality run.
- Static card-only render when the user asked for animation, design sense, or interactivity.
- Motion copied from a third-party demo without license and attribution.
- Animation that is not semantically tied to the narration, subtitle, or scene purpose.
- Motion that makes subtitles or key text unreadable.
- Renderer fallback that drops the selected template kit or motion language without marking the output degraded.
