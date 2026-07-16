#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditNativeCaptionSafeAreas,
  loadNativePageProvenance,
} from "./render-ip-diagram-native-pages.mjs";

const workspace = resolve(process.env.CODEX_VIDEO_WORKFLOW_TEST_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const rendererPath = join(workspace, "scripts", "render-ip-diagram-native-pages.mjs");
const source = readFileSync(rendererPath, "utf8");
const workflowPath = join(workspace, "scripts", "poc-video-workflow.mjs");
const workflowSource = readFileSync(workflowPath, "utf8");
const htmlTimelineRendererPath = join(workspace, "scripts", "lib", "render-native-html-timeline.mjs");
const htmlTimelineRenderer = readFileSync(htmlTimelineRendererPath, "utf8");
const failures = [];

function expect(pattern, message) {
  const passed = typeof pattern === "boolean" ? pattern : pattern.test(source);
  if (!passed) failures.push(message);
}

expect(/#stage\{[\s\S]{0,220}isolation:isolate/, "native-page HTML must create an isolated stacking context");
expect(/#stage\{[\s\S]{0,160}--caption-safe-bottom:/.test(source) ? /#stage\{[\s\S]{0,160}--caption-safe-bottom:/ : /captionSafeArea/, "native-page HTML must reserve a bottom caption safe band");
expect(/#caption-safe-band\{[^}]*height:var\(--caption-safe-bottom\)[^}]*z-index:80/, "native-page HTML must render a real caption-safe geometry layer below subtitles");
expect(/#native-page\{[^}]*z-index:0|object-fit:fill;z-index:0/, "native page base must be fixed at z-index 0");
expect(/#foreground\{[^}]*z-index:40/, "foreground motion must be fixed at z-index 40");
expect(/#caption\{[^}]*z-index:100|justify-content:center;pointer-events:none;z-index:100/, "subtitle layer must be fixed at z-index 100");
expect(/data-layer-contract=[^\n]+native-base:0,foreground:40,caption-safe-band:80,subtitle:100,caption-safe-bottom:/, "rendered HTML must expose the 0/40/80/100 layer contract plus the caption safe band");
expect(/zOrder:\s*\{\s*nativeBase:\s*0,\s*foregroundMotion:\s*40,\s*subtitles:\s*100\s*\}/, "source manifest must record the actual HTML layer order");
expect(/stackingContext:\s*"#stage isolation:isolate"/, "source manifest must record subtitle stacking isolation");
expect(/captionSafeAreaAudit:\s*"workflow\/frame-layout-overlap-audit\.json"/, "source manifest must bind caption safety to the executable overlap audit");
expect(/height="\$\{canvas\.height\}" preserveAspectRatio="none" data-caption-safe-bottom=/, "exported native base SVG must retain the full canvas height");
expect(/pageWindowsFromCueBoundaries/.test(source), "native page cuts must be derived from subtitle cue boundaries");
expect(/awaitImageDecode/.test(htmlTimelineRenderer), "HTML timeline renderer must wait for each switched native page to decode");
expect(/requestAnimationFrame/.test(htmlTimelineRenderer), "HTML timeline renderer must settle layout for two animation frames before capture");
expect(/captionSafeAreaPixelAuditPass/.test(source), "native renderer QC must hard-gate executable caption-safe pixel evidence");
expect(/measurementEngine:\s*"ffmpeg-decoded-rgb24-bottom-band"/.test(source), "native caption-safe evidence must identify its real decoded-pixel measurement engine");

expect(/const artifactPath = join\(out, "workflow", "frame-layout-overlap-audit\.json"\);[\s\S]{0,240}renderer === "ip-diagram-native-final-pages"[\s\S]{0,240}readJsonIfExists\(artifactPath\)/.test(workflowSource), "parent QC must preserve the native renderer's overlap audit instead of replacing it with a skipped artifact");
expect(/nativeCaptionAuditOk[\s\S]{0,1800}frameLayoutNoTextVisualOverlap:\s*nativeArtifactOk\s*&&\s*nativeCaptionAuditOk/.test(workflowSource), "native-final frame overlap must be decided by checked native caption audit evidence");
expect(/captionStylePlanEnforced:\s*checks\.captionStylePlanPresent\s*&&\s*nativeCaptionAuditOk/.test(workflowSource), "native caption-style enforcement must require executable render/audit evidence, not artifact presence alone");
expect(/generationReceiptContractComplete/.test(source), "native provenance must hard-gate a complete manifest generation-receipt contract");
expect(/generationReceiptOutputHashMatches/.test(source), "native provenance must compare each receipt output hash with the actual page file hash");
expect(/generationReceiptRequestIdsUnique/.test(source), "native provenance must reject reused generation request ids");
expect(/generationReceiptOutputHashesUnique/.test(source), "native provenance must reject reused receipt output hashes");

function ppm({ width, height, unsafeBottom = false }) {
  const pixels = Buffer.alloc(width * height * 3, 255);
  if (unsafeBottom) {
    const startY = Math.floor(height * 0.82);
    for (let y = startY; y < height; y += 1) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 1) {
        const offset = (y * width + x) * 3;
        pixels[offset] = 20;
        pixels[offset + 1] = 20;
        pixels[offset + 2] = 20;
      }
    }
  }
  return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]);
}

const temp = mkdtempSync(join(tmpdir(), "native-caption-safe-"));
try {
  const safePage = join(temp, "safe.ppm");
  const unsafePage = join(temp, "unsafe.ppm");
  writeFileSync(safePage, ppm({ width: 160, height: 90 }));
  writeFileSync(unsafePage, ppm({ width: 160, height: 90, unsafeBottom: true }));
  const canvas = { width: 160, height: 90 };
  const safeArea = { bottomPx: 18 };
  const safe = auditNativeCaptionSafeAreas({ pages: [{ id: "safe", file: safePage }], canvas, safeArea });
  const unsafe = auditNativeCaptionSafeAreas({ pages: [{ id: "unsafe", file: unsafePage }], canvas, safeArea });
  assert.equal(safe.status, "pass", "real blank bottom band must pass native caption-safe pixel audit");
  assert.equal(safe.checkedFrames, 1, "native caption-safe audit must report checked evidence");
  assert.equal(unsafe.status, "fail", "real bottom-band content must fail native caption-safe pixel audit");
  assert.ok(unsafe.collisionCount > 0, "unsafe native page must report a caption-safe collision");

  const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const secondPage = join(temp, "second.ppm");
  writeFileSync(secondPage, ppm({ width: 160, height: 90, unsafeBottom: true }));
  const pages = [
    { id: "safe", file: safePage },
    { id: "second", file: secondPage },
  ];
  const manifestPath = join(temp, "manifest.json");
  const receiptFor = (requestId, path) => ({
    recordedAtDispatch: true,
    requestId,
    promptSha256: createHash("sha256").update(`prompt:${requestId}`).digest("hex"),
    outputSha256: sha256(path),
    personaReferenceBound: true,
  });
  writeFileSync(manifestPath, `${JSON.stringify({
    generation_route: "built-in image_gen generated_images",
    generationReceiptContract: { complete: true },
    items: pages.map((page, index) => ({
      path: page.file,
      source_generated_image: { provider: "codex-context-image2" },
      personaReferenceBoundToGeneration: true,
      generationReceipt: receiptFor(`request-${index + 1}`, page.file),
    })),
  }, null, 2)}\n`);
  const verifiedReceipts = loadNativePageProvenance(temp, pages);
  assert.equal(verifiedReceipts.status, "pass", "complete unique generation receipts bound to actual page hashes must pass");
  assert.equal(verifiedReceipts.generationReceiptsVerified, pages.length);

  const duplicateRequestManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  duplicateRequestManifest.items[1].generationReceipt.requestId = duplicateRequestManifest.items[0].generationReceipt.requestId;
  writeFileSync(manifestPath, `${JSON.stringify(duplicateRequestManifest, null, 2)}\n`);
  const duplicateRequest = loadNativePageProvenance(temp, pages);
  assert.equal(duplicateRequest.status, "fail", "reused generation request ids must fail native provenance");
  assert.equal(duplicateRequest.generationReceiptRequestIdsUnique, false);

  const missingDispatchEvidenceManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  missingDispatchEvidenceManifest.items[1].generationReceipt.requestId = "request-2";
  delete missingDispatchEvidenceManifest.items[0].generationReceipt.recordedAtDispatch;
  writeFileSync(manifestPath, `${JSON.stringify(missingDispatchEvidenceManifest, null, 2)}\n`);
  const missingDispatchEvidence = loadNativePageProvenance(temp, pages);
  assert.equal(missingDispatchEvidence.status, "fail", "ingest-time synthesized receipts without dispatch evidence must fail native provenance");

  delete missingDispatchEvidenceManifest.generationReceiptContract;
  writeFileSync(manifestPath, `${JSON.stringify(missingDispatchEvidenceManifest, null, 2)}\n`);
  const missingContract = loadNativePageProvenance(temp, pages);
  assert.equal(missingContract.status, "fail", "old native packages without a complete generation receipt contract must fail");
  assert.equal(missingContract.generationReceiptContractComplete, false);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failures.length) {
  throw new Error(`native subtitle layering regression:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify({
  ok: true,
  rendererPath,
  zOrder: { nativeBase: 0, foregroundMotion: 40, subtitles: 100 },
}, null, 2));
