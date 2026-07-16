---
name: build-relationship-map
description: Create designed relationship maps from explicit nodes, typed directed edges, clusters, and legends. Use for人物、阵营、组织、概念关系 and cause-effect networks. Do not use for ordered tutorials, single-subject profiles, or same-subject state comparisons.
---

# Build Relationship Map

Render the supplied graph faithfully while preserving narrative focus and editorial clarity.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for graph topology, semantic rendering, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Require structured `nodes`, `edges`, `edgeTypes`, `clusters`, and `focus`. Never infer a relationship that is absent from the source.
4. Choose `full-map`, `cluster`, `core-pair`, `conflict-axis`, `timeline`, or `legend-recap` as the page role. Split graphs that cannot remain legible.
5. Plan node placement and route edges before generation. Keep labels, faces, and arrowheads unobstructed.
6. Compare the output edge-by-edge with the source. Reject wrong direction, missing edges, invented edges, hairballs, ambiguous legends, or isolated nodes not marked intentional.

## Output contract

Return the image, graph data, final prompt, and a semantic audit listing every expected node and edge with pass/fail status.
