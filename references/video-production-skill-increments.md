# Video Production Skill Increments

Use this reference when borrowing design patterns from Pluviobyte's
`video-production-skills` repository. Treat the source as a design vocabulary and
QC inspiration layer, not as a replacement for this workflow's narration,
rights, timing, cover, delivery, or local TTS contracts.

Source reviewed:

- Repository: `https://github.com/Pluviobyte/video-production-skills`
- Commit: `a3f743ef4274b84a057513430f8fea4c424f0147`
- Reviewed skills: `black-white-text-opener`, `dark-saas-magic-video`,
  `reference-video-replica-qc`

No license file was present in the reviewed checkout. Reuse design principles,
scene vocabulary, and QC ideas. Do not copy source media, showcase videos,
preview frames, or script code into distributable packages unless a compatible
license or explicit authorization is recorded.

## Increment 1: Typed Black White Opener

What this workflow lacked:

- A deliberately minimal opening title package.
- Character-by-character reveal timing with optional typing SFX events.
- A restrained pre-roll style for tutorials, opinion videos, and product
  announcements.

Local template:

- `templates/html-motion/typed-black-white-opener.html`
- Registry id: `typed-black-white-opener`

Use only when:

- The user explicitly asks for a title opener, black-white opener, typing title,
  or opening package.
- The brief's platform allows a pre-roll and the production contract records it.

Do not use when:

- The user did not request an in-video opener. The default MP4 still starts on
  the first content scene with narration at 0s.
- The request is reference-video alignment; route through reference QC first.
- The opener would delay the hook in a short-form vertical video.

Required artifacts when selected:

- `workflow/motion-template-selection.json` with `selectedTemplate` set to
  `typed-black-white-opener`.
- `workflow/sync-timecode-plan.json` declaring whether the opener overlaps the
  first spoken scene or is an explicitly requested title-card opening.
- Screenshot evidence at early typed state, final hold, and transition-out.
- If SFX are used, a timing plan that binds click events to visible character
  reveal timestamps.

QC additions:

- Text appears sequentially, not as a whole-line fade.
- White text remains mobile-readable.
- No colored full-screen flash or persistent neon-line background.
- Typing click audio stops during holds and transitions.
- Silent pre-roll is a failure unless explicitly requested.

Planner capability card:

- Capability type: optional opener module, not a full-video style.
- Planner trigger: explicit opener request, title-animation request, course intro
  request, product pre-roll request, or a brief that has a recorded reason for
  delaying the first narrated content beat.
- Selection strength: high only when the user names an opener or typing effect;
  medium when a longer horizontal video needs a branded intro; low for
  short-form vertical hooks.
- Borrowable design controls: character-level reveal, text-state replacement,
  readable black/white contrast, click-SFX timing plan, clean transition-out.
- Planner rejection signal: any run where the default direct-first-scene rule,
  first-three-second hook, or narration-at-0s contract would be weakened.

## Increment 2: Dark SaaS Magic UI

What this workflow lacked:

- A specific dark product-video style with product UI objects as the main visual
  subject.
- Scene modules for prompt invocation, gradient CTA click, generated-result
  field, capability ring, integration pills, export burst, and final claim.
- A style boundary that avoids generic dark gradients and tiny distant UI cards.

Local template:

- `templates/html-motion/dark-saas-magic-ui.html`
- Registry id: `dark-saas-magic-ui`

Use when:

- The video is a SaaS/product/tool/AI workflow launch or short product demo.
- The brief asks for dark cinematic SaaS, magic UI, Presenton-like product
  energy, floating UI, model/provider rings, or export objects.

Do not use when:

- The content is school education, story craft, documentary, data-newsroom, or
  another topic where this product aesthetic would flatten the subject.
- The user asks for pixel-level or visual-level reference replication.
- The product capability is unknown and the scene would invent unsupported
  claims.

Scene modules to borrow as abstract design vocabulary:

- Kinetic promise: large white product/category claim on a black stage.
- Prompt invocation: large prompt card plus gradient CTA.
- Generated result field: floating product-like cards that resolve into one
  readable hero frame.
- Local/platform capability: large app window plus platform pills.
- Connect ecosystem: provider or integration pills on arcs.
- Model/capability ring: deterministic badges around a central claim.
- Export burst: output pills/cards from a folder or container.
- Final claim: 2-4 text states ending in a held product category.

QC additions:

- Black spatial stage is present with only a subtle bottom purple horizon glow.
- Main UI object is large enough to inspect at hero frames.
- Gradient CTA visibly triggers a transformation.
- No persistent horizontal neon-line background dominates the video.
- No unexplained solid-color flash.
- Product claims stay inside known or user-provided capabilities.

