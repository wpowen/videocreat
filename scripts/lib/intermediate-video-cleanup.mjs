import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const INTERMEDIATE_VIDEO_RELATIVE_PATHS = [
  "renders/native-pages-hard-subtitles.mp4",
  "renders/final.audio-normalized.mp4",
];

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function cleanupIntermediateVideoArtifacts({
  out,
  finalPath = "renders/final.mp4",
  reason = "post-qc",
  dryRun = false,
}) {
  const outputRoot = resolve(out);
  const resolvedFinalPath = resolve(outputRoot, finalPath);
  if (!existsSync(resolvedFinalPath) || !statSync(resolvedFinalPath).isFile()) {
    throw new Error(`Cannot clean intermediate video artifacts without a final MP4: ${resolvedFinalPath}`);
  }

  const cleanupManifestPath = join(outputRoot, "workflow", "intermediate-video-cleanup.json");
  const previous = readJsonIfExists(cleanupManifestPath) || {};
  const removed = [];
  let bytesRemoved = 0;
  for (const relativePath of INTERMEDIATE_VIDEO_RELATIVE_PATHS) {
    const path = resolve(outputRoot, relativePath);
    if (!existsSync(path)) continue;
    const bytes = statSync(path).size;
    if (!dryRun) rmSync(path, { force: true });
    removed.push(relativePath);
    bytesRemoved += bytes;
  }

  const manifest = {
    schemaVersion: 1,
    status: dryRun ? "dry-run" : "completed",
    reason,
    completedAt: new Date().toISOString(),
    finalVideo: relative(outputRoot, resolvedFinalPath),
    removed: [...new Set([...(previous.removed || []), ...removed])],
    removedThisRun: removed,
    bytesRemovedThisRun: bytesRemoved,
    retained: [relative(outputRoot, resolvedFinalPath)],
    policy: "After post-QC finalization, retain only the deliverable final MP4 in renders/; intermediate video layers and normalization copies are disposable.",
  };
  if (!dryRun) {
    mkdirSync(join(outputRoot, "workflow"), { recursive: true });
    writeFileSync(cleanupManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return manifest;
}

export { INTERMEDIATE_VIDEO_RELATIVE_PATHS };
