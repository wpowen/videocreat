# IP Diagram Creator Integration

This reference records the controlled integration path for ideas borrowed from `haloshin/ip-diagram-creator`.

Source snapshot:
- Repository: `https://github.com/haloshin/ip-diagram-creator`
- Inspected commit: `dd64ab5d972893f7ca271d9c560362d7788eb2d6`
- Release surface: `v0.2.0`, including PPT presentation mode
- License: MIT

Vendored source:
- Local path: `vendor/ip-diagram-creator/`
- Entrypoint: `vendor/ip-diagram-creator/SKILL.md`
- Source manifest: `vendor/ip-diagram-creator/VENDORED_SOURCE.json`
- Required upstream references: `vendor/ip-diagram-creator/references/identity-and-character.md`, `visual-language.md`, `content-workflow.md`, `modes-and-sizes.md`, `ppt-presentation-mode.md`, `prompt-templates.md`, `qa-repair.md`, and `safety-and-assets.md`
- Run evidence: every active route must write `workflow/ip-diagram-creator-vendor-usage.json` proving the local vendored Skill entrypoint, pinned source metadata, required references, hashes, and prompt-template availability. Do not claim `haloshin/ip-diagram-creator` use from this workflow if that artifact is missing or fails QC.

## Integration Boundary

Use it as a Planner-routed capability portfolio, not as a forced replacement. Planner may choose one of four video-level routes: keep the existing `codex-video-workflow` design logic, use `ip-diagram-creator` as a full native-final visual engine, use its visual DNA inside the current HTML renderer, or preserve a native direct-generation handoff for role sheets/source-plate images. Do not hard-blend it into every video. Personal-IP requests activate the `ip-diagram-creator` primary route, fixed/default persona binding, vendored Skill usage, native source jobs, native-final page provenance, and rendered-frame QC. For personal-IP video requests, `native-final-video` is mandatory: if verified native page provenance is missing, the workflow must stop before final MP4 composition and generate or ingest native pages first. It must not deliver a personal-IP final video through deterministic HTML/SVG/CSS imitation.

`ip-diagram-creator` is useful when a brief asks for a personal IP role, creator persona, hand-drawn explainer diagrams, knowledge cards, Agent collaboration diagrams, course/PPT/livestream pages, or a creator-led teaching visual system.

Planner may select it as the primary teaching visual-planning route for creator-led course, tutorial, lesson, methodology, explainer, PPT, livestream, or knowledge-transfer videos when the brief also carries an explicit IP/diagram/PPT/knowledge-card/Agent route signal. In that route it may own the director plan, page cards, diagram mode, Agent/helper role plan, visual weight, layout variant, motion-template hint, Image2/source-plate prompt contract, native job prompts, and non-overlap layout contract for each scene.

Do not use it as a global default house style for every video. Do not copy its example images, sample layouts, private role assets, or public package assets into generated projects.

Execution modes:
- `native-final-video`: `ip-diagram-creator` owns the final visible frame design for the whole video: page cards, white-canvas hand-drawn board, adult presenter, concrete execution Agents, and diagram layout. `codex-video-workflow` only wraps voice/subtitles, timing, MP4 export, cover/package, rights records, and QC. When native generated pages are used as final frames, they must render full-screen with a fixed base transform: no inset page, border, drop shadow, wrapper card, per-cue crop, push-in, zoom, pan, or vertical offset.
- `integrated-html-video-composition`: current workflow composes non-personal-IP videos while using IP diagram planner/page cards, fixed/default persona assets, native source jobs, and white-canvas hand-drawn character/Agent language. It is forbidden as the final deliverable route for personal-IP video.
- `native-skill-direct-generation`: Planner may call or hand off to the original `haloshin/ip-diagram-creator` route for character sheets, knowledge cards, PPT page images, or source plates before video assembly. For personal-IP requests this mode must be planned and audited as source generation feeding `native-final-video`; it must not feed integrated personal-IP final composition.
- `standalone-source-page-set`: the Skill generates or prepares a portrait `9:16` or horizontal `16:9` personal-IP knowledge-card/page image set using the same visual DNA. This is for image review, source page creation, posters, or a future native-final video page set. It must write a min/max image-count plan, prompt/job list, contract, manifest, and QC package, and may ingest the full Codex `image_gen` bitmap set after generation.
- `prompt-only-native-handoff`: when image generation is unavailable or a human review step is needed, write native-compatible prompts and repair prompts without claiming generation happened.

