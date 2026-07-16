---
name: build-collection-atlas
description: Create a series-ready atlas card for one animal, plant, artifact, food, tool, or collectible specimen per page. Use for逐个体图鉴、动植物、物品 and collection series. Do not use for cross-attribute encyclopedia synthesis, rankings, tutorials, or relationship graphs.
---

# Build Collection Atlas

Create one precise, desirable specimen card whose skeleton can repeat across a collection without losing factual identity.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for repeatable specimen framing, physical visual system, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize `specimenId`, `name`, `category`, `identifyingFeatures`, `habitatOrUse`, `seasonOrPeriod`, and `verifiedFact`.
4. Select one tone for the entire series: `museum` or `cute`. Never switch mid-series.
5. Use one hero specimen, two or three feature vignettes, one context module, and one fact strip. All vignettes must belong to the same specimen.
6. Generate and reject identity drift, unrelated context imagery, inaccurate feature callouts, or a frame system that cannot repeat.

## Output contract

Return the image, specimen record, series skeleton, final prompt, and identity/feature/context audit.
