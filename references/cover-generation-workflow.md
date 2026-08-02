# Standalone cover-generation workflow

This file defines the integration boundary inside `codex-video-workflow`. The independently installed runtime entrypoint is `${CODEX_HOME:-$HOME/.codex}/skills/codex-video-cover-generation/SKILL.md`; `skills/codex-video-cover-generation/` is its repository source mirror. When both exist, the runtime compares the critical dispatch/ingest files and fails closed on hash drift. `CODEX_VIDEO_COVER_SKILL_ROOT` is reserved for explicit development/test overrides. Keep visual strategy in `cover-design.md`; main-video changes must route generation, ingest, evidence, status convergence, and regression work to that standalone Skill instead of duplicating it.

## Canonical flow

1. Plan the cover from the locked title, narration, and `workflow/cover-design.json`.
2. Write `workflow/context-image2-cover-requests.json`, `workflow/cover-generation-workflow.json`, and one canonical prompt document per requested target under `prompts/context-image2-covers/`.
3. Run `skills/codex-video-cover-generation/scripts/prepare-cover-image2-dispatch.mjs --out <package>`. It writes one dispatch plan containing every pending target; no caller may slice that list into manual batches.
4. Dispatch all jobs through the built-in Context Image2 `image_gen` runtime with a bounded worker pool. The default concurrency is the pending count capped at 9. Use all-settled isolation, preserve successful outputs, and retry only failed target ids.
5. Record each generated result through `record-cover-image2-dispatch-result.mjs`. After visual review passes, pass its external, source-hash-bound human/vision attestation to `scripts/record-cover-generation-evidence.mjs`; the recorder validates and embeds it with the request-bound generation receipt. The recorder may not self-assert inspection checks, and evidence JSON may not be copied from another target.
6. Run `skills/codex-video-cover-generation/scripts/ingest-codex-image2-cover-batch.mjs --out <package>` once. It preflights every target, locks shared state, serializes canonical ingest writes, and runs cover validators once after the batch.
7. Treat `coversGenerated` and `coversVerified` as separate states. Cover completion must not trigger full-video QC; the parent video workflow runs full package QC and publishing promotion separately.
8. Validate the standalone lane with `scripts/validate-cover-generation-workflow.mjs --out <package>` before publishing.

## Hard contracts

- Title-first semantic routing is mandatory. Body-frame keywords may be used only when the locked title does not match a cover topic. Body mentions such as “人物欲望” or “误信念” must not replace a title about “黄金开篇”.
- `workflow/context-image2-cover-requests.json` is the canonical prompt source. Every prompt file stores and validates both `promptSha256` and `promptFileSha256`.
- `workflow/cover-image2-dispatch-plan.json` must contain every currently pending request. Concurrency is a worker-pool width, not a request-count limit; `--limit`, array slicing, and ad hoc batches are forbidden.
- Image generation uses all-settled target isolation. One failed target may not discard successful outputs or cause already generated targets to be regenerated.
- Canonical ingest is coordinated by the standalone batch script. Parallel per-target ingest is forbidden because target commands mutate shared request, selection, QC, and delivery files.
- The request-count contract is closed against `workflow/cover-image2-prompts.json`: planned, requested, and actual target ids/counts are separate fields. Any narrower primary-only or explicit-subset scope requires matching `coverScopeAuthorization.authorizedByUser:true`; otherwise planning and validation fail.
- Downstream renderers may not rewrite canonical prompt files when core cover artifacts already exist.
- The generated source path must be external to the package until ingest, preventing source and destination from being the same file.
- Evidence recording accepts only an output and independent review attestation beneath `${CODEX_HOME:-$HOME/.codex}/generated_images` (or the explicit test override), validates source hash, reviewer, passed check results, art direction, semantic color, glance hierarchy, native ratio, and prompt parity, and writes to the request-declared evidence paths.
- A video-internal opening cover never satisfies a platform-submission cover request.
- Full-auto must await `coversVerified:true` before final package QC. A pending external Image2 request may block publishing but may not be silently reported as ready.
- `workflow/cover-parallel-execution.json` must distinguish planning from generation. Pending requests use `status:"generation-required"`; `status:"complete"` is forbidden because it can be mistaken for generated/verified covers. Full-auto must prepare `workflow/cover-image2-dispatch-plan.json` and expose the lane in `workflow/full-auto-continuation.json` until every target is verified.
- `coversGenerated:true` means every requested bitmap exists; `coversVerified:true` additionally requires target-bound evidence, independent inspection, canonical ingest, and cover-only QC. Neither state implies that full-video QC ran.
- `delivery-manifest.json.coverStatus`, request state, cover QC, and `logs/qc.json` must agree.

## Regression gates

Run at minimum:

```bash
node scripts/self-test-cover-content-routing.mjs
node scripts/self-test-cover-generation-workflow.mjs
node scripts/self-test-cover-image2-dispatch.mjs
node scripts/self-test-cover-image2-batch-ingest.mjs
node scripts/self-test-cover-lifecycle.mjs
node scripts/validate-cover-targets.mjs
```

For a real package, run the standalone validator once while pending with `--allow-pending`, then again without that flag after generation, receipt, inspection, batch ingest, and cover-only QC. Run full-video QC only from the parent video workflow.
