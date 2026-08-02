#!/usr/bin/env node

import { cleanupIntermediateVideoArtifacts } from "./lib/intermediate-video-cleanup.mjs";

const outIndex = process.argv.indexOf("--out");
const out = outIndex >= 0 ? process.argv[outIndex + 1] : null;
if (!out) throw new Error("Usage: node scripts/cleanup-video-intermediates.mjs --out <output-directory>");

const manifest = cleanupIntermediateVideoArtifacts({ out, reason: "manual-post-delivery-cleanup" });
console.log(JSON.stringify(manifest, null, 2));
