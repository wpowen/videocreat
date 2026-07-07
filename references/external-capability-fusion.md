# External Capability Fusion

Use this reference when borrowing ideas from external video-production tools such as HyperFrames, FFmpeg skills, OpenMontage, Remotion skills, Video-Use, Manim, or similar agent-oriented video stacks.

The rule is narrow: use only capabilities that improve `codex-video-workflow` and can be verified inside its existing artifacts. Some external tools can remain directly callable as a source-generation route, but they still need local evidence, rights boundaries, and final-video QC when their output enters this workflow. Do not copy another project's full workflow, private assets, or dependency stack.

## Fusion Plan

Every final-quality run writes `workflow/external-capability-fusion-plan.json`.

Required shape:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-external-capability-fusion",
  "governor": "codex-video-workflow",
  "rule": "borrow-capabilities-not-frameworks",
  "capabilities": [
    {
      "id": "ffmpeg-professional-qc",
      "borrowedFrom": ["FFmpeg skill patterns"],
      "active": true,
      "trigger": "every final package",
      "whatWeBorrow": ["media probe", "audio loudness", "silence/black detection", "recovery encode recipes"],
      "frameworkOwner": "codex-video-workflow",
      "requiredEvidence": ["logs/ffprobe.json", "logs/volumedetect.log", "logs/silencedetect.log", "logs/blackdetect.log"]
    }
  ],
  "rejectedWholeStackAdoptions": [
    {
      "source": "OpenMontage",
      "reason": "borrow pipeline gates and edit/QC ideas, not the full dependency/runtime stack"
    }
  ]
}
```

## Borrowable Capabilities

| Source family | Borrow | Trigger | Required artifacts | Do not borrow |
| --- | --- | --- | --- | --- |
| FFmpeg skill patterns | probe, stream metadata, loudness/silence/black checks, scene/contact-sheet probes, conservative re-encode recipes | every final package, recovery, or media ingest | `logs/ffprobe.json`, `logs/volumedetect.log`, `logs/silencedetect.log`, `logs/blackdetect.log`, optional `workflow/media-diagnostics-plan.json` | one-off command snippets without recorded intent/output |
| OpenMontage-style agentic production | stage gates, capability inventory, pre-compose validation, post-render self-review, slideshow-risk checks | complex videos, raw-footage edits, multi-source packages, long-form runs | `workflow/production-plan.json`, `workflow/external-capability-fusion-plan.json`, `workflow/quality-consistency-contract.json` | full orchestration replacement or license/runtimes copied into this skill |
| Video-Use-style footage editing | raw-footage inventory, cached word-level transcript index, packed transcript reading surface, word-boundary edit map, transcript/scene-aware EDL, cut-boundary self-review, b-roll/overlay plan, color/audio normalization plan, subtitles-last / overlay-PTS render-order rules | user supplies authorized clips or asks for remix/cut/edit from existing footage | `workflow/raw-footage-inventory.json`, `workflow/raw-transcript-index.json`, `workflow/takes-packed.md`, `workflow/word-boundary-map.json`, `workflow/edit-decision-list.json`, `workflow/cut-boundary-qc.json`, `workflow/source-media-normalization-plan.json` | unauthorized media, platform downloads without rights, voice cloning, cloud-only defaults, making ElevenLabs/Scribe or any cloud ASR the default path |
| HyperFrames-style render inspection | lint/validate/inspect before trusting motion templates, deterministic render loop, preview screenshots | HTML motion templates, HyperFrames fallback, template changes | `workflow/motion-template-selection.json`, `logs/html-motion-validation.json` or equivalent screenshots | treating HyperFrames as full editor/NLE |
| Remotion-style motion primitives | frame-driven progress, interpolate/easing vocabulary, transition duration accounting, deterministic text reveal rules | any HTML motion template or reusable scene component that needs stronger motion discipline | `workflow/motion-template-selection.json`, `workflow/motion-grammar-plan.json`, `logs/qc.json` | React/Remotion migration without a renderer migration plan |
| Remotion-style props/templates | typed props contract, reusable scene components, batch variants, deterministic parameterized render inputs | repeated video series, variants, programmatic product/data templates | `workflow/template-props-contract.json`, `workflow/variant-render-plan.json` when variants exist | props that own timing, rights, voice, cover logic, or QC |
| Manim-style math/physics inserts | formula-driven path, geometry proof, parametric motion, physics/vector relationship | formula, geometry, physical path, or parametric relationship scenes | `workflow/data-motion-plan.json` or scene insert manifest, keyframes, ffprobe for inserted clip | general charts that simple HTML/D3 can handle |
| Galacean Effects / effects-runtime | particle systems, fireworks, 2D/3D visual effects, energy beams, scan/focus effects, texture/video planes, effect-layer playback, and optional Three.js-style depth integration as bounded scene layers | explicit visual-effects/particle/firework/2D/3D request, premium hook/reveal/transition/payoff, product activation moment, risk scan, or abstract spatial metaphor that benefits from an effect layer | `workflow/galacean-effects-plan.json`, `assets/galacean-effects-capability-catalog.json`, `workflow/visual-asset-manifest.json`, `workflow/motion-template-selection.json` or `workflow/motion-style-template-selection.json`, pre/peak/post screenshots, motion-difference evidence, `logs/galacean-effects-qc.json` or `logs/qc.json` booleans | whole renderer replacement, persistent decorative loops, unknown public demo assets, final exact Chinese text inside WebGL/canvas textures, subtitle layer ownership, or effects covering key proof/data text |
| Whiteboard-style layered reveal | hand/stroke reveal, rough marker texture, semantic foreground draw order, sketch-to-color component reveal | whiteboard/marker/sketch request, process/tutorial/system-map scene, or floating UI/cards/images that benefit from hand-drawn reveal | `workflow/whiteboard-layered-reveal-plan.json`, `workflow/layered-composite-render.json`, `assets/whiteboard-floating-elements-lineart.*`, screenshots, `logs/qc.json` | full renderer replacement, plain white board as default, whole-background tracing, subtitle layers, final readable text owned only by stroke line art |
| ip-diagram-creator | video-level native-final visual engine, primary teaching visual planner route, director plan, page cards, personal-IP role extraction, white-canvas hand-drawn character/Agent visual DNA, content-first diagram modes, Agent collaboration grammar, PPT director/page cards, native direct-generation jobs, layout non-overlap contract, role/style QA repair checklist | explicit IP diagram route, personal IP, creator persona, knowledge card, hand-drawn diagram, Agent collaboration diagram, course/PPT/livestream page system, creator-led teaching brief with a strong IP/diagram signal, or explicit native-final IP diagram video request | `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-creator-native-jobs.json`, `workflow/ip-diagram-layout-audit.json`, `workflow/design-plan.json`, `workflow/motion-template-selection.json`, `workflow/image2-prompts.json`, `workflow/visual-asset-manifest.json`, `workflow/quality-consistency-contract.json` | timing/voice/subtitle/QC bypass, hard blending into the existing template when native-final is selected, copied examples/assets, private role assets in the public Skill package, exact Chinese text delegated to generated bitmaps, overlapping card/Agent layouts |
| Engagement-prediction research | multimodal pre-publish audit, independent visual/audio/text findings, relative variant ranking, model-card claim boundary | user asks for virality, views, likes, engagement, publish-readiness prediction, or generated-video variant ranking | `workflow/engagement-prediction-plan.json`, `workflow/engagement-feature-audit.json`, `workflow/engagement-model-card.md`, optional `workflow/engagement-variant-report.md` | exact views/likes promises without a current evaluated model, copying unlicensed predictor code or weights, treating engagement prediction as a substitute for video QC |

## Planner Decision Rules

1. Start from the current framework's requirements: script, storyboard, timing, visual design, local voice, subtitles, covers, rights, delivery page, QC.
2. Ask which external capability removes a real weakness:
   - missing media inspection or recovery recipe -> FFmpeg professional QC;
   - too many stages with unclear ownership -> OpenMontage-style stage gates;
   - user-provided footage needs real editing -> Video-Use-style transcript-first edit plan;
   - reusable templates need motion discipline -> Remotion-style motion primitives;
   - variants or series templates need parameter discipline -> Remotion-style props contract;
   - HTML motion is hard to trust visually -> HyperFrames-style inspect loop;
   - formula/physics/geometric relation needs real math motion -> Manim insert.
   - visual effects, particles, fireworks, 2D/3D effect layers, magical UI accents, risk scans, premium transitions, or payoff moments are requested or scene-justified
     -> Galacean visual-effects layer with `workflow/galacean-effects-plan.json`, catalog-backed selected/rejected effects, placement/layer rules, asset rights, deterministic fallback, and screenshot/motion evidence.
   - a process/tutorial/system-map scene needs hand-drawn reveal over the current designed background
     -> whiteboard layered reveal with subtitles topmost and only semantic foreground groups drawn.
   - explicit IP diagram route, personal-IP, creator persona, knowledge-card, Agent collaboration diagram, PPT/course page planning, creator-led teaching with a strong IP/diagram signal, or native-final IP diagram video is requested
     -> ip-diagram-creator capability portfolio with `plannerDriver`, selected execution mode, director plan, page cards, character visual DNA, role-asset policy, native jobs, layout audit, scene assignments, prompt contract, and QA checklist. If `native-final-video` is selected, do not blend it into the existing framework layout.
   - user asks whether the generated video will get views, likes, or viral reach
     -> engagement-prediction audit with exact-metric claim limits.
3. Activate the smallest capability that covers the scene; do not activate the whole source project.
4. Record the active capability, trigger, evidence paths, and rejected full-stack shortcut in `workflow/external-capability-fusion-plan.json`.

## Verification Gates

A borrowed capability is considered fused only when:

- it has a named trigger and active/inactive decision;
- it lists the external source family and the local framework owner;
- it produces or references local evidence artifacts;
- it is bounded by `workflow/quality-consistency-contract.json`;
- it does not bypass local TTS, subtitle timing, cover logic, rights records, or delivery/QC.
- if it is Galacean/effects-runtime, it keeps subtitles and exact text outside the effect layer, records selected and rejected effects in `workflow/galacean-effects-plan.json`, and proves asset rights plus caption-safe placement.

Hard failures:

- "using" an external tool only as a label with no local artifact;
- importing a full external stack when a small rule/template/validator would solve the gap;
- raw-footage remix without rights and source inventory;
- generated edit decisions with no word-boundary transcript evidence, output-timeline EDL, and cut-boundary review;
- cloud transcription treated as default instead of explicit opt-in;
- HTML motion with no frame/progress/easing primitive contract;
- parameterized templates with no props schema or variant plan;
- media recovery with no before/after probe evidence;
- whiteboard reveal that covers subtitles, replaces the framework background with a plain white board, traces the whole scene, or makes stroke line art the only readable final text;
- Galacean/effects-runtime used as a full video renderer, used as a generic decoration loop, used with unknown effect assets, used without `workflow/galacean-effects-plan.json`, or used in a way that covers subtitles/data labels/source notes/key proof text;
- teaching/personal-IP/PPT/knowledge-card routing without `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-creator-native-jobs.json`, `workflow/ip-diagram-layout-audit.json`, `plannerDriver`, director/page-card evidence when primary, character visual DNA, authorized role-asset policy, prompt text-ownership rule, layout non-overlap evidence, or rejected final-MP4-bypass boundary.