The native-final route can be used directly when it is better suited to the requested teaching diagram. In that route, final frames should be full IP diagram pages rather than a mix with the current framework headline/body card layout.

## Planner User Choices

For this route Planner must expose two user-facing choices, and record the resolved values in `workflow/ip-diagram-creator-plan.json`:

- `makePersonalIp`: `on | off | auto`. `on` or `auto` means the single fixed-persona personal-IP chain is active: the run must resolve one saved user-material-library persona manifest before final personal-IP delivery. `off` keeps the page/director route but does not request a role/persona asset.
- `addHandDrawnImageAnimation`: `off | subtle | draw-reveal`. This controls only foreground hand-drawn marks, progress strokes, semantic highlights, or reveal accents. It must never move, crop, scale, bounce, or redraw the generated page itself.
- `personalIpAssetRegistry`: a user-material-library manifest path. If a saved user-specific persona exists, it must be reused before any new persona generation. If no user-specific persona or authorized input is provided, use the fixed default non-likeness hosts under `~/.codex/video-workflow/user-assets/personal-ip/generic-hosts/{male,female}/manifest.json` and record `doNotClaimUserLikeness`. The default host gender must follow the actual package audio gender after audio generation/reuse/provided-audio normalization: `workflow/voice-subtitle-manifest.json.audioGender: "female"` uses the female host manifest, `"male"` uses the male host manifest. For local TTS, derive this from the actual selected backend speaker/default voice metadata, not only the pre-audio brief. For user-provided audio, require `brief.audioGender` / `brief.voiceGender` or `--audio-gender` when the gender is not otherwise recorded. If the user requires their own likeness, the semi-auto configuration page must guide them to provide an authorized photo, avatar, character sheet, or existing manifest and create it once.

The old framework-drawn personal-IP presenter template is retired. Final personal-IP video frames must not render `ip-persona-svg`, `template-fallback`, or any locally invented presenter as the personal IP. The active route must bind a fixed manifest-backed persona: either a saved user-specific manifest or the default male/female non-likeness host manifest. When native-final is selected, verified native page images with `image_gen`/`source_generated_image` provenance are required. When native-final is not selected, integrated composition must still render `fixed-persona-manifest` evidence in the HTML frames and must not use the retired local SVG/template fallback.

Recommended teaching default: `makePersonalIp: "auto"` and `addHandDrawnImageAnimation: "subtle"` for creator-led explainer videos. User-provided explicit choices override the default.

## Stable Full-Screen Native Page Contract

When `native-final-video` consumes pages produced by the original Skill route:

- Treat a "native page" as an official direct-generation/image_gen page asset, or an explicitly user-approved imported final page asset, with page-card metadata and provenance. For generated pages, the manifest must preserve `source_generated_image` or equivalent native-generation evidence per final content page.
- Deterministic PIL/SVG/HTML placeholder pages, wireframes, local layout sketches, or framework-drawn replicas are planning drafts only. They must not be labeled `native-final-video`, passed to `render-ip-diagram-native-pages.mjs` as final pages, or described as official Skill outputs unless the package is explicitly marked draft/degraded.
- If the contact sheet reads as cheap PPT, sparse wireframe, low-detail template, or decorative persona over empty boxes, stop the MP4 assembly and repair/regenerate the pages through the original native Skill route. Do not hide the problem by wrapping those pages in video motion or subtitles.
- Render each generated page as the whole target canvas, using a single deterministic cover/fit transform for that page. Horizontal native-final output is `1920x1080` / `16:9`; vertical personal-IP native-final output is `1080x1920` / `9:16`.
- For vertical personal-IP output, native pages must be generated as portrait pages. Do not crop, squeeze, letterbox, or mask a horizontal `16:9` page into a vertical MP4 and call it竖屏.
- Vertical personal-IP pages must reserve mobile-safe space: the top `220px` of a `1080x1920` canvas is a clean blank band for mobile status/navigation UI, page titles and key claims begin below that band, the IP presenter remains visibly involved in the teaching action, knowledge cards stack vertically, execution Agents stay in small support lanes, and bottom subtitles keep a clear protected band.
- Do not place the page inside a card, browser frame, shadowed panel, matte, border, or decorative wrapper.
- Do not create visual rhythm by changing the page crop, zoom, pan, x/y offset, or scale per subtitle cue.
- If the page itself is static, keep its base pixels stable for the whole page window. Rhythm may come from page changes, subtitles, progress indicators, hand-drawn foreground strokes, reveal masks, highlights, or other foreground-only animation.
- Hand-drawn animation must be layered above the stable page and below subtitles. It may draw arrows, underlines, circles, marker strokes, or semantic reveals, but it must not cover subtitle safe areas or become the owner of final readable text.
- If a native generated page has overlapping cards/characters/arrows, regenerate or repair that page through the native Skill route before video assembly. Do not hide overlap by shrinking the page into a bordered frame.

