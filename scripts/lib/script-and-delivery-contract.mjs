import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const TEXT_FIELDS = [
  "narration",
  "spokenNarration",
  "voiceover",
  "spokenScript",
  "voiceoverScript",
  "script",
  "transcript",
  "口播稿",
];

const PATH_FIELDS = [
  "narrationPath",
  "spokenNarrationPath",
  "voiceoverPath",
  "spokenScriptPath",
  "voiceoverScriptPath",
  "scriptPath",
  "transcriptPath",
  "口播稿路径",
];

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function normalizeNarrationValue(value) {
  const text = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).join("\n\n")
    : value && typeof value === "object"
      ? String(value.text || value.narration || value.voiceover || value.script || value.transcript || value.content || value.body || "")
      : String(value || "");
  return text.replace(/\r\n?/g, "\n").trim();
}

export function comparableNarrationText(value) {
  const text = normalizeNarrationValue(value);
  return text.replace(/\s+/gu, (whitespace, offset, whole) => {
    const previous = whole[offset - 1] || "";
    const next = whole[offset + whitespace.length] || "";
    return /[A-Za-z0-9]/.test(previous) && /[A-Za-z0-9]/.test(next) ? " " : "";
  });
}

function narrationPathCandidate({ source, field, inputPath, briefDirectory }) {
  const resolvedPath = isAbsolute(inputPath) ? inputPath : resolve(briefDirectory, inputPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Authoritative narration path does not exist: ${source}.${field} -> ${resolvedPath}`);
  }
  const text = normalizeNarrationValue(readFileSync(resolvedPath, "utf8"));
  if (!text) {
    throw new Error(`Authoritative narration path is empty: ${source}.${field} -> ${resolvedPath}`);
  }
  return { source: `${source}.${field}`, text, kind: "file", path: realpathSync(resolvedPath) };
}

function collectExplicitCandidates(brief, briefDirectory) {
  const candidates = [];
  for (const field of TEXT_FIELDS) {
    const text = normalizeNarrationValue(brief?.[field]);
    if (text) candidates.push({ source: `brief.${field}`, text, kind: "inline" });
  }
  for (const field of PATH_FIELDS) {
    const inputPath = String(brief?.[field] || "").trim();
    if (!inputPath) continue;
    candidates.push(narrationPathCandidate({ source: "brief", field, inputPath, briefDirectory }));
  }
  const nestedSources = [
    ["brief.sourceMaterial", brief?.sourceMaterial],
    ...(Array.isArray(brief?.sourceMaterials)
      ? brief.sourceMaterials.map((item, index) => [`brief.sourceMaterials[${index}]`, item])
      : []),
  ];
  for (const [source, item] of nestedSources) {
    if (!item || typeof item !== "object") continue;
    for (const field of ["narration", "spokenNarration", "voiceover", "spokenScript", "voiceoverScript", "script", "transcript", "口播稿"]) {
      const text = normalizeNarrationValue(item[field]);
      if (text) candidates.push({ source: `${source}.${field}`, text, kind: "inline" });
    }
    for (const field of PATH_FIELDS) {
      const inputPath = String(item[field] || "").trim();
      if (inputPath) candidates.push(narrationPathCandidate({ source, field, inputPath, briefDirectory }));
    }
    const kind = String(item.kind || item.type || item.mode || "");
    const genericPath = String(item.path || "").trim();
    if (genericPath && /narration|voiceover|spoken|script|transcript|口播|配音稿/i.test(kind)) {
      candidates.push(narrationPathCandidate({ source, field: "path", inputPath: genericPath, briefDirectory }));
    }
  }
  return candidates;
}

function fallbackNarrationFromFrames(frames = []) {
  return normalizeNarrationValue(frames
    .map((frame) => frame?.narration || frame?.spokenText || frame?.voiceover || frame?.subtitle || frame?.body || "")
    .filter(Boolean)
    .join(""));
}

export function resolveCanonicalNarration({ brief = {}, frames = [], briefDirectory = process.cwd() } = {}) {
  const explicitCandidates = collectExplicitCandidates(brief, briefDirectory);
  if (explicitCandidates.length) {
    const canonical = explicitCandidates[0];
    const canonicalComparable = comparableNarrationText(canonical.text);
    const conflicts = explicitCandidates.filter((candidate) => comparableNarrationText(candidate.text) !== canonicalComparable);
    if (conflicts.length) {
      const sources = explicitCandidates.map((candidate) => candidate.source).join(", ");
      throw new Error(`Conflicting authoritative narration inputs: ${sources}. Keep one canonical口播稿 or make every supplied alias identical.`);
    }
    return {
      text: canonical.text,
      source: canonical.source,
      explicit: true,
      aliases: explicitCandidates.map((candidate) => candidate.source),
      sourcePath: canonical.path || null,
      exactSha256: sha256(canonical.text),
      comparableSha256: sha256(canonicalComparable),
    };
  }

  const fallbackText = fallbackNarrationFromFrames(frames);
  if (!fallbackText) {
    throw new Error("No authoritative narration was provided and no scene narration fallback is available.");
  }
  return {
    text: fallbackText,
    source: "brief.scenes",
    explicit: false,
    aliases: [],
    sourcePath: null,
    exactSha256: sha256(fallbackText),
    comparableSha256: sha256(comparableNarrationText(fallbackText)),
  };
}

function joinedSegmentText(segments = []) {
  return (Array.isArray(segments) ? segments : []).map((segment) => String(segment?.text || "")).join("");
}

export function buildScriptFidelityAudit({
  canonical,
  narration,
  spokenNarration,
  frameSegments = [],
  cueSegments = [],
  visualSceneNarration = [],
} = {}) {
  if (!canonical?.text || !canonical?.source) {
    throw new Error("Script fidelity audit requires the resolved canonical narration contract.");
  }
  const sourceExact = normalizeNarrationValue(canonical.text);
  const narrationExact = normalizeNarrationValue(narration);
  const sourceComparable = comparableNarrationText(sourceExact);
  const spokenComparable = comparableNarrationText(spokenNarration);
  const frameComparable = comparableNarrationText(joinedSegmentText(frameSegments));
  const cueComparable = comparableNarrationText(joinedSegmentText(cueSegments));
  const visualComparable = comparableNarrationText((Array.isArray(visualSceneNarration) ? visualSceneNarration : []).join(""));
  const checks = {
    authoritativeSourcePresent: Boolean(sourceExact),
    sourceEqualsNarrationExactly: sourceExact === narrationExact,
    spokenNarrationPreservesSourceText: sourceComparable === spokenComparable,
    frameSegmentsPreserveSpokenNarration: spokenComparable === frameComparable,
    cueSegmentsPreserveSpokenNarration: spokenComparable === cueComparable,
    visualSceneNarrationPreservesSourceText: sourceComparable === visualComparable,
  };
  const failures = Object.entries(checks).filter(([, passed]) => passed !== true).map(([id]) => id);
  return {
    schemaVersion: 1,
    status: failures.length ? "fail" : "pass",
    pass: failures.length === 0,
    policy: "The user-provided口播稿 is the single authoritative content source. Only whitespace-only voice-direction changes are allowed; narration, TTS segments, subtitle cues, and visual scene narration must preserve the same ordered text.",
    source: {
      field: canonical.source,
      explicit: canonical.explicit === true,
      aliases: canonical.aliases || [],
      path: canonical.sourcePath || null,
      exactSha256: sha256(sourceExact),
      comparableSha256: sha256(sourceComparable),
      characterCount: Array.from(sourceExact).length,
    },
    artifacts: {
      narrationExactSha256: sha256(narrationExact),
      spokenComparableSha256: sha256(spokenComparable),
      frameSegmentsComparableSha256: sha256(frameComparable),
      cueSegmentsComparableSha256: sha256(cueComparable),
      visualSceneNarrationComparableSha256: sha256(visualComparable),
      frameSegmentCount: frameSegments.length,
      cueSegmentCount: cueSegments.length,
      visualSceneCount: visualSceneNarration.length,
    },
    checks,
    failures,
  };
}

function verifiedAbsoluteFile(path, label) {
  if (!path || !existsSync(path)) throw new Error(`${label} does not exist: ${path || "<empty>"}`);
  const stat = statSync(path);
  if (!stat.isFile() || stat.size <= 0) throw new Error(`${label} is not a non-empty file: ${path}`);
  return { path: realpathSync(path), size: stat.size, sha256: sha256File(path) };
}

function sha256File(path) {
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function packageFilePath(outputDirectory, packageRelativePath, label) {
  const candidate = resolve(outputDirectory, String(packageRelativePath || ""));
  const relation = relative(outputDirectory, candidate);
  if (!relation || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`${label} must be a file inside the output directory: ${packageRelativePath || "<empty>"}`);
  }
  if (!existsSync(candidate)) return candidate;
  const realCandidate = realpathSync(candidate);
  const realRelation = relative(outputDirectory, realCandidate);
  if (!realRelation || realRelation === ".." || realRelation.startsWith(`..${sep}`) || isAbsolute(realRelation)) {
    throw new Error(`${label} must resolve to a file inside the output directory: ${packageRelativePath || "<empty>"}`);
  }
  return realCandidate;
}

export function buildFinalDeliveryPathContract({
  out,
  finalCopy,
  compatibilityFinalCopy = "final.mp4",
  renderArtifact = "renders/final.mp4",
  promotedToFinalDelivery = false,
} = {}) {
  const outputDirectory = realpathSync(resolve(out));
  const renderPath = packageFilePath(outputDirectory, renderArtifact, "Internal render artifact");
  const render = verifiedAbsoluteFile(renderPath, "Internal render artifact");
  if (!promotedToFinalDelivery) {
    return {
      schemaVersion: 1,
      status: "review-only",
      pass: true,
      promotedToFinalDelivery: false,
      finalOutputDirectory: null,
      finalVideoPath: null,
      finalVideoRelativePath: null,
      workingOutputDirectory: outputDirectory,
      reviewVideoPath: render.path,
      renderArtifactPath: render.path,
      renderArtifactRelativePath: renderArtifact,
    };
  }

  const finalRelativePath = String(finalCopy || "").trim();
  if (!finalRelativePath) throw new Error("Final delivery video name is missing after promotion.");
  const final = verifiedAbsoluteFile(packageFilePath(outputDirectory, finalRelativePath, "Final delivery video"), "Final delivery video");
  const compatibility = verifiedAbsoluteFile(packageFilePath(outputDirectory, compatibilityFinalCopy, "Compatibility final video"), "Compatibility final video");
  if (final.size !== render.size || compatibility.size !== render.size
    || final.sha256 !== render.sha256 || compatibility.sha256 !== render.sha256) {
    throw new Error(`Final delivery video does not match the QC-verified render artifact: render=${render.size}/${render.sha256}, final=${final.size}/${final.sha256}, compatibility=${compatibility.size}/${compatibility.sha256}`);
  }
  return {
    schemaVersion: 1,
    status: "final-delivery-verified",
    pass: true,
    promotedToFinalDelivery: true,
    finalOutputDirectory: outputDirectory,
    finalVideoPath: final.path,
    finalVideoRelativePath: finalRelativePath,
    compatibilityFinalVideoPath: compatibility.path,
    compatibilityFinalVideoRelativePath: compatibilityFinalCopy,
    workingOutputDirectory: outputDirectory,
    reviewVideoPath: null,
    renderArtifactPath: render.path,
    renderArtifactRelativePath: renderArtifact,
    verifiedByteSize: final.size,
    verifiedSha256: final.sha256,
  };
}
