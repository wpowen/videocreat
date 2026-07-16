---
name: build-oriental-ink
description: Create restrained new-Chinese ink atmosphere frames for cultural subjects, pacing breaths, seasonal transitions, and endings. Use for文化题材、节奏呼吸、收尾. Do not use for dense factual explanation, tutorials, UI evidence, or decorative pseudo-calligraphy.
---

# Build Oriental Ink

Create narrative stillness with culturally coherent place, season, depth, and one meaningful accent rather than generic wallpaper.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for depth topology, ink material behavior, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize `culturalContext`, `place`, `seasonOrTime`, `narrativeAccent`, `nearMidFarPlan`, and `breathingFunction`.
4. Build a near/mid/far composition and make the time or seasonal change visible through concrete cues.
5. Use one point color only. Avoid seals, fake calligraphy, tourist-poster density, and arbitrary symbol mixing.
6. Generate and reject frames that lack a narrative accent, temporal evidence, intentional negative space, or a calm subtitle band.

## Output contract

Return the image, cultural/seasonal plan, final prompt, and depth/accent/negative-space audit.
