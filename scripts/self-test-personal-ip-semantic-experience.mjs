#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyPersonalIpSemanticLayout } from "./lib/personal-ip-semantic-scene-planner.mjs";

const fixtures = [
  { id: "quote", spokenText: "《红楼梦》里，王熙凤还没有露面，声音就先到了。", methodologyVisualUnits: [] },
  { id: "forces", spokenText: "把人物的欲望、目标、需要和误信念拆开。", methodologyVisualUnits: [{ kind: "table", text: "欲望；目标；需要；误信念" }] },
  { id: "causal", spokenText: "误信念产生保护性策略，策略导致错误选择，选择制造后果。", methodologyVisualUnits: [{ kind: "steps", text: "误信念因果链" }] },
  { id: "branches", spokenText: "设计三个错误选择，并给每个选择一个更合理的替代项和后果。", methodologyVisualUnits: [{ kind: "table", text: "错误选择；替代行动；后果" }] },
  { id: "resources", spokenText: "对手用信息、权限、关系和物理资源形成三阶升级。", methodologyVisualUnits: [{ kind: "table", text: "资源；动作；限制或代价" }] },
  { id: "score", spokenText: "最后用一百分评分量表检查人物选择系统。", methodologyVisualUnits: [{ kind: "scorecard", text: "100 分评分量表" }] },
  { id: "checklist", spokenText: "逐项检查欲望、目标、需要和误信念是否成立。", methodologyVisualUnits: [{ kind: "checklist", text: "完成前检查" }] },
];

const classified = fixtures.map((fixture, index) => classifyPersonalIpSemanticLayout({
  ...fixture,
  beatIndex: index + 1,
  beatCount: fixtures.length,
}));
const variants = new Set(classified.map((item) => item.layoutVariant));

assert.equal(classified[0].layoutVariant, "quote-stage", "literary opening should use a quote-led composition");
assert.equal(classified[1].layoutVariant, "force-compass", "desire/goal/need/misbelief should use the four-force composition");
assert.equal(classified[2].layoutVariant, "causal-chain", "causal content should use a causal chain");
assert.equal(classified[3].layoutVariant, "choice-branches", "choice alternatives should branch visually");
assert.equal(classified[4].layoutVariant, "resource-pressure-map", "opponent resources should use a pressure map");
assert.equal(classified[5].layoutVariant, "scorecard", "scoring content should use a scorecard");
assert.equal(classified[6].layoutVariant, "action-checklist", "checklist content should use an action checklist");
assert.ok(variants.size >= 7, `expected content-driven layout diversity, received ${variants.size}`);
assert.ok(classified.every((item) => item.contentKind && item.motionVerb && item.visualMetaphor), "every layout decision needs semantic evidence");
const openingBeatLayouts = [
  classifyPersonalIpSemanticLayout({
    beatIndex: 1,
    title: "《红楼梦》里",
    subtitle: "我来迟了，不曾迎接远客。",
    spokenText: "《红楼梦》里，王熙凤还没有露面，声音就先到了。",
    semanticUnits: ["《红楼梦》里，王熙凤还没有露面，声音就先到了。"],
  }),
  classifyPersonalIpSemanticLayout({
    beatIndex: 2,
    title: "人物一行动，就暴露选择系统",
    subtitle: "人物一行动，我们就能迅速看见四样东西。",
    spokenText: "人物一行动，我们就能迅速看见四样东西：他想要什么、他要完成什么、他认定什么方法最有效，以及最后的代价。",
  }),
  classifyPersonalIpSemanticLayout({
    beatIndex: 3,
    title: "七张表",
    subtitle: "这节课真正要完成的是七张可以直接拿去写故事的表。",
    spokenText: "这节课真正要完成的是七张可以直接拿去写故事的表。第一张，主角四项动力表。第二张，误信念因果链。",
  }),
  classifyPersonalIpSemanticLayout({
    beatIndex: 4,
    title: "人物系统的结果",
    subtitle: "一张100分评分表，判断人物系统是否可运行。",
    spokenText: "最后用一张100分评分表，判断你写出来的是可运行的人物系统，还是资料堆。",
  }),
].map((item) => item.layoutVariant);
assert.deepEqual(openingBeatLayouts, ["quote-stage", "force-compass", "method-path", "scorecard"], "opening beats must use four distinct content-specific compositions");
const genericInstruction = classifyPersonalIpSemanticLayout({ spokenText: "目标必须可观察、可完成，也可以失败。现在把答案写进人物档案。" });
assert.notEqual(genericInstruction.layoutVariant, "action-checklist", "generic words such as 必须 may not collapse ordinary teaching content into the checklist template");

const workflow = readFileSync(new URL("./poc-video-workflow.mjs", import.meta.url), "utf8");
const semanticRenderer = readFileSync(new URL("./export-personal-ip-semantic-layered-video.mjs", import.meta.url), "utf8");
assert.match(workflow, /function personalIpSemanticLayerRouteSelected[\s\S]*?semanticLayerVideoPlan[\s\S]*?selectedNow\s*===\s*true/, "personal-IP animation must select the semantic-layer route");
assert.doesNotMatch(workflow, /function renderWithPersonalIpSemanticLayers[\s\S]{0,500}?Retired personal-IP semantic template route/, "semantic renderer must remain reachable");
assert.match(workflow, /personalIpNativeRouteRequested\s*&&\s*personalIpAnimationChoice\s*===\s*"semantic-layers"/, "only the explicit semantic-layer enum may enter the new personal-IP animation route");
assert.match(workflow, /Preserve the historical native-page foreground-overlay meanings/, "legacy subtle and draw-reveal contracts must remain isolated from the new route");
assert.match(semanticRenderer, /personal-ip-semantic-decomposition\.json/, "semantic renderer must emit a master-bound decomposition contract");
assert.match(semanticRenderer, /noFullPageBitmapInRuntimeSvg/, "semantic renderer must reject a full-page bitmap runtime owner");
assert.match(semanticRenderer, /requiredLayerRolesPresent/, "semantic renderer must validate the complete layer stack");
assert.match(semanticRenderer, /masterReferenceBoundByHash/, "semantic renderer must bind the master by hash");

process.stdout.write(`${JSON.stringify({
  pass: true,
  route: "personal-ip-semantic-layers-svg-html-video",
  variants: classified.map((item) => ({ id: item.id, contentKind: item.contentKind, layoutVariant: item.layoutVariant })),
}, null, 2)}\n`);