The reusable executor for this route is:

```bash
node .agents/skills/codex-video-workflow/scripts/render-ip-diagram-native-pages.mjs \
  --pages-dir <native-skill-content-pages> \
  --audio <framework-audio-file> \
  --subtitles <framework-subtitles.srt> \
  --out <output-dir> \
  --aspect 16:9 \
  --personal-ip auto \
  --hand-drawn-animation subtle
```

Vertical native-final personal-IP render:

```bash
node .agents/skills/codex-video-workflow/scripts/render-ip-diagram-native-pages.mjs \
  --pages-dir <native-skill-portrait-content-pages> \
  --audio <framework-audio-file> \
  --subtitles <framework-subtitles.srt> \
  --out <output-dir> \
  --aspect 9:16 \
  --personal-ip auto \
  --hand-drawn-animation subtle
```

The executor rejects unverified native pages by default. `--allow-unverified-native-pages true` is allowed only for local draft/degraded review packages and must not be used for a claimed final delivery.
For personal-IP native-final delivery, the executor also rejects a page set outside the native-page count range and below the source package's automatic duration/content/cue policy. The default range is 4-48 pages for video assembly. A higher explicit max is allowed only when the script has enough clear narration beats to justify it. One static page may be rendered only as an explicitly degraded draft and will fail final QC.

## Standalone Personal-IP Image Contract

When the user asks for a个人 IP 图解图片、竖屏知识卡样张、横屏图解页、手机海报式个人 IP 图解、or asks to preview the IP page before video assembly, use the standalone source-page route. This route may use Codex built-in `image_gen` directly in the Codex app, GPT Image 2 through the API when explicitly configured, or prompt-only handoff when image generation is unavailable. Default aspect is vertical `9:16`; pass `--aspect 16:9` for horizontal images.

The route must never default to one image for personal-IP video source material. It computes `workflow/personal-ip-image-count-plan.json` before generation:
- Default minimum image count: 4.
- Default reasonable maximum image count: 48 for planning/package generation; this is a guardrail, not a target.
- Growth rule: split口播稿/内容 into sentence units, estimate the number of pages needed for clear explanation, apply bounded growth tiers for longer content, and apply duration/cue density floors before the max-image guardrail.
- Duration density rule: pass the actual `--duration-seconds` / `--audio-duration-seconds` / `--video-duration-seconds` and `--subtitle-cue-count` whenever the page set belongs to a video. Default target is one source page about every 30 seconds, plus one page per 4 subtitle cues. A 10-12 minute personal-IP video should normally resolve around 20-24 source pages or higher when the content has enough beats, not the 4-page minimum, even if the planning brief only contains a compact core idea. `--target-image-count` is an upper-level intent only; by default it is raised to the automatic target when it is too low and records `explicitTargetRaisedToAutomatic:true`. `--allow-under-count true` is a draft/degraded escape hatch and cannot feed a final native-page video.
- Matching rule: each generated image owns one contiguous口播/内容 beat, its own required text subset, and its own execution-Agent jobs. Do not compress the whole script into one all-purpose card.

Always create the package contract first:

```bash
node .agents/skills/codex-video-workflow/scripts/plan-vertical-personal-ip-image.mjs \
  --out <output-dir> \
  --aspect 9:16 \
  --persona-manifest ~/.codex/video-workflow/user-assets/personal-ip/generic-hosts/male/manifest.json \
  --title "个人IP图解" \
  --content-file <voiceover-or-script.txt> \
  --core-idea "<this image's teaching idea>" \
  --persona "<creator role summary only; fixed visual identity comes from the manifest>" \
  --required-text "个人IP图解;观点;拆解;行动" \
  --agent-jobs "搬运卡片;标记风险;递交结果" \
  --duration-seconds <actual-audio-or-video-seconds> \
  --subtitle-cue-count <cue-count-when-known> \
  --min-image-count 4 \
  --max-image-count 48
```

