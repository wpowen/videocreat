# Motion Usage Playbook

Use this playbook after `content-presentation-design.json` and before final rendering. Its job is to answer four questions for every scene: **why move, what moves, when it moves, and how the viewer understands it**.

## 1. How To Use The Templates

1. Read the script beat or storyboard scene.
2. Name the scene's motion verb:
   - `reveal`: make hidden information appear.
   - `compare`: show before/after or wrong/right.
   - `pressure`: show a constraint tightening.
   - `trace`: follow a path, thread, or cause-effect chain.
   - `accumulate`: stack evidence, costs, or progress.
   - `resolve`: seal, confirm, or close a loop.
   - `inspect`: focus a lens on evidence.
   - `transform`: change one state into another.
3. Choose a template from `templates/html-motion/motion-template-registry.json`.
4. Write `workflow/motion-template-selection.json` with the selected template and semantic binding.
5. Replace the template `data-field` values with scene-specific copy.
6. Bind `setProgress(progress)` to the same timecode plan used by subtitles and scene changes.
7. Capture at least two timestamps and confirm the scene changes visually without hurting subtitle readability.

## 2. When To Use Each Template

| Template | Use when | Good example | Do not use when |
| --- | --- | --- | --- |
| `kinetic-editorial-explainer` | The scene has a strong claim, contradiction, or hook. | "读者不买灵感" appears, then a promise seal lands. | The scene is a multi-step model that needs visible progress. |
| `semantic-timeline-reveal` | The scene explains a process, model, checklist, or chapter structure. | "承诺 -> 压力 -> 选择 -> 代价" lights up beat by beat. | The scene needs emotional evidence or mystery-board inspection. |
| `interactive-proof-board` | The scene argues from evidence, relationships, cause-effect, or hidden structure. | Cards connect by red thread while a lens focuses the deciding proof. | The scene is only a simple title or single-result payoff. |

## 3. How To Design Motion

Use this order:

1. **Content job**: what must the viewer understand by the end of the scene?
2. **Visual metaphor**: what object or spatial relation carries that idea?
3. **Motion verb**: which action reveals the idea?
4. **Hierarchy**: which element moves first, second, third?
5. **Timing**: which subtitle or narration timestamp triggers each movement?
6. **Safe area**: captions and key text must remain readable during the movement.
7. **Restraint**: one major motion idea per scene; secondary motion should be atmospheric only.

## 4. How To Show Motion In The Final Video

- The first second should show a clear visual promise, not an empty setup.
- The main motion should happen when the narration introduces the corresponding idea.
- Captions should stay in a stable safe area while background/foreground elements move.
- Use progress, active states, focus changes, seals, paths, or parallax to make the frame feel alive.
- Avoid decorative loops that do not map to the script. Looping motion is allowed only for subtle atmosphere.

## 5. Scene Mapping Example

For a long口播 about reader promise:

| Script beat | Motion verb | Template | Display logic |
| --- | --- | --- | --- |
| "读者不买灵感" | compare/reveal | `kinetic-editorial-explainer` | Wrong belief enters, then gets replaced by promise seal. |
| "承诺、压力、选择、代价..." | trace/accumulate | `semantic-timeline-reveal` | Each node activates in time with the model explanation. |
| "承诺不是解释出来的，而是演出来的" | inspect/connect | `interactive-proof-board` | Evidence cards connect to prove the relationship. |

## 6. Verification

Run:

```bash
node .agents/skills/codex-video-workflow/scripts/validate-html-motion-templates.mjs
```

The validation must write:

- `research/codex-video-workflow-poc/html-motion-template-validation/screenshots/*.png`
- `research/codex-video-workflow-poc/html-motion-template-validation/motion-validation-report.json`

Pass means:

- every registry template has an HTML file;
- every template exposes `window.motionTemplate`;
- Chrome can render it at 1920x1080;
- initial and later screenshots are different enough to prove visible motion;
- no screenshot is blank or effectively single-color.
- the template's core subject is visible in the later screenshot; pixel difference alone is not enough.

## 7. Hard Failures

- The selected template is not recorded in `workflow/motion-template-selection.json`.
- Motion does not correspond to a script beat.
- The final render uses a static card while the selected template requires movement.
- The screenshot/motion-difference check is missing.
- Text or subtitles become unreadable during the animation.
