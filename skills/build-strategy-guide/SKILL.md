---
name: build-strategy-guide
description: Create premium tutorial boards with ordered steps, checklists, priorities, decision paths, and pitfall warnings. Use for教程、步骤、清单、避坑. Do not use for relationship networks, specimen collections, pure atmosphere, or fictional SaaS state evidence.
---

# Build Strategy Guide

Turn a method into an actionable reading path with real checklist content and explicit failure prevention.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for route topology, color semantics, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize the source into `goal`, `prerequisites`, ordered `steps`, `checklist`, `pitfalls`, and `successSignal`.
4. Select `overview`, `step-sequence`, `decision-path`, `checklist`, `pitfall-alert`, or `recap` as the page role.
5. Verify numbering, direction, and warning semantics before generation. Use red only for risks and blue only for progress or priority.
6. Generate, inspect the path at mobile size, and repair any broken order, empty checklist, or safe-band intrusion.

## Output contract

Return the image, final prompt, normalized method plan, and evidence that numbering, route direction, checklist completeness, warning semantics, and safe area all pass.
