# Content Presentation Design

Use this reference before rendering any video with on-screen explanatory UI, captions, diagrams, cards, or lesson content.

## Research Anchors

Current design guidance converges on four useful rules:

- Nielsen Norman Group describes visual hierarchy as guiding the eye to the most important elements through color, contrast, scale, and grouping.
- Nielsen Norman Group visual design guidance emphasizes grid alignment, clear hierarchy, intentional color, and consistency.
- Material Design motion guidance says motion should highlight relationships, available actions, and outcomes.
- Apple Human Interface Guidelines typography guidance emphasizes legibility, hierarchy, important content, and brand/style expression.

Turn these into workflow requirements, not decoration.

## Required Artifact

Every final-quality run must write `workflow/content-presentation-design.json` before rendering. It must include:

- `topicType`: the subject class, such as `writing-method`, `tutorial`, `news-analysis`, `product-demo`, `story`, or `documentary`.
- `audienceState`: what the viewer knows, wants, and may misunderstand.
- `contentJobs`: the ordered jobs the interface must perform, such as hook, define, compare, model, example, checklist, warning, summary.
- `informationHierarchy`: primary, secondary, tertiary, caption, and progress/status layers.
- `displayLogic`: how ideas are grouped, sequenced, compared, and revealed.
- `visualMetaphor`: the topic-specific metaphor system, not generic decoration.
- `layoutSystem`: grid, safe zones, focal balance, caption area, and density limit.
- `viewerFramePolicy`: visible page content only. Do not reserve pixels for page numbers, scene counters, renderer/library names, capability labels, or process badges; those may appear in review artifacts outside the simulated video frame only.
- `palettePolicy`: a topic-specific premium material palette with contrast evidence. Avoid generic default app-blue/app-teal, flat commodity colors, candy gradients, or one-note color families unless the brief explicitly asks for that style.
- `motionPurpose`: what movement explains or reveals.
- `syncContract`: how scene changes, captions, progress, and diagrams are tied to narration time rather than independent estimates.
- `coverContinuity`: how the cover promise is paid off in the opening seconds and carried into the first visual system.
- `aestheticBar`: professional, premium, topic-appropriate quality criteria.
- `rejectList`: concrete failures that would make the render feel cheap, generic, crowded, or PPT-like.

Every final-quality run must also write `workflow/page-decision-contract.json`. `content-presentation-design.json` owns the whole-video presentation system; `page-decision-contract.json` owns the per-page audit surface. For each page/scene it must answer:

- What content appears on this page.
- How that content is designed.
- How interaction/state is represented in the rendered MP4.
- How animation is selected, triggered, and timed.
- Which layer owns the content, design, interaction, animation, render, and QC decisions.
- Which layer guarantees that text, visuals, captions, page controls, and any progress/status affordance do not overlap. If the page needs progress, represent it as audience-facing story state, not as a literal page number or internal scene counter.

Every final-quality run must also write `workflow/retention-structure-contract.json`. The presentation design contract answers "how the viewer understands the idea"; the retention contract answers "why the viewer keeps watching." The two artifacts must agree on first-frame promise, cover continuity, visual subject, proof surface, rhythm, progress, and ending payoff.

When semi-auto/custom mode is active, the page audit surface must also expose TDS editing:

- `T`: text/content, including primary message, support copy, narration beat, and exact on-screen text.
- `D`: design/layout, including visual metaphor, composition, theme, typography, and inserted visual material.
- `S`: subtitle/style, including selected caption style, safe area, emphasis, and timing binding.

The configuration surface is outside the final MP4. It may show operator choices, but simulated video frames inside it must still obey viewer-frame policy.

## Display Logic By Content Type

| Topic type | Primary display logic | UI pattern | Motion role |
| --- | --- | --- | --- |
| `writing-method` | Show invisible narrative structure as contracts, ledgers, pressure, choices, and payoff | editorial story lab, manuscript desk, annotated cards, relationship threads | reveal causal links, mark debts paid/opened, show transformation |
| `tutorial` | Step, action, result, proof | command panel, checklist, before/after, zoomed operation surface | guide attention from step to result |
| `professional-explainer` | Claim, evidence, model, implication | evidence board, model canvas, concise chart/card system | disclose hierarchy and connect evidence to conclusion |
| `news-analysis` | Fact, timeline, cause, consequence, uncertainty | timeline, source stack, map/data card, risk bands | distinguish confirmed fact from inference |
| `product-demo` | Problem, product action, benefit, proof | product surface, callout pins, metric/result cards | connect action to outcome |
| `story/documentary` | Scene, object, tension, reveal | cinematic scene layers, object detail, atmosphere, minimal labels | create pace, anticipation, and reveal |

## Quality Rules

- One scene should have one main idea, one support idea, and one visible reason to keep watching.
- Every scene should also appear in `workflow/retention-structure-contract.json` with a RETAIN role, visual subject, evidence type, continuation reason, and progress/payoff cue.
- The biggest element must be the idea viewers should notice first.
- Captions are a first-class layer. They must not disappear, collide with UI, or be replaced by vague scene summaries.
- Dense narration should be chunked into readable subtitle units, not full paragraphs.
- Long narration needs a single timecode source. Do not let main scene cards, subtitles, and progress bars use separate timing assumptions.
- The cover is part of the content presentation system. It should state the same promise the first scene starts to pay off.
- Motion must be semantic: it should reveal grouping, causality, transformation, or progression.
- Premium does not mean more decoration. It means stronger hierarchy, better spacing, deliberate contrast, cleaner typography, richer metaphor, and fewer arbitrary elements.
- Every visible word must be for the target viewer, not for the operator or the production log. Do not place workflow status, execution constraints, renderer/QC labels, rights disclaimers, file paths, or format notes in the final video image unless the creative brief explicitly makes those words part of the audience-facing message.
- Final screenshots must be reviewed for hierarchy, density, caption readability, and topic-fit, not only for nonblack frames.