If `--persona-manifest` is omitted, the script must resolve the fixed default non-likeness host manifest from `~/.codex/video-workflow/user-assets/personal-ip/generic-hosts/<male|female>/manifest.json` according to audio gender first, then `--persona-gender` only when explicitly supplied as an override. Female audio maps to the female host; male audio maps to the male host. In full video runs, use the actual post-TTS / reused-audio / provided-audio value recorded in `workflow/voice-subtitle-manifest.json.audioGender`; brief-level gender is only a pre-audio hint and must be replaced when the generated backend reports a different actual voice. Pass `--audio-gender` / `--voice-gender` or `--audio-speaker` / `--voice-speaker` when the source audio gender is known outside the brief. The prompt and contract must record the resolved manifest path, role anchor image, visual anchors, `doNotClaimUserLikeness`, public Skill storage prohibition, `audioGenderBinding`, and `workflow/personal-ip-asset-registry.json`. Do not use a free-text persona description as the visual identity for final personal-IP output.

Then generate every image with Codex Context Image2 / `image_gen` from `workflow/context-image2-persona-page-requests.json`, not from the text prompt files alone. Each request attaches the same fixed persona context images to every page. The required context image is `main-anchor`, and it must be a clean presenter-only anchor image, not a full role sheet with Chinese labels, whiteboard examples, color swatches, multi-view thumbnails, or unrelated page content. Spec/action sheets may be optional supporting context only. Text-only file paths or visual-anchor prose are prompt drafts only and do not prove character consistency. The request manifest records `parallelGenerationPolicy`: pages may be generated with bounded concurrency, but only when every concurrent request binds the same required `main-anchor` context set and writes to its own expected output. Do not seed page 2 from page 1 or let each page invent a new presenter. Each generated page must preserve the fixed manifest-backed presenter while covering only its matched content beat. Keep the original generated images in the Codex image output directory. Copy/ingest the whole generated page set into the package and include `--persona-reference-bound true` only when the generation step really used those context images. The ingest step must reject `--source-images` when any path or file hash matches `main-anchor`, `sourceGeneratedImage`, role/spec sheets, style boards, or any other persona reference asset; these files are context/provenance only, not final page images:

```bash
node .agents/skills/codex-video-workflow/scripts/plan-vertical-personal-ip-image.mjs \
  --out <output-dir> \
  --aspect 9:16 \
  --persona-manifest ~/.codex/video-workflow/user-assets/personal-ip/generic-hosts/male/manifest.json \
  --title "个人IP图解" \
  --core-idea "<this image's teaching idea>" \
  --persona "<creator role summary only; fixed visual identity comes from the manifest>" \
  --required-text "个人IP图解;观点;拆解;行动" \
  --agent-jobs "搬运卡片;标记风险;递交结果" \
  --source-images "<page-01.png>;<page-02.png>;<page-03.png>;<page-04.png>" \
  --persona-reference-bound true
```

Required artifacts:

```text
workflow/vertical-personal-ip-image-contract.json
workflow/personal-ip-image-count-plan.json
workflow/vertical-personal-ip-image-image-jobs.json
workflow/context-image2-persona-page-requests.json
workflow/personal-ip-asset-registry.json
workflow/vertical-personal-ip-image-manifest.json
workflow/vertical-personal-ip-image-qc.json
prompts/vertical-personal-ip-image-prompt-index.md
prompts/vertical-personal-ip-image-pages/page-*.txt
images/<ingested-vertical-pages>.png
```

For horizontal output, the same script writes:

```text
workflow/horizontal-personal-ip-image-contract.json
workflow/personal-ip-image-count-plan.json
workflow/horizontal-personal-ip-image-image-jobs.json
workflow/context-image2-persona-page-requests.json
workflow/personal-ip-asset-registry.json
workflow/horizontal-personal-ip-image-manifest.json
workflow/horizontal-personal-ip-image-qc.json
prompts/horizontal-personal-ip-image-prompt-index.md
prompts/horizontal-personal-ip-image-pages/page-*.txt
images/<ingested-horizontal-pages>.png
```

When those pages are rendered as a native-final video package, the renderer must also write the normal cover surfaces:

```text
workflow/cover-design.json
workflow/cover-size-selection.json
workflow/context-image2-cover-requests.json
prompts/context-image2-covers/*.txt
cover/*
最终成品/评审级封面-非上传终版/*
```

