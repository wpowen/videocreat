#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const temp = mkdtempSync(join(tmpdir(), "personal-ip-ownership-"));

try {
  const width = 12;
  const height = 8;
  const pixels = Buffer.alloc(width * height * 3, 255);
  for (let y = 2; y <= 5; y += 1) {
    for (let x = 1; x <= 10; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
    }
  }
  const master = join(temp, "master.ppm");
  writeFileSync(master, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]));
  const spec = join(temp, "spec.json");
  writeFileSync(spec, `${JSON.stringify({
    schemaVersion: 1,
    route: "personal-ip-semantic-layers-svg-html-video",
    scopeIsolation: "personal-ip-animation-only",
    master,
    canvas: [width, height],
    owners: [
      { id: "unit-a", role: "content-unit", zIndex: 40, revealGroup: "unit-a", components: ["card-a", "agent-a"], selector: "ink", rect: [1, 1, 7, 6] },
      { id: "unit-b", role: "content-unit", zIndex: 40, revealGroup: "unit-b", components: ["card-b", "agent-b"], selector: "ink", rect: [5, 1, 6, 6] },
    ],
  }, null, 2)}\n`);
  const output = join(temp, "layers");
  const auditPath = join(temp, "ownership-audit.json");
  const result = spawnSync("python3", [
    join(root, "scripts", "build-personal-ip-exclusive-layers.py"),
    "--spec", spec,
    "--out", output,
    "--audit", auditPath,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const audit = JSON.parse(readFileSync(auditPath, "utf8"));
  assert.equal(audit.pass, true);
  assert.equal(audit.scopeIsolation, "personal-ip-animation-only");
  assert.equal(audit.ownershipContract.duplicateOwnerPixelCount, 0);
  assert.deepEqual(audit.ownershipContract.duplicateOwnerPairs, []);
  assert.deepEqual(audit.ownershipContract.opaqueContentSlices, []);
  assert.deepEqual(audit.layers.map((layer) => layer.components), [["card-a", "agent-a"], ["card-b", "agent-b"]]);
  assert.ok(audit.layers[0].opaquePixelCount > audit.layers[1].opaquePixelCount, "priority owner must claim shared source pixels exactly once");
  console.log(JSON.stringify({ pass: true, route: audit.route, duplicateOwnerPixelCount: 0, atomicUnits: audit.layers.length }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
