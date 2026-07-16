# Personal-IP animation layer ownership

This contract applies only when the resolved route is `personal-ip-semantic-layers-svg-html-video`. It must not change the default animation route, plain `个人 IP` native-page route, or whiteboard route.

## Analysis and integration sequence

The route must use a passed human/vision analysis of the selected `ip-diagram-creator` master as a measured art-direction contract instead of accepting a hash-only or unrelated reference:

1. Analyze the confirmed master as a teaching composition. Record the master SHA/dimensions, bounded object inventory, headline/content/persona role bindings, palette, typography, material, composition, whitespace, and reading order in `workflow/personal-ip-master-visual-analysis.json`. The analysis must be `passed-vision-review` by a human or vision inspector.
2. Decide ownership before motion. Separate an object only when it has a complete visible shape, clean occlusion boundaries, and a named animation job. Otherwise keep the interlocked objects in one atomic `content-unit`.
3. Map every accepted layer to one framework motion job: `reveal`, `trace`, `emphasize`, `compare`, `accumulate`, `resolve`, or `hold`. Decorative motion without a content job is rejected.
4. Reuse the current framework's timeline, easing, caption, foreground-effect, and export capabilities only after the ownership map passes. Framework motion may animate the designed page; it may not redesign the page or introduce a second copy of its information.
5. Review start, transition, midpoint, final-readable, and end-hold frames. The final-readable frame must contain the complete authoritative displayed-content contract with no clipping, duplicate owner, missing object, or new overlay that competes with the inspected master hierarchy.

Record the analysis and decisions in `workflow/personal-ip-semantic-decomposition.json` and `workflow/personal-ip-semantic-layer-spec.json`; they are production inputs, not optional prose notes.

## Flat-master decomposition

1. Confirm the Image2/ip-diagram-creator master and record its path, SHA-256, dimensions, passed visual-analysis evidence, authoritative displayed-text inventory, and audit-only status. Narration-only text is recorded separately and is not falsely claimed as visible exact copy.
2. Build a canvas-sized ownership label map before exporting any raster layer. Every non-background source pixel may have at most one runtime owner.
3. Do not use overlapping rectangular crops as independently moving layers. A transparent crop is still invalid when it carries pixels belonging to a neighbouring object.
4. When a card, character, Agent, label, or foreground object is physically interlocked in the flattened master and the occluded background cannot be reconstructed, export the whole cluster as one atomic `content-unit`. Its semantic components remain listed in the manifest, but the cluster receives one transform and one reveal window.
5. Keep semantic paths below content units. Path masks must be restricted to declared corridors and must subtract every headline, persona, content-unit, annotation, and caption ownership mask.
6. Captions remain a separate topmost SVG/HTML layer. The full master is reference/QC evidence only and must never be loaded as a runtime base image.

## Required audit

Write `workflow/personal-ip-layer-ownership-audit.json` and hard-fail unless all of the following are true:

- `scopeIsolation` is `personal-ip-animation-only`;
- duplicate source-pixel owner count is zero;
- independently moving flattened slices do not share source pixels;
- no content slice is an opaque rectangle;
- interlocked card/Agent pairs use one atomic content-unit transform;
- runtime HTML/SVG does not load the full master;
- path z-order is below content/persona and caption z-order is topmost;
- the complete final state preserves the inspected master visual-system contract and the authoritative displayed-content contract without missing text or objects.

Use `scripts/build-personal-ip-exclusive-layers.py` for actual master-bound raster extraction. A deterministic SVG reconstruction is a separate master-informed mode: it may skip raster extraction only when it contains no non-persona bitmap content, consumes the hash/dimension-bound visual analysis, reports ownership over its real semantic SVG objects, and proves zero flattened source-pixel slices. It must not claim pixel-level reconstruction of the master.

## Route isolation

If personal-IP animation is requested but the verified master, fixed persona, ownership spec, or ownership audit is unavailable, stop this route. Do not downgrade to default HTML animation, plain personal-IP native pages, FFmpeg cards, or whiteboard composition. Fixing this route must not modify the renderers or contracts for those modes.

## Stable triggers

- Natural language `个人 IP + 动画`, `个人IP动画`, `personal IP with animation`, or equivalent non-negated wording selects this route.
- Structured `personalIpAnimation: "semantic-layers"` selects this route when personal-IP intent is also active. Historical values `subtle` and `draw-reveal` keep their original native-page foreground-overlay behavior and do not silently migrate.
- Plain personal-IP intent without an animation signal keeps `personalIpAnimation` at `off` and uses the original native-page route.
- An explicit `off`, or negated wording such as `不要动画`, `不做动画`, `不用动画`, `别做动画`, `不需要动画`, or `取消动画`, wins over positive text and keeps the plain personal-IP route.
