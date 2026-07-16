# Shared Visual Series Production Contract

Use this shared contract for mechanics only. The selected leaf Skill remains the sole owner of scene semantics, visual language, and domain-specific quality judgment.

## Required workflow

1. Select exactly one primary leaf Skill for a scene. Add at most one accent Skill only when the brief explicitly needs a hook, metaphor transition, or cultural breathing beat.
2. Convert the source into the leaf Skill's required content schema before writing an image prompt. Do not invent facts, graph edges, UI behavior, chronology, or state changes.
   Load the selected leaf Skill's `references/prompt-contract.json`. The central catalog owns routing only; the leaf contract owns layout families, material, lighting, color, typography, failure-specific reject rules, and domain QC.
3. Plan a native 9:16 or 16:9 composition. For vertical video, keep the lower 18% as genuinely calm background: no subject, card, label, connector, border, or high-contrast ornament.
4. Decide text ownership before generation. Prefer short exact integrated text only when proofread is feasible; otherwise create intentional label zones and add exact text deterministically later. Never accept pseudo text.
5. Generate with the built-in image generation path by default. Save project-bound finals in the workspace and record the prompt used.
6. Inspect at mobile thumbnail size and full size. Check subject accuracy, reading order, safe area, text, visual hierarchy, and the leaf Skill's domain gates. When the brief makes an exact-count claim, count the visible items one by one and record the result; visual plausibility is not evidence.
7. Repair one failure class at a time. Reject rather than rationalize a failed semantic or continuity gate.
8. Compile the final prompt through `scripts/lib/visual-series-prompt-method.mjs`. Every prompt must contain output intent, content contract, spatial map, series style lock, physical visual system, exact-text whitelist, reject rules, and executable QC, and must pass the structured prompt lint before generation.

## Shared rejection gates

- Mixed rendering media or unexplained palette drift.
- Important content inside the lower subtitle-safe band.
- Watermarks, logos, real-product imitation, celebrity likeness, or copied creator/studio style names.
- Random readable text, pseudo Chinese, meaningless placeholder copy presented as information, or factual claims not present in the brief.
- Decorative filler with no narrative job.
- Any visible count, rating marker, state badge, or repeated evidence item that disagrees with the exact brief, even when the surrounding text is correct.
- A composition that only looks attractive but cannot support the intended narration beat.

## Run evidence

Record `selectedSkillId`, `skillVersion`, `selectionReason`, `pageRole`, `prompt`, `textPolicy`, `outputPath`, and an explicit pass/fail result for every leaf-Skill quality gate.
