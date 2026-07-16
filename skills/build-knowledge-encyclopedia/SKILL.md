---
name: build-knowledge-encyclopedia
description: Create polished encyclopedia profile plates for one subject with structured facts, mechanisms, traits, ratings, or a compact roundup. Use for主体档案、盘点、评分、科普结构. Do not use for one-specimen-per-page collections, ordered tutorials, relationship graphs, or software-state walkthroughs.
---

# Build Knowledge Encyclopedia

Create an information-rich subject profile that teaches, rather than an attractive illustration with empty modules.

## Workflow

1. Read [the shared production contract](../_visual-series-core/production-contract.md).
2. Read [the scene design contract](references/design-contract.md).
   Load `references/prompt-contract.json` as the machine-readable source of truth for layout families, physical visual system, reject rules, and QC. Do not replace it with the central catalog skeleton.
3. Normalize the source into `subject`, `identity`, `facts`, `mechanismOrHabit`, `evidence`, and `rating`. Reject missing or unsupported facts.
4. Assign one page role: `hero-overview`, `detail-zoom`, `mechanism`, `habit-or-use`, `risk-notes`, or `rating-summary`.
5. Build the prompt from the exact content plan. Give every visible module a teaching job; do not use decorative placeholder lines as fake information.
6. Generate, inspect, and repair until all scene gates pass. Preserve the content hierarchy across a series while varying only the page role and evidence.

## Output contract

Return the image, final prompt, normalized content plan, text ownership plan, and pass/fail evidence for every rejection gate in the scene contract.