The native-final route may derive review-grade cover drafts from the first native page, but it must still hand off missing upload-ready targets to Context Image2 through `workflow/context-image2-cover-requests.json`. A video-only native-final output is incomplete. Review covers plus pending Context Image2 requests are not final cover evidence; final QC must expose `coverNativeImage2Ready:true` only after at least one real native Image2/Codex cover target has been ingested as upload-ready.
When the main workflow has already written the core cover contract (`workflow/cover-design.json` with `defaultCoverEngine: "image2-integrated-typography-cover"` plus `workflow/context-image2-cover-requests.json` with provider `codex-context-image2` and tool `image_gen`), the native-final renderer must preserve those files. It may add `workflow/native-final-cover-review.json` and review-grade first-page cover images, but it must not overwrite the core cover design, Image2 prompt/QC chain, size selection, or Context Image2 request manifest.
The cover lane must start before native-final video assembly and before personal-IP missing-page blockers stop the video lane. A blocked personal-IP video package should still contain the core cover artifacts plus `workflow/cover-parallel-execution.json`; native-page review covers are additive continuity previews, not a replacement for the Skill cover design logic.

QC must pass `canvasPlanned1080x1920` for vertical packages or `canvasPlanned1920x1080` for horizontal packages, must pass `imageCountWithinRange`, `promptsMatchPlannedImageCount`, `fixedPersonaManifestPresent`, `fixedPersonaMainAnchorPresent`, `fixedPersonaStorageOutsidePublicSkill`, `contextImage2PersonaPageRequestsPresent`, `contextImage2RequestsUseFixedPersonaImages`, and `promptsIncludeFixedPersonaManifest`, and, when images are ingested, confirm the provided bitmap count matches the plan and every bitmap matches the requested orientation. Prompt-only source-page packages must remain `pending-context-image2-generation` and `pass:false`; they are handoff packages, not final native pages. For final personal-IP native pages, text-only references to a manifest path or visual-anchor prose are not sufficient: QC must also pass `fixedPersonaReferenceBindingConfirmed` and `fixedPersonaTextOnlyReferenceRejectedForFinal`, proving the main anchor or saved role asset was actually bound as image/context input to the generation step, or that the page set was explicitly user-approved as final. A default adult presenter is allowed for final non-likeness personal-IP output only when it comes from the fixed default host manifest and `doNotClaimUserLikeness` is recorded. User-specific likeness still requires an authorized saved manifest; pending authorized inputs stop at onboarding/config until saved.

For video delivery, QC must also scan rendered HTML frames. `fixed-persona-manifest` must appear for the expected personal-IP scenes, and `template-fallback` / `ip-persona-svg` must have a count of zero. This is a hard gate, not a warning.

## Borrowed Capabilities

| Capability | What We Borrow | Output Binding | Guardrail |
| --- | --- | --- | --- |
| `ip-diagram-primary-teaching-route` | Planner can choose IP diagram creator as the primary visual system for teaching/explainer runs; it writes a director plan and page cards before normal design/render | `workflow/ip-diagram-creator-plan.json`, `workflow/design-plan.json`, `workflow/motion-template-selection.json` | It drives planning and deterministic HTML composition only; renderer, voice, timing, subtitles, cover, rights, and QC stay framework-owned |
| `native-final-video-route` | Planner can choose IP diagram creator as the video-level final visual engine | `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-layout-audit.json`, `renders/final.mp4` | Do not blend with the current framework's left headline/body card; framework only wraps timing/export/package/QC |
| `ip-character-asset-brief` | Extract creator role identity before content diagrams; plan three role assets: main anchor, spec sheet, action/expression/small-scene | `workflow/ip-diagram-creator-plan.json`, `workflow/image2-prompts.json`, `workflow/visual-asset-manifest.json` | Only authorized user-provided identity materials; never promise real likeness reproduction |
| `ip-character-visual-dna` | Preserve the original visual language: white/near-white canvas, black hand-drawn line art, adult IP presenter, lots of whitespace, sparse red/orange/blue annotations, concrete execution Agents | `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-layout-audit.json`, `workflow/image2-prompts.json` | Do not copy example art; reimplement the design DNA in deterministic local compositions |
| `ip-diagram-shot-list` | Content-first mode selection and shot-list planning for long-form articles, courses, scripts, and old slide decks | `workflow/ip-diagram-creator-plan.json`, `workflow/content-presentation-design.json` | Scene visuals support the narration; exact Chinese text stays deterministic |
| `agent-collaboration-diagram` | Use 2-6 small execution Agents in method/process/risk/comparison scenes when they clarify a workflow | `workflow/ip-diagram-creator-plan.json`, `assets/visuals/*.svg` | Agents must have concrete jobs; no internal debug/workflow labels in final frames |
| `ppt-director-page-cards` | For course/PPT/livestream video, plan director cards before rendering pages: page type, communication task, visual weight, character role, QA risk | `workflow/ip-diagram-creator-plan.json`, `workflow/design-plan.json` | PPT page logic informs video scenes; it does not create static slide-only output unless explicitly requested |
| `ip-diagram-qa-repair` | QA order: role consistency, action core, content accuracy, mode match, readable text, style, privacy/safety | `workflow/quality-consistency-contract.json`, `logs/qc.json` | Missing asset authorization, copied public examples, or generated-image-only readable text is a failure |
| `native-skill-direct-generation-route` | Preserve direct/native use of the original framework for role sheets, source plates, knowledge cards, and PPT page images | `workflow/ip-diagram-creator-native-jobs.json`, project-local native outputs | Native outputs may be final visual inputs when `native-final-video` is selected; otherwise they are candidates/source plates |

