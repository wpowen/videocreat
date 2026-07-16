# Context Image2 dispatch runtime

The local preparation script owns deterministic validation and writes `workflow/cover-image2-dispatch-plan.json`. Context Image2 is a Codex built-in tool, so the actual renderer call must run inside the Codex tool runtime rather than an ordinary Node.js subprocess.

## Hard dispatch contract

1. Read the prepared plan once.
2. Submit **all pending jobs** through one bounded worker pool. Concurrency changes simultaneous work only; it never slices or shortens `plan.jobs`.
3. Use `Promise.allSettled` so one failed target cannot cancel successful targets.
4. Preserve the exact `targetId -> prompt -> role-labelled inputImages -> generated source path` mapping.
5. Default concurrency is the complete pending set up to nine jobs. An explicit lower concurrency value is allowed for provider throttling, but workers must continuously take the next pending job without an agent pause.
6. Do not inspect, ingest, or run package QC before every pending job has at least been submitted.

The Codex runtime orchestration must follow this shape:

```js
const planResult = await tools.exec_command({
  cmd: `node skills/codex-video-cover-generation/scripts/prepare-cover-image2-dispatch.mjs --out ${JSON.stringify(topic)}`,
  workdir: workflowRoot,
});
const planRead = await tools.exec_command({
  cmd: `jq -c . ${JSON.stringify(`${topic}/workflow/cover-image2-dispatch-plan.json`)}`,
  workdir: workflowRoot,
});
const plan = JSON.parse(planRead.output);
const results = await Promise.allSettled(plan.jobs.map(async (job) => {
  const generated = await tools.image_gen__imagegen({
    prompt: job.prompt,
    referenced_image_paths: job.inputImages.map((item) => item.path),
  });
  return { targetId: job.targetId, generated };
}));
```

When explicit concurrency is below the pending count, use the worker-pool helper defined by the standalone Skill contract. Never create manual first/second batches. Retry only `failedTargetIds` from the settled result.
