---
name: build-interface-plate
description: Create original product and SaaS walkthrough plates that explain a feature, state transition, workflow, or result without copying a real product. Use for工具、SaaS、产品讲解. Do not use for generic tutorials, decorative dashboards, or screenshots that must prove a real product's behavior.
---

# Build Interface Plate

Design a credible fictional interface whose component hierarchy and states visibly support the narration.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for interface state topology, product-surface system, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize `productGoal`, `appShell`, `components`, `selectedState`, `stateTransition`, `dataStory`, and `overlayAnchors`.
4. Choose `app-overview`, `feature-zoom`, `before-after-state`, `workflow-state`, or `result-evidence` as the page role.
5. Make selected state unique, chart/data direction coherent, and component tokens reusable across pages. Do not reproduce a real product.
6. Generate and reject decorative UI, contradictory charts, ambiguous states, pseudo text presented as evidence, or unsafe lower content.

## Output contract

Return the image, interface state model, final prompt, and shell/component/state/data/safe-zone audit.