## Activation Signals

Activate this route when any of these appear in the brief or scene metadata:
- Explicit fields: `ipDiagram`, `ipDiagramCreator`, `ipDiagramCreatorPrimary`, `primaryIpDiagramCreator`, `personalIp`, `creatorPersona`, `ipCharacter`, `characterAssets`, `pptPresentationMode`, `teachingMode`, `courseMode`, `tutorialMode`, `lessonMode`, `plannerDriver: "ip-diagram-creator"`, `primaryVisualSystem: "ip-diagram-creator"`, or `visualMode: "ip-diagram"`.
- Strong text signals: `个人IP`, `IP角色`, `图解角色`, `知识卡`, `手绘图解`, `教学图解`, `课程图解`, `方法图解`, `执行Agent`, `PPT`, `课件`, `直播分享`, `导演规划`, `三张角色`, `角色主锚图`, `creator-led`, `creator persona`, `personal brand`, `knowledge card`, `agent collaboration`, `ppt presentation`, `slide deck`, or `diagram persona`.
- Generic teaching text such as `教学`, `教程`, `课程`, `讲解`, `科普`, `lesson`, `tutorial`, `course`, `teaching`, `explainer`, or `how to` is a ranking signal only. It can make an already active IP route primary, but it must not activate the route by itself.
- Scene signals: hand-drawn knowledge-card requests, method cards that benefit from execution Agents, creator-led teaching scenes, or old slides that need video-first redesign.

If these signals are absent, write the plan as `not-applicable` or keep it inactive. Do not force personal-IP visual language onto unrelated topics.

Primary planner route is active when the brief explicitly requests `ip-diagram-creator` as a planner/visual system, when explicit teaching/course/tutorial/PPT fields opt into that route, or when a strong personal-IP/diagram/PPT/knowledge-card/Agent signal appears. Natural-language requests such as `生成个人 IP 手绘图解视频` must be treated as a primary IP diagram route, even if the user did not also say `课程` or `教学`. If that signal is personal IP, it must also activate native source jobs, fixed/default persona rendering, and mandatory `native-final-video`; missing native page provenance is a blocker, not permission to fall back to integrated HTML composition.

## Required Artifact

Every run writes the plan; every active route must also write native jobs and layout audit:

```text
workflow/ip-diagram-creator-plan.json
workflow/personal-ip-asset-registry.json
workflow/ip-diagram-creator-vendor-usage.json
workflow/ip-diagram-creator-native-jobs.json
workflow/ip-diagram-layout-audit.json
workflow/native-page-provenance-audit.json
workflow/native-page-count-policy.json
workflow/skill-usage-accuracy-audit.json
workflow/vertical-personal-ip-design-contract.json  # required when active native-final canvas is 9:16
workflow/top-safe-area-audit.json                   # required when active native-final canvas is 9:16
workflow/personal-ip-image-count-plan.json          # required for standalone personal-IP source-page planning
workflow/vertical-personal-ip-image-contract.json   # required for standalone vertical source-page route
workflow/vertical-personal-ip-image-image-jobs.json # required for standalone vertical source-page route
```

