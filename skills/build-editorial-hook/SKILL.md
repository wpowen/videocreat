---
name: build-editorial-hook
description: Create premium editorial opening hooks, chapter dividers, thesis reveals, and closing title frames with one dominant subject and short copy. Use for开场 hook、章节分隔、主题揭示. Do not use for dense teaching pages, multi-step explanations, fact tables, or relationship networks.
---

# Build Editorial Hook

Create a two-second-readable editorial frame that promises a specific idea without collapsing into a generic product advertisement.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for editorial composition families, physical material/light, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize `role`, `viewerQuestion`, `thesis`, `dominantSubject`, `visualTension`, and exact short copy.
4. Select `question`, `reveal`, `thesis`, `divider`, or `closing-echo`. Keep only one message.
5. Choose a composition family appropriate to the subject; do not default every run to black product photography plus a red line.
6. Generate, inspect as a thumbnail, proofread exact copy, and reject advertising clichés, unsafe text, or a subject that blocks the title zone.

## Output contract

Return the image, hook role, copy hierarchy, final prompt, and thumbnail/title/safe-zone audit.
