# Methodology

## Production Contract

Record these fields before writing or rendering:

- Goal: viewer action or learning outcome.
- Audience: knowledge level and emotional state.
- Platform: aspect ratio, duration, caption safety, and export target.
- Rights: what text, images, audio, fonts, and source material may be used.
- Stop condition: final MP4 plus reproducible evidence package.

## Short-Form Structure

Use platform guidance only as abstract criteria:

1. First second: show the claim, contradiction, or concrete result.
2. Early context: explain why the viewer should care without a long preface.
3. Middle: teach one compact framework, not a broad encyclopedia.
4. Proof or example: one original example that demonstrates the method.
5. Ending: recap the operational rule and leave a clear next action.

For novel-writing technique videos, use original examples and avoid copying specific creator language. A reliable structure is:

- Hook: the reader stops because something is wrong.
- Conflict: desire, obstacle, and deadline.
- Chapter question: every chapter carries one unresolved question.
- Reversal: new information reinterprets an earlier scene.
- Edit pass: replace summary/explanation/transition with action, cost, and consequence.

## Storyboard Rules

- Keep each scene to one visual idea.
- Use large readable text, not paragraph overlays.
- Keep captions in a bottom safe area with high contrast.
- Maintain one timing source of truth: scene start, duration, narration, subtitle.
- Use original HTML/CSS/SVG for visual examples unless licensed assets are supplied.

## Voice Direction Rules

Before TTS, create a voice direction from video type and requested speech style:

1. Infer or read speech style: `conversational`, `tutorial`, `explainer`, `story`, `news`, `product`, or `documentary`.
2. Write `workflow/voice-direction.json`.
3. Preserve the original narration in `script/narration.txt`.
4. Write the TTS-ready version to `script/narration-spoken.txt`.
5. For口语化 narration, add pauses only after complete sentences or complete semantic beats.
6. Treat comma-like punctuation (`，`, `,`, `、`) as a short in-clause pause. If explicit timing is required, use `0.5s`; do not convert commas into line breaks or sentence-level pauses.
7. Leave sentence-ending punctuation (`。`, `！`, `？`, `!`, `?`) and semantic endings (`；`, `;`) on the backend/default pause duration unless the user explicitly requests a different full-stop rhythm.
8. Never pause between subject/predicate, verb/object, number/unit, or setup/answer.

The spoken narration can use line breaks for breathing. It must not rewrite claims, invent facts, or drift away from the subtitles.

## Planner-First Visual Design

Do not turn the storyboard directly into text cards. After storyboard and before rendering:

1. Infer video type from topic, platform, audience, and scene language.
2. Choose a core template kit: for example `writing-method`, `tutorial-explainer`, or `professional-explainer`.
3. Create an aesthetic brief: taste goal, visual territory, mood keywords, avoid list, composition rules, color rules, typography rules, imagery strategy, and motion rules.
4. Assign every scene a shot template, visual role, inserted image role, camera/motion language, and caption-safe layout.
5. Write image2-compatible prompts for every scene and insert either GPT Image 2 output or deterministic local SVG fallback.
6. Reject pure PPT-like output unless the user explicitly requested slides.

For novel-writing technique videos, the default kit is `writing-method`: manuscript desk, doorway anomaly, conflict triangle board, chapter question thread, rewrite lens, and edit-desk checks.

## Fusion With Current Workflow

`html-video` should sit after storyboard/design and before final QC:

1. Existing workflow creates brief, sources, article/script, storyboard, design plan, asset manifests, and safety policy.
2. `html-video` receives a content graph and per-frame designed HTML pages with inserted visual assets.
3. Local audio/subtitle generation is attached.
4. Exported MP4 returns to current QC/package gates.

This avoids replacing mature evidence handling with a renderer-specific pipeline.