Minimum shape:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-ip-diagram-creator-plan",
  "status": "active-planner-capability",
  "sourceRepo": "https://github.com/haloshin/ip-diagram-creator",
  "sourceCommit": "dd64ab5d972893f7ca271d9c560362d7788eb2d6",
  "integrationMode": "compatible-capability-portfolio-not-replacement",
  "plannerRole": "primary-teaching-visual-system",
  "primaryPlannerRoute": true,
  "plannerDriver": {
    "id": "ip-diagram-creator",
    "owner": "planner",
    "routeId": "ip-diagram-creator-primary-teaching-route",
    "frameworkKeeps": ["html-video renderer", "voice/subtitle timing", "deterministic text layers", "cover packaging", "rights ledger", "QC gates"]
  },
  "active": true,
  "executionModes": [],
  "personalIpAssetRegistry": {},
  "characterAssetPlan": {},
  "nativeDirectUsePlan": {},
  "directorPlan": {},
  "pageCards": [],
  "capabilityCards": [],
  "characterAssetPolicy": {},
  "sceneAssignments": [],
  "userChoices": {
    "makePersonalIp": "auto",
    "addHandDrawnImageAnimation": "subtle"
  },
  "stableFullScreenContract": {
    "generatedImagesAreFullScreen": true,
    "noCardWrapper": true,
    "noBorder": true,
    "noDropShadow": true,
    "baseImageTransform": "fixed-cover-1920x1080",
    "noPerCueCropPanZoom": true,
    "noVerticalCameraOffset": true
  },
  "promptContract": {},
  "qaChecklist": [],
  "rejectedWholeStackAdoption": {}
}
```

Vendor usage artifact minimum shape:

```json
{
  "schemaVersion": 1,
  "stage": "ip-diagram-creator-vendor-usage",
  "status": "ready",
  "active": true,
  "sourceRepo": "https://github.com/haloshin/ip-diagram-creator",
  "sourceCommit": "dd64ab5d972893f7ca271d9c560362d7788eb2d6",
  "license": "MIT",
  "entrypoint": ".agents/skills/codex-video-workflow/vendor/ip-diagram-creator/SKILL.md",
  "manifestPath": ".agents/skills/codex-video-workflow/vendor/ip-diagram-creator/VENDORED_SOURCE.json",
  "references": [],
  "promptTemplateAvailability": {
    "contentDiagram": true,
    "pptPresentation": true,
    "mainAnchor": true,
    "specSheet": true,
    "actionExpression": true
  },
  "executionContract": {
    "usesVendoredSkillInstructions": true,
    "nativeJobsMustReferenceVendorSkill": true,
    "promptTemplatesMustComeFromVendor": true
  },
  "missing": []
}
```

Native job artifact minimum shape:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-ip-diagram-creator-native-jobs",
  "status": "active-native-route-available",
  "sourceLicense": "MIT",
  "sourceReference": "vendor/ip-diagram-creator/SKILL.md",
  "vendorUsage": {},
  "executionModes": [],
  "characterAssetPlan": {},
  "visualDna": {},
  "jobs": [
    {
      "sceneId": "scene-01",
      "nativeMode": "PPT演讲页面 prompt",
      "pageCardId": "ip-page-card-01",
      "vendoredSkillEntrypoint": "vendor/ip-diagram-creator/SKILL.md",
      "promptTemplateSource": "vendor/ip-diagram-creator/references/prompt-templates.md",
      "prompt": "白底、极简手绘、成人 IP 主讲人、执行 Agent、文字安全...",
      "repairPrompt": "if cards/arrows/Agents overlap, increase whitespace and repartition..."
    }
  ]
}
```

