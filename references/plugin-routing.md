# Plugin Routing Rules

Plugins are capability slots, not quality substitutes. A video package may use
HyperFrames, Remotion, GSAP, data visualization, Creative Production, Product
Design, Website-to-HyperFrames, Registry components, or Canva only when the
selected capability is bounded by `codex-video-workflow` artifacts and QC.

## Required Contract

Every final-quality run must write:

- `workflow/plugin-routing-contract.json`
- `workflow/quality-consistency-contract.json`
- `workflow/external-capability-fusion-plan.json`
- `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-creator-native-jobs.json`, and `workflow/ip-diagram-layout-audit.json` when explicit IP diagram routing, personal-IP, creator-persona, knowledge-card, Agent-collaboration, native IP diagram generation, PPT/course page routing, or creator-led teaching with a strong IP/diagram signal is active
- `workflow/content-presentation-design.json`
- `workflow/motion-template-selection.json`
- `workflow/voice-direction.json`
- `workflow/sync-timecode-plan.json`
- `workflow/cover-design.json`
- `logs/qc.json`

`workflow/plugin-routing-contract.json` must state:

- `governor: "codex-video-workflow"`
- `rule: "plugins-are-capabilities-not-quality-substitutes"`
- every available video/plugin capability and whether it is active
- the framework artifacts that constrain each active capability
- the disallowed shortcuts that would bypass script, timing, rights, or QC

## Routing

| Signal | Capability |
| --- | --- |
| final motion-rich HTML video | HyperFrames, HyperFrames CLI, GSAP |
| HTML motion templates need stronger deterministic motion | Remotion-style frame-driven progress, easing, transition accounting, and text-animation primitives |
| reusable video block/component requested | HyperFrames Registry |
| URL, landing page, or site source | Website-to-HyperFrames |
| `chartData` or analytical visual scenes | build-web-data-visualization |
| authorized raw footage, clip folders, source video paths, or remix/edit requests | Video-Use-style source inventory, word-level transcript index, packed transcript reading surface, word-boundary EDL, cut-boundary QC, and audio/color normalization plan |
| batch variants, series templates, repeated reusable scenes, or `templateProps` | Remotion-style typed props, variant render plan, and reusable scene contracts |
| reference video supplied or fidelity/alignment claimed | reference-video alignment QC with sampled frames, contact sheets, and labeled fidelity level |
| explicit IP diagram route, personal IP, creator persona, hand-drawn knowledge card, Agent collaboration diagram, PPT/course/livestream page system, creator-led teaching with a strong IP/diagram signal, native IP diagram generation, or native-final IP diagram video | ip-diagram-creator native-final visual engine, primary teaching planner, direct native source-generation route, director/page cards, character visual DNA, role-asset policy, prompt contract, layout audit, and QA repair checklist |
| media recovery, compression, loudness, silence, black frames, stream mismatch | FFmpeg-style probe/filter/QC recipes |
| multi-stage or long-form agentic production | OpenMontage-style stage gates and post-render self-review |
| visual direction, scene imagery, cover promise | Creative Production |
| product UI, app flow, prototype, or screen demo | Product Design |
| editable social/deck/marketing collateral | Canva |

## Quality Rule

Selecting a capability is not enough. The run passes only when:

- the capability is recorded in `workflow/plugin-routing-contract.json`;
- active capabilities set `boundedByFramework: true`;
- active capabilities set `directQualitySubstitute: false`;
- active capabilities reference `workflow/quality-consistency-contract.json`;
- Remotion motion usage is recorded as `remotionMotionPrimitives` in
  `workflow/motion-template-selection.json` and mirrored on scene components in
  `workflow/motion-grammar-plan.json`;
- borrowed external capabilities are recorded in
  `workflow/external-capability-fusion-plan.json` with trigger, active state,
  required evidence, and rejected whole-stack adoption records;
- active ip-diagram-creator routing is recorded in
  `workflow/ip-diagram-creator-plan.json` with source repo/commit,
  `plannerDriver`, director/page-card evidence when primary, role-asset policy,
  scene assignments, prompt text-ownership rules, execution modes, native-final
  visual-engine ownership when selected, native direct use policy, and QA
  checklist;
- active ip-diagram-creator routing also writes
  `workflow/ip-diagram-creator-native-jobs.json` and
  `workflow/ip-diagram-layout-audit.json` so Planner can call the native
  framework for source images, select it as the native-final visual engine, or
  use the integrated HTML renderer without overlapping cards/Agents;
- `logs/qc.json` passes `pluginRoutingContractPresent` and
  `pluginRoutingContractEnforced`;
- the final package passes
  `scripts/validate-plugin-routing-contract.mjs --out <output-dir>`.

## Anti-Shortcuts

Fail the run when a plugin is used to skip any of:

- original script and storyboard;
- visual identity and presentation design;
- actual TTS-bound timing;
- caption-safe layout;
- rights and source records;
- cover click logic;
- screenshots, media logs, and QC scorecard.
- raw-footage inventory, rights proof, edit decision list, and cut-boundary QC
  when footage editing is active;
- raw-footage transcript index, packed transcript surface, word-boundary map,
  source-media normalization plan, subtitles-last render-order rule, and
  overlay PTS alignment rule when footage editing is active;
- props schema and variant render plan when batch/template parameterization is
  active;
- Remotion frame/progress/easing evidence when stronger template motion is
  claimed;
- sampled-frame comparison and fidelity-level labeling when reference alignment
  is claimed.
- private role assets or user screenshots copied into the public Skill package;
- generated personal-IP diagram bitmaps used as the only owner of final Chinese
  claims, subtitles, labels, or metrics.
- native ip-diagram-creator generation used to bypass timing, subtitles, covers,
  rights records, or QC;
- native-final IP diagram video blended into the current framework headline/body
  card layout instead of owning the full visible frame;
- IP diagram cards, arrows, persona, or Agent nodes rendered with overlapping
  free-positioned layout instead of a verified grid/region contract.