Planner capability card:

- Capability type: product/SaaS visual system and scene-module vocabulary.
- Planner trigger: SaaS, AI product, tool launch, workflow demo, product update,
  productized agent, model/provider comparison, or user request for dark
  cinematic product UI / magic UI / floating UI energy.
- Selection strength: high for product demos with real capability beats; medium
  for abstract workflow explainers that can be represented as UI states; low for
  general knowledge videos.
- Borrowable design controls: black stage depth, kinetic product promise,
  prompt-card invocation, gradient CTA as cause, visible transformation as
  effect, generated result field, integration/capability ring, export burst,
  held final category claim.
- Planner rejection signal: school, story, documentary, data-newsroom, or
  education topics where a SaaS product stage would erase the subject; any brief
  lacking enough product facts to support the claims shown on screen.

## Increment 3: Reference Video Alignment QC

What this workflow lacked:

- A formal route for user-supplied reference-video comparison.
- A hard distinction between pixel-level, visual-level, and style-level
  fidelity.
- Side-by-side evidence at fixed timestamps for "still not aligned" repair.

Use when:

- The user gives a reference video or asks to replicate, align, compare, or
  verify a remake.
- A candidate video is judged "not aligned".

Output contract:

- `workflow/reference-alignment/alignment-report.md`
- `workflow/reference-alignment/reference-frames/`
- `workflow/reference-alignment/candidate-frames/`
- `workflow/reference-alignment/side-by-side-contact/`
- `workflow/reference-alignment/comparison.json`
- `workflow/reference-alignment/comparison-report.md`

Fidelity rules:

- Pixel-level requires byte-identical stream evidence, PSNR infinity, or SSIM
  1.0. Do not claim pixel-level for a hand-authored HTML/HyperFrames render
  unless those metrics pass.
- Visual-level requires side-by-side review at the declared sampling interval,
  usually 0.5s for fast motion and 1.0s for slower work.
- Style-level extracts palette, typography, motion grammar, component motifs,
  and rhythm. It does not require frame timing unless the user requests a
  remake.

Repair report fields:

- Failing timestamp or range.
- What the reference shows.
- What the candidate shows.
- Required change.
- Mismatch class: timing, layout, asset, typography, color, animation, or
  encoding.

Planner capability card:

- Capability type: reference-video analysis and alignment QC, not a generation
  style.
- Planner trigger: user supplies a reference video, asks for "same as",
  "replicate", "align", "compare", "not aligned", "pixel-level", "visual-level",
  or wants evidence for whether a remake matches.
- Selection strength: mandatory before promising pixel-level or visual-level
  fidelity; optional for style-level inspiration when no candidate exists.
- Borrowable design controls: fidelity-level classification, fixed-interval
  frame extraction, side-by-side contact sheets, mismatch taxonomy, timestamped
  repair list, PSNR/SSIM/hash gates for hard claims.
- Planner rejection signal: ordinary original video creation with no reference
  target; use normal template/style planning instead.

## Planner Routing Summary

The planner should treat these borrowed capabilities as optional adapters:

| Capability | Best scene/job fit | Planner should use it when | Planner should avoid it when |
| --- | --- | --- | --- |
| `typed-black-white-opener` | Opening title, title-state change, branded lead-in | The brief explicitly asks for an opener/typing/black-white title, or the production contract records a deliberate pre-roll | The video should start directly with narration/content, especially short-form vertical hooks |
| `dark-saas-magic-ui` | SaaS/product/tool/AI workflow demo | Product facts, UI/state changes, capability beats, or export/integration objects are central to the message | The topic is education, story, documentary, data-newsroom, or not product-shaped |
| `reference-video-alignment-qc` | Reference remake review and repair | A reference video exists, alignment is requested, or fidelity claims need evidence | The task is original style creation with no reference candidate |

Planner output fields when any capability is considered:

- `capabilityId`: one of the capability ids above.
- `decision`: `selected`, `rejected`, or `borrow-controls-only`.
- `rationale`: why this capability fits or does not fit the brief.
- `borrowedControls`: specific reusable controls, such as CTA transform,
  side-by-side QC, typing cadence, or capability ring.
- `rejectedControls`: tempting but inappropriate controls for this run.
- `risk`: license, topic-fit, unsupported-claim, delayed-hook, or
  reference-fidelity risk.
- `qcAdditions`: only the extra checks this capability introduces.

## Integration Rule

These increments expand the template and QC vocabulary only. They do not weaken
existing required artifacts: local CosyVoice/MeloTTS policy, subtitle cue
integrity, direct-first-scene default, cover variants, visual relevance audit,
visual rhythm plan, rights record, delivery page, and final QC evidence all
remain mandatory.