Layout audit minimum shape:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-ip-diagram-layout-audit",
  "status": "pass",
  "layoutModel": "css-grid-non-overlap-ip-diagram-board",
  "checkedScenes": [
    {
      "sceneId": "scene-01",
      "gridAreas": ["persona", "problem", "flow", "evidence", "center", "action", "agents"],
      "noAbsolutePanelOverlap": true,
      "personaLaneReserved": true,
      "agentLaneReserved": true,
      "viewerFacingLabelsOnly": true
    }
  ],
  "issues": []
}
```

Inactive plans may use `status: "not-applicable"` but must still preserve the source snapshot and rejection boundary when written.

## Prompt Contract

For Image 2 / Codex image generation:
- Prompt only for role reference assets, small scene illustrations, knowledge-card source plates, character actions, visual metaphor plates, or PPT-style page background assets.
- IP diagram prompts must include the native visual DNA when active: white/near-white background, black minimal hand-drawn line art, slight pen wobble, adult presenter, sparse orange/red/blue annotation, and concrete execution Agents when useful.
- Do not ask a generated bitmap to own final exact Chinese labels, subtitles, claim text, metrics, or UI copy. Those remain deterministic HTML/SVG/CSS layers, except for intentionally generated cover typography governed by the cover contract.
- Include character reference priority when authorized role assets exist: user-provided role assets outrank generic style references.
- Include saved-persona priority when `workflow/personal-ip-asset-registry.json` reports `ready-existing-persona`; prompts must preserve that manifest as the fixed character reference instead of redesigning a presenter per scene.
- If no image tool is available, output prompts and repair prompts only; do not claim an image was generated.

## Safety And Asset Rules

- Use only user-authorized photos, screenshots, bios, course materials, and character references.
- Mask private account data, customer names, private analytics, and sensitive screenshots before they become prompts or public artifacts.
- Store persistent personal-IP persona assets in the user material library outside `.agents/skills/codex-video-workflow`; the default local root is `~/.codex/video-workflow/user-assets/personal-ip`, overrideable with `CODEX_VIDEO_PERSONAL_IP_ASSET_ROOT`.
- Store project-specific role assets only inside the generated output package or the user material library, not inside `.agents/skills/codex-video-workflow` or any public skill package.
- Use `scripts/register-personal-ip-asset.mjs` to create/update a fixed persona manifest from authorized local photos, avatars, or character sheets. Once created, Planner must read the manifest and reuse it on later runs unless the user chooses a different persona.
- Do not promise exact likeness, legal clearance, platform review, or brand-safety approval.
- Do not mix generic public references with private role assets without an explicit boundary in the artifact.

## QC Additions

Active routes fail QC when:
- `workflow/ip-diagram-creator-plan.json` is missing.
- `workflow/personal-ip-asset-registry.json` is missing, lacks create-once reuse guidance, stores assets under the public Skill package, or ignores an existing saved persona manifest.
- Dialogue or multi-speaker scripts collapse all speakers into one personal-IP presenter. When speaker labels such as `主播1` / `主播2`, male/female hosts, interview roles, or two-host dialogue are present, the plan must write `dialogueSpeakerBindings` / `speakerRoleBindings`, bind each speaker to a stable persona manifest, and allow two or more hosts in the same native page when the content is a dialogue.
- `workflow/ip-diagram-creator-native-jobs.json` is missing, lacks MIT/source snapshot metadata, or lacks one native prompt job per active design scene.
- `workflow/ip-diagram-layout-audit.json` is missing, not `pass`, or does not reserve separate persona, panel, flow, and Agent grid areas.
- `workflow/native-page-provenance-audit.json` is missing, not `pass`, or shows final content pages without `source_generated_image` / native-generation evidence, unless the run is explicitly labeled draft/degraded and not delivered as final.
- `workflow/skill-usage-accuracy-audit.json` is missing, not `pass`, or fails to record the governing `codex-video-workflow` Skill, the external `ip-diagram-creator` Skill snapshot, selected capabilities, ownership boundary, and prohibited claims.
- The plan lacks `sourceRepo`, `sourceCommit`, active state, character asset policy, scene assignments, prompt contract, or QA checklist.
- Private role assets or customer materials are copied into the Skill package.
- Generated images are the only owner of final readable Chinese text.
- A personal-IP/PPT route collapses the final video into static slides without motion/timing/caption evidence.
- Deterministic PIL/SVG/HTML placeholder pages, local wireframes, or framework-drawn replicas are presented as official native-final Skill pages.
- The contact sheet has low-detail box layouts, decorative-only IP characters, weak hand-drawn scenes, or "cheap PPT" composition compared with the official direct-generation baseline.
- A native-final generated page is rendered inside a visible border/card/shadow/matte/inset frame instead of full-screen.
- A static native-final generated page changes crop, zoom, pan, y-offset, or scale between subtitle cues, causing visible background jump.
- Hand-drawn animation moves or redraws the whole source page instead of adding foreground-only semantic strokes/reveals.
- Agent collaboration diagrams show anonymous decoration instead of concrete execution roles.
- Two-host dialogue pages omit either host, fail to distinguish the male/female generic fallback hosts when no user persona exists, or use Agents as substitutes for the real dialogue speakers.
- Visible final frames show internal mode names, workflow labels, ratios, file paths, renderer/QC labels, or overlapping card/Agent/panel layouts.
- A primary planner route lacks `plannerDriver`, `directorPlan`, `pageCards`, or design-plan pages marked with `primaryVisualSystem: "ip-diagram-creator"`.
