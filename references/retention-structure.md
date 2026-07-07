# Retention Structure Contract

Use this reference before rendering any final-quality video. It turns the
viewer-retention methodology into a workflow contract that applies to the whole
production chain: brief, script, storyboard, visual design, materials, motion,
captions, render, QC, and post-publish review.

## Core Model

The workflow uses the RETAIN model:

- `R - Relevance`: the first frame makes the viewer understand why this is for
  them.
- `E - Expectation`: the first 30 seconds state the promise, structure, proof
  route, and reason to keep watching.
- `T - Thinking Aid`: every scene helps the viewer understand, compare, prove,
  emphasize, transition, or track progress.
- `A - Attention Rhythm`: visual changes happen inside the narration timeline,
  not as decorative motion.
- `I - Information Proof`: claims are supported by evidence, examples,
  comparisons, data, process views, or concrete visual proof.
- `N - Next Step`: the ending preserves a final value point, resolves the
  opening promise, and gives a natural next action.

## Required Artifact

Every run must write `workflow/retention-structure-contract.json`. The artifact
must bind the RETAIN model to:

- the first-frame promise and cover/opening continuity;
- the first-30-second viewing contract;
- scene-level viewer jobs, visual subjects, evidence types, and continuation
  reasons;
- visual rhythm and structural progress cues;
- evidence cadence and anti-fatigue rules;
- ending payoff and CTA policy;
- production-phase bindings from topic selection through QC and review.

`workflow/short-form-hook-plan.json` remains a vertical short-form specialization.
It does not replace the retention structure contract.

## Structural Rules

- Start with the strongest result, conflict, problem, contrast, abnormality, or
  failure signal. Do not open with logo, greeting, empty ambience, or a silent
  title-card hold unless explicitly requested and still QC-approved.
- In the first 30 seconds, move through problem/result, pain or contrast,
  structure, and first proof. Long videos may spend more time on context, but
  the first proof route must still be visible early.
- Each scene should have one main visual subject and one viewer job. The visual
  subject may be a person, product, screenshot, case, keyword, comparison, data
  chart, action, or designed metaphor.
- Captions are visual summaries, not a substitute for the whole narration. Keep
  them readable, sequential, and non-overlapping.
- Use small changes every few seconds, structural progress every 15-30 seconds,
  and a stronger proof or turn at meaningful chapter boundaries.
- Evidence frequency depends on duration and content type: short videos should
  show proof quickly; mid-length explainers should add proof every 30-60
  seconds; long videos should place multiple proof beats in each chapter.
- Progress must be viewer-facing story state such as numbered rules, chapter
  cards, map checks, checklist completion, or semantic progress bars. Do not
  render internal page numbers, scene counters, framework names, or QC labels.
- Do not signal "the content is over" before the last value point. The ending
  should resolve the opening promise, state a memorable rule, and attach the
  CTA to that value.

## QC Signals

`logs/qc.json` must pass:

- `retentionStructureContractPresent`;
- `firstFrameRetentionPromisePresent`;
- `firstThirtySecondContractPresent`;
- `evidenceCadencePlanned`;
- `progressAndPayoffPlanned`.

The quality contract must include the same gates and require
`workflow/retention-structure-contract.json`.

## Source Basis

Use these external sources as abstract quality criteria only:

- YouTube Help audience-retention guidance: opening retention and expectation
  match can be diagnosed through the first 30 seconds.
- TikTok creative best practices: fast content proposition, readable text
  overlays, transitions, captions, and CTA can support watch time.
- Nielsen Norman Group motion guidance: animation should guide attention and
  serve feedback, state, navigation, or emphasis rather than distract.
- Multimedia-learning signaling and redundancy principles: visuals should
  clarify and highlight key information instead of duplicating long narration as
  dense on-screen text.

Do not copy creator scripts, shot orders, thumbnails, platform UI, or branded
visual packaging from any reference.
