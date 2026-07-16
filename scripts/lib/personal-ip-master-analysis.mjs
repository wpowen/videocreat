const REQUIRED_MASTER_ROLES = ["headline", "content-group", "personal-ip"];

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateDisplayedTextInventory(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Personal-IP semantic exact-text inventory requires explicit source-bound displayedTextInventory entries.");
  }
  const normalized = entries.map((entry) => ({
    sceneId: nonEmpty(entry?.sceneId) ? entry.sceneId.trim().slice(0, 90) : null,
    field: nonEmpty(entry?.field) ? entry.field.trim().slice(0, 80) : "displayed-text",
    text: nonEmpty(entry?.text) ? entry.text.replace(/\s+/g, " ").trim().slice(0, 120) : "",
    source: nonEmpty(entry?.source) ? entry.source.replace(/\s+/g, " ").trim().slice(0, 240) : "",
  }));
  if (normalized.some((entry) => !entry.text || !entry.source)) {
    throw new Error("Every displayedTextInventory entry requires non-empty text and source fields.");
  }
  return normalized;
}

export function validatePersonalIpMasterAnalysis({ analysis, masterSha256, width, height }) {
  const failures = [];
  if (!analysis || typeof analysis !== "object") failures.push("master visual analysis is missing");
  if (analysis?.status !== "passed-vision-review") failures.push("status must be passed-vision-review");
  if (!["human", "vision"].includes(analysis?.inspectorType)) failures.push("inspectorType must be human or vision");
  if (analysis?.masterSha256 !== masterSha256) failures.push("masterSha256 does not match the selected master");
  if (Number(analysis?.canvas?.width) !== Number(width) || Number(analysis?.canvas?.height) !== Number(height)) failures.push("analysis canvas does not match the selected master dimensions");
  if (!nonEmpty(analysis?.inspectionEvidence?.summary) || !nonEmpty(analysis?.inspectionEvidence?.checkedAt)) failures.push("inspectionEvidence summary and checkedAt are required");
  const objects = Array.isArray(analysis?.objectInventory) ? analysis.objectInventory : [];
  if (!objects.length) failures.push("objectInventory must not be empty");
  const ids = objects.map((item) => String(item?.id || "").trim()).filter(Boolean);
  const duplicateObjectIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (ids.length !== objects.length) failures.push("every master object requires an id");
  if (duplicateObjectIds.length) failures.push(`duplicate master object ids: ${[...new Set(duplicateObjectIds)].join(", ")}`);
  for (const object of objects) {
    const bounds = object?.bounds || {};
    const withinCanvas = [bounds.x, bounds.y, bounds.width, bounds.height].every((value) => Number.isFinite(Number(value)))
      && Number(bounds.x) >= 0
      && Number(bounds.y) >= 0
      && Number(bounds.width) > 0
      && Number(bounds.height) > 0
      && Number(bounds.x) + Number(bounds.width) <= Number(width)
      && Number(bounds.y) + Number(bounds.height) <= Number(height);
    if (!withinCanvas) failures.push(`master object ${object?.id || "<missing>"} has invalid bounds`);
  }
  const roleBindings = analysis?.roleBindings && typeof analysis.roleBindings === "object" ? analysis.roleBindings : {};
  const missingRoleBindings = REQUIRED_MASTER_ROLES.filter((role) => !ids.includes(String(roleBindings[role] || "")));
  if (missingRoleBindings.length) failures.push(`required master role bindings are missing or invalid: ${missingRoleBindings.join(", ")}`);
  const palette = Array.isArray(analysis?.styleTokens?.palette) ? analysis.styleTokens.palette.filter(nonEmpty) : [];
  if (palette.length < 2 || !nonEmpty(analysis?.styleTokens?.typography) || !nonEmpty(analysis?.styleTokens?.material) || !nonEmpty(analysis?.styleTokens?.composition)) {
    failures.push("styleTokens must include palette, typography, material, and composition evidence");
  }
  if (failures.length) throw new Error(`Personal-IP master visual analysis rejected: ${failures.join("; ")}`);
  return {
    ...analysis,
    validation: {
      pass: true,
      objectCount: objects.length,
      duplicateObjectIds: [],
      requiredRoleBindings: REQUIRED_MASTER_ROLES,
      missingRoleBindings: [],
    },
  };
}
