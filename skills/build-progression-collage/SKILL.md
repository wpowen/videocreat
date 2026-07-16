---
name: build-progression-collage
description: Create identity-locked multi-state comparison grids for recaps, making-of sequences, evolution, aging, iteration, or before/after stories. Use for回顾、演进、多状态对比. Do not use for unrelated mood collages or independent subjects that do not share one base identity.
---

# Build Progression Collage

Show the same subject changing through explicit states while locking silhouette, camera, light, framing, and background.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for identity locks, state-job topology, assembly rules, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize `baseIdentity`, invariant features, ordered `states`, allowed changes, camera lock, light lock, and background lock.
4. Generate a clean base state first. For three or more states, create every changed state as a separate reference-bound edit; never ask one generation or edit call to render the final multi-cell grid.
5. When leaf removal exposes hidden structure, derive the leafless state once, then create adjacent bud/bare variants from that same exposed-structure reference. Assemble equal cells deterministically only after each state passes identity and state-specific checks.
6. Reject silhouette drift, camera drift, lighting drift, unclear state progression, or changes beyond the allowed state variables.

## Output contract

Return the final grid, base reference, state outputs, prompt/edit chain, and per-state identity/camera/light/order audit.
