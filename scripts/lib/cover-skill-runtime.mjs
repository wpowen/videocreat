import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const COVER_SKILL_PARITY_FILES = [
  "SKILL.md",
  "references/workflow-contract.md",
  "references/image2-dispatch-runtime.md",
  "references/cover-art-direction-system.md",
  "scripts/prepare-cover-image2-dispatch.mjs",
  "scripts/record-cover-image2-dispatch-result.mjs",
  "scripts/ingest-codex-image2-cover-batch.mjs",
  "scripts/lib/cover-generation-workflow-contract.mjs",
  "scripts/lib/cover-image2-dispatch.mjs",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertSkillRoot(path, label) {
  if (!existsSync(join(path, "SKILL.md"))) throw new Error(`${label} cover Skill root is incomplete: ${path}`);
}

export function compareCoverSkillMirrors(leftRoot, rightRoot) {
  return COVER_SKILL_PARITY_FILES.flatMap((relativePath) => {
    const leftPath = join(leftRoot, relativePath);
    const rightPath = join(rightRoot, relativePath);
    if (!existsSync(leftPath) || !existsSync(rightPath)) return [{ relativePath, reason: "missing" }];
    return sha256(leftPath) === sha256(rightPath) ? [] : [{ relativePath, reason: "sha256-mismatch" }];
  });
}

export function resolveStandaloneCoverSkillRoot({ mainSkillRoot, env = process.env } = {}) {
  const explicitRoot = env.CODEX_VIDEO_COVER_SKILL_ROOT ? resolve(env.CODEX_VIDEO_COVER_SKILL_ROOT) : null;
  if (explicitRoot) {
    assertSkillRoot(explicitRoot, "Explicit");
    return explicitRoot;
  }
  const localRoot = join(resolve(mainSkillRoot), "skills", "codex-video-cover-generation");
  const codexHome = env.CODEX_HOME || join(env.HOME || homedir(), ".codex");
  const globalRoot = join(codexHome, "skills", "codex-video-cover-generation");
  const hasLocal = existsSync(join(localRoot, "SKILL.md"));
  const hasGlobal = existsSync(join(globalRoot, "SKILL.md"));
  if (hasLocal && hasGlobal) {
    const drift = compareCoverSkillMirrors(localRoot, globalRoot);
    if (drift.length) {
      throw new Error(`Standalone cover Skill runtime drift detected between ${localRoot} and ${globalRoot}: ${drift.map((item) => `${item.relativePath}:${item.reason}`).join(", ")}`);
    }
    return globalRoot;
  }
  if (hasGlobal) return globalRoot;
  if (hasLocal) return localRoot;
  throw new Error(`Standalone cover Skill is not installed at ${globalRoot} and no repository mirror exists at ${localRoot}`);
}
