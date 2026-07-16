---
name: codex-video-cover-generation
description: Independently generate, inspect, ingest, validate, and synchronize platform-submission covers for codex-video-workflow packages. Use when a video package has pending Context Image2 cover requests, cover prompts were overwritten or routed to the wrong topic, cover evidence or delivery readiness is inconsistent, or the user asks to generate, repair, rerun, or verify a video thumbnail/封面 without changing the video-production pipeline.
---

# Codex Video Cover Generation

Own the complete platform-cover lifecycle. Do not edit video rendering, TTS, subtitles, or native-page logic unless a proven cover contract dependency is broken.

## Inputs

Require a topic package containing:

- `workflow/context-image2-cover-requests.json`
- `workflow/cover-generation-workflow.json`
- `workflow/cover-design.json`
- `workflow/cover-image2-prompts.json`
- `workflow/cover-size-selection.json`
- `prompts/context-image2-covers/*.txt`

Resolve this standalone Skill root first. Its dispatch planner, runtime contract, result recorder, and batch-ingest coordinator are owned here and must be changed and tested here. Resolve the companion video-workflow root only for the stable package validators and target ingest primitive. Read `references/workflow-contract.md` and `references/image2-dispatch-runtime.md` before execution.

## Workflow

1. Run the companion `scripts/validate-cover-generation-workflow.mjs --out <topic> --allow-pending`. The validator must compare the request list against every target in `workflow/cover-image2-prompts.json`, not merely compare completed count with an already-truncated request list. Stop on prompt parity, request-scope, request-count, or contract-state failures; repair the package before generation. A narrowed primary-only or subset scope is valid only with matching request-bound explicit user authorization.
2. Prepare one immutable all-pending plan:

   ```bash
   node <cover-skill-root>/scripts/prepare-cover-image2-dispatch.mjs --out <topic>
   ```

   The default concurrency is the complete pending set up to nine. A lower explicit concurrency changes throughput only; it may never remove jobs from the plan.
3. Follow `references/image2-dispatch-runtime.md`. Submit all pending jobs through one worker pool, use `Promise.allSettled`, and invoke the system `imagegen` Skill / built-in Context Image2 `image_gen` tool with each job's exact prompt and role-labelled inputs. Manual first/second batches, `slice`, `[0:4]`, `--limit`, or waiting for an agent decision between batches are forbidden.
4. Keep every generated source PNG outside the topic package. Record each settled target immediately with `<cover-skill-root>/scripts/record-cover-image2-dispatch-result.mjs`. `coversGenerated` becomes true only when every pending target has a generated result; one failure leaves only that target in `retryTargetIds`.
5. Inspect every native output against that job's own `approvedVisibleText`, dimensions, ratio, and persona references. Never reuse another target's text whitelist. Reject wrong topic, wrong presenter identity, unreadable/extra text, clipping, letterbox/matte bands, duplicate artwork, PPT/UI appearance, or target-ratio mismatch.
6. After visual inspection passes, record the request-bound generation receipt and inspection record with the companion evidence command. Do not hand-author or copy evidence JSON:

   ```bash
   node scripts/record-cover-generation-evidence.mjs \
     --topic <topic> \
     --target <target-id> \
     --source <external-imagegen-png> \
     --inspection-status passed-vision-review \
     --inspector-type vision
   ```

   The command binds request id, target id, provider `codex-context-image2`, tool `image_gen`, prompt SHA-256, output SHA-256, external source path, native dimensions, timestamps, inspection type, and status. It rejects package-local sources, non-Imagegen staging paths, stale prompt files, missing role-labelled inputs, and wrong native ratios.
7. After every target has generated and passed target-bound inspection, run one locked batch ingest:

   ```bash
   node <cover-skill-root>/scripts/ingest-codex-image2-cover-batch.mjs \
     --out <topic> \
     --workflow-root <videocreat-root>
   ```

   The coordinator validates every source and evidence record before mutation, serializes shared-manifest updates under one lock, and runs cover validators once. It never triggers full-video QC.
8. Treat `coversGenerated` and `coversVerified` as separate states. `coversGenerated` means every requested Image2 bitmap returned. `coversVerified` means target-bound inspection, evidence, batch ingest, and cover QC passed. Report the first state immediately instead of waiting for full package validation.
9. Run both companion validators if an independent audit is required:

   ```bash
   node scripts/validate-cover-generation-workflow.mjs --out <topic>
   node scripts/validate-platform-submission-cover.mjs --out <topic>
   ```

   Add `--require-all-platform-covers` only when claiming the entire planned multi-platform suite.

## Stop conditions

Claim `coversGenerated` only from `workflow/cover-generation-run.json`. Claim `coversVerified` only when planned target count, authorized request scope, and actual request count agree; prompt parity passes; every requested target in scope is completed; evidence files exist; native outputs exist under `最终成品/`; and `coverStatus` agrees with request/QC state. Full-video QC remains a separate publish-promotion gate. Never report `1/1` as complete when the prompt plan contains nine targets and the user did not authorize a one-target scope. A playable MP4 with a pending cover is `video-review-ready`, not publish-ready.

Do not regenerate a completed inspected target when prompt, dimensions, and role-labelled inputs are unchanged. If any contract changes, invalidate the old receipt and generate a new bitmap instead of relabelling old pixels.
