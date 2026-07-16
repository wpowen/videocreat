# Cover workflow contract

The request manifest is the canonical generation source. Prompt files are immutable rendered views of each request and must match `promptFileSha256`. The standalone workflow contract owns these stages:

`plan -> dispatch-all-pending -> covers_generated -> inspect -> batch-ingest -> covers_verified -> delivery-sync`

Title routing is title-first. Frame/body keywords are fallback signals only. Downstream native-page renderers must not overwrite core request prompts.

Generated source images stay outside the package until ingest. `coversGenerated` is a generation-only milestone and never implies inspection or publishing readiness. Locked batch ingest is the only `coversVerified` transition and must persist evidence, native output files, request completion, size selection, cover QC, standalone workflow state, and delivery status. Full-video QC is not part of cover generation and separately owns final publish promotion.

The prepared dispatch plan must contain every pending request. Default concurrency is the pending count up to nine; a lower throughput limit may delay workers but may never shorten the plan. Generation failures are isolated by target, and retries contain only failed target ids. Each inspection is bound to the target's own approved visible-text whitelist.

Request scope is closed against `workflow/cover-image2-prompts.json`, not against the request list alone. The contract records planned target count, requested target count, actual request count, and authorization state separately. Primary-only or explicit-subset scope requires `coverScopeAuthorization.authorizedByUser:true`, matching mode and target ids, plus a user-request source. Missing authorization is a planning and validation failure; it may never be reported as a successful `1/1` run.

When a rerun changes a prompt, dimensions, or input-image contract, invalidate the old generated asset. When those fields are unchanged, preserve the completed inspected asset byte-for-byte.
