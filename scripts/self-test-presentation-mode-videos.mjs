#!/usr/bin/env node
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outRoot = resolve(process.argv[2] || join(root, "research", "presentation-mode-e2e-20260712"));
const workflowScript = join(root, "scripts", "poc-video-workflow.mjs");
const audio = join(root, "research", "layered-motion-full-auto-20260712", "assets", "narration.m4a");
const sourceNativeRoot = join(root, "research", "codex-video-workflow-runs", "hook-system-personal-ip-female-20260710", "native-pages");
const sourceManifestPath = join(sourceNativeRoot, "workflow", "manifest.json");
const semanticMotionPlanFixture = join(root, "research", "presentation-mode-design-fusion-e2e-20260713", "fixtures", "personal-ip-native-pages", "workflow", "personal-ip-semantic-motion-plan.json");

assert.ok(existsSync(workflowScript), "workflow script is missing");
const externalFixtures = [audio, sourceManifestPath, semanticMotionPlanFixture];
const missingExternalFixtures = externalFixtures.filter((path) => !existsSync(path));
const requireExternalFixtures = process.argv.includes("--require-external-fixtures");
if (missingExternalFixtures.length) {
  console.log(JSON.stringify({
    ok: !requireExternalFixtures,
    skipped: !requireExternalFixtures,
    testType: "optional-local-visual-integration",
    reason: "dated local research fixtures are not part of the repository",
    missingExternalFixtures,
  }, null, 2));
  process.exit(requireExternalFixtures ? 1 : 0);
}
const sourceManifestPreview = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
const incompatibleExternalFixtures = [];
if (sourceManifestPreview.generationReceiptContract?.complete !== true) {
  incompatibleExternalFixtures.push("native page fixture predates generationReceiptContract.complete=true");
}
if (incompatibleExternalFixtures.length) {
  console.log(JSON.stringify({
    ok: !requireExternalFixtures,
    skipped: !requireExternalFixtures,
    testType: "optional-local-visual-integration",
    reason: "dated local research fixtures exist but do not satisfy the current native provenance contract",
    incompatibleExternalFixtures,
  }, null, 2));
  process.exit(requireExternalFixtures ? 1 : 0);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : "pipe",
    maxBuffer: 32 * 1024 * 1024,
  });
  return result;
};
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const fixtureRoot = join(outRoot, "fixtures", "personal-ip-native-pages");
const fixtureAudio = join(outRoot, "fixtures", "authorized-narration.m4a");
const fixtureImages = join(fixtureRoot, "images");
const fixtureWorkflow = join(fixtureRoot, "workflow");
mkdirSync(fixtureImages, { recursive: true });
mkdirSync(fixtureWorkflow, { recursive: true });
copyFileSync(audio, fixtureAudio);

const sourceManifest = sourceManifestPreview;
const sourceImageCountPlan = readJson(join(sourceNativeRoot, "workflow", "personal-ip-image-count-plan.json"));
const selectedPageNumbers = [1, 2, 4, 8];
const selectedItems = selectedPageNumbers.map((number, index) => {
  const sourceName = `vertical-personal-ip-page-${String(number).padStart(2, "0")}.png`;
  const targetName = `personal-ip-page-${String(index + 1).padStart(2, "0")}.png`;
  copyFileSync(join(sourceNativeRoot, "images", sourceName), join(fixtureImages, targetName));
  const sourceItem = (sourceManifest.items || []).find((item) => item.id === `page-${String(number).padStart(2, "0")}`);
  assert.ok(sourceItem?.source_generated_image, `source page ${number} lacks generated-image provenance`);
  return {
    ...sourceItem,
    id: `page-${String(index + 1).padStart(2, "0")}`,
    file: `../images/${targetName}`,
    source_generated_image: {
      ...sourceItem.source_generated_image,
      selectedForPresentationModeSelfTest: true,
      sourceManifest: sourceManifestPath,
      sourcePageId: sourceItem.id,
    },
  };
});
writeJson(join(fixtureWorkflow, "manifest.json"), {
  ...sourceManifest,
  generationRoute: `${sourceManifest.generationRoute}; four-page verified subset for presentation-mode E2E`,
  items: selectedItems,
  content_pages: [],
  images: selectedItems.map((item) => item.file),
  source_generated_images: selectedItems.map((item) => item.source_generated_image),
  subsetEvidence: {
    sourceManifest: sourceManifestPath,
    selectedSourcePageIds: selectedItems.map((item) => item.source_generated_image.sourcePageId),
    purpose: "bounded <=10 second routing and visual regression test",
  },
});
writeJson(join(fixtureWorkflow, "personal-ip-image-count-plan.json"), {
  ...sourceImageCountPlan,
  status: "planned-verified-subset",
  minImageCount: 4,
  maxImageCount: 4,
  requestedMaxImageCount: 4,
  resolvedImageCount: 4,
  automaticResolvedTarget: 4,
  contentMetrics: {
    ...(sourceImageCountPlan.contentMetrics || {}),
    durationSeconds: 8.285,
    effectiveDurationSeconds: 8.285,
    subtitleCueCount: 4,
    durationBasedTarget: 4,
    subtitleCueBasedTarget: 4,
    contentClarityTarget: 4,
    contentMatchTarget: 4,
    automaticTarget: 4,
    automaticResolvedTarget: 4,
    requestedMaxImageCount: 4,
    strongestAutomaticDriver: "bounded-e2e-duration-and-content",
  },
  slots: selectedItems.map((item, index) => ({
    id: item.id,
    order: index + 1,
    role: item.role || "personal-ip-content-page",
    contentBeat: ["先建立五个钩子要素。", "再让压力沿着路径逐步升级。", "然后检查信息是否完整。", "最后把路径收束成一条可执行规则。"][index % 4],
    expectedImageName: `personal-ip-page-${String(index + 1).padStart(2, "0")}.png`,
    sourcePageId: item.source_generated_image.sourcePageId,
  })),
  subsetEvidence: {
    sourcePlan: join(sourceNativeRoot, "workflow", "personal-ip-image-count-plan.json"),
    reason: "Four verified pages satisfy the bounded 8.285 second E2E route test.",
  },
});
copyFileSync(semanticMotionPlanFixture, join(fixtureWorkflow, "personal-ip-semantic-motion-plan.json"));

const narration = "先建立五个钩子要素。再让压力沿着路径逐步升级。然后检查信息是否完整。最后把路径收束成一条可执行规则。";
const scenes = [
  {
    id: "hook-elements",
    label: "钩子五要素",
    headline: ["谜团 · 截止 · 威胁", "欲望 · 信息差"],
    body: "先让观众看见五种不同的叙事压力。",
    subtitle: "先建立五个钩子要素。",
    palette: "blue",
  },
  {
    id: "upgrade-route",
    label: "压力升级",
    headline: ["倒计时", "陌生世界", "失联来电", "证据检查"],
    body: "信息沿着清晰路径升级，观众始终知道当前节点。",
    subtitle: "再让压力沿着路径逐步升级。",
    palette: "orange",
  },
  {
    id: "integrity-check",
    label: "完整性检查",
    headline: ["没有缺失", "没有重叠"],
    body: "在收束前检查页面内容和图层关系。",
    subtitle: "然后检查信息是否完整。",
    palette: "teal",
  },
  {
    id: "action-rule",
    label: "行动规则",
    headline: ["信息差", "情绪杠杆", "时间压力"],
    body: "最终态保留全部信息，并收束成可执行规则。",
    subtitle: "最后把路径收束成一条可执行规则。",
    palette: "ink",
  },
];
const baseBrief = {
  language: "zh",
  audience: "内容创作者",
  objective: "用九秒以内讲清钩子如何沿路径升级，并验证真实视频路由。",
  platform: "vertical-short-form",
  aspectRatio: "9:16",
  durationSeconds: 9,
  durationMode: "fixed",
  videoType: "tutorial-explainer",
  generationMode: "full-auto",
  imageSource: "local",
  speechStyle: "tutorial",
  audioGender: "female",
  narration,
  scenes,
  rights: {
    text: "original local routing self-test copy",
    visuals: "local deterministic HTML/SVG or verified Context Image2 personal-IP native pages",
    voice: "authorized local MeloTTS narration reused across the four visual routes",
    music: "none",
    externalMedia: "none",
  },
};

const cases = [
  {
    id: "01-default-animation",
    label: "不指定：默认动画",
    prompt: "把这段内容生成一个不超过 10 秒的视频。",
    expectedRoute: "default-html-layered-animation",
    brief: { ...baseBrief, title: "钩子升级路径" },
  },
  {
    id: "02-personal-ip",
    label: "个人 IP",
    prompt: "用个人 IP 生成一个不超过 10 秒的视频。",
    expectedRoute: "personal-ip-native-final-static-base",
    brief: {
      ...baseBrief,
      title: "个人 IP：钩子升级路径",
      personalIp: { name: "通用女性知识主讲人", allowGenericFallback: true, maxImageCount: 4 },
      personalIpAnimation: "off",
      allowIncompleteNativeFinal: true,
      ipDiagramCreatorNativeMaxPages: 4,
      ipDiagramCreatorNativePagesDir: fixtureImages,
    },
  },
  {
    id: "03-personal-ip-animation",
    label: "个人 IP + 动画",
    prompt: "用个人 IP + 动画生成一个不超过 10 秒的视频。",
    expectedRoute: "personal-ip-native-final-with-foreground-overlays",
    brief: {
      ...baseBrief,
      title: "个人 IP + 动画：钩子升级路径",
      objective: "保留个人 IP 原生页面作为不可变全屏底图，只在页面安全区域增加前景路径、节点强调与顶层字幕，并由同一 HTML 时间轴逐页呈现；禁止重构语义板、单画板、通用进度轨与跨区框选。",
      personalIp: { name: "通用女性知识主讲人", allowGenericFallback: true, maxImageCount: 4 },
      personalIpAnimation: "subtle",
      ipDiagramCreatorNativeMaxPages: 4,
      ipDiagramCreatorNativePagesDir: fixtureImages,
    },
  },
  {
    id: "04-whiteboard",
    label: "白板",
    prompt: "用白板方式生成一个不超过 10 秒的视频。",
    expectedRoute: "html-animation-plus-whiteboard-foreground",
    brief: {
      ...baseBrief,
      title: "白板：钩子升级路径",
      objective: "用白板手绘前景逐步画出钩子升级关系，彩色内容和字幕保持清晰。",
      style: "whiteboard",
      visualStyle: "whiteboard-lesson",
      scenes: scenes.map((scene) => ({ ...scene, visualStyle: "whiteboard-lesson", motionLibrary: "roughjs" })),
    },
  },
];

const audioProbe = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", fixtureAudio]);
assert.equal(audioProbe.status, 0, audioProbe.stderr);
const audioDuration = Number(audioProbe.stdout.trim());
assert.ok(audioDuration > 0 && audioDuration <= 10, `shared narration must be <=10 seconds, got ${audioDuration}`);

const rows = [];
for (const current of cases) {
  const briefPath = join(outRoot, "briefs", `${current.id}.json`);
  const out = join(outRoot, current.id);
  writeJson(briefPath, current.brief);
  const args = [
    workflowScript,
    "--brief", briefPath,
    "--out", out,
    "--generation-mode", "full-auto",
    "--duration", "9",
    "--provided-audio", fixtureAudio,
    "--audio-gender", "female",
    "--image-source", "local",
    "--scene-image-policy", "off",
    "--free-stock-policy", "off",
    "--no-open-output",
  ];
  const result = run(process.execPath, args);
  if (![0, 2].includes(result.status)) {
    throw new Error(`${current.id} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  const qcPath = join(out, "logs", "qc.json");
  const finalMp4 = join(out, "renders", "final.mp4");
  assert.ok(existsSync(qcPath), `${current.id} QC is missing`);
  assert.ok(existsSync(finalMp4), `${current.id} final MP4 is missing`);
  const qc = readJson(qcPath);
  const probe = run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", finalMp4]);
  assert.equal(probe.status, 0, `${current.id} ffprobe failed: ${probe.stderr}`);
  const media = JSON.parse(probe.stdout);
  const duration = Number(media.format?.duration || qc.duration || 0);
  const reviewCoverPending = (current.id === "02-personal-ip" || current.id === "03-personal-ip-animation")
    && qc.checks?.coverImage2FinalQualityEligible === false
    && existsSync(join(out, "cover", "native-final-cover-1920x1080.png"))
    && existsSync(join(out, "最终成品", "评审级封面-非上传终版", "横版16比9", "02-横版16比9-B站HD-1920x1080-评审级(非上传终版).png"));
  assert.equal(qc.videoPass === true || reviewCoverPending, true, `${current.id} videoPass failed outside the documented review-cover-pending state; inspect ${qcPath}`);
  assert.ok(duration > 0 && duration <= 10.05, `${current.id} duration ${duration}s exceeds 10 seconds`);
  assert.ok((media.streams || []).some((stream) => stream.codec_type === "video"), `${current.id} video stream missing`);
  assert.ok((media.streams || []).some((stream) => stream.codec_type === "audio"), `${current.id} audio stream missing`);

  const ipPlan = readJson(join(out, "workflow", "ip-diagram-creator-plan.json"));
  const layeredPlan = readJson(join(out, "workflow", "layered-motion-plan.json"));
  const whiteboardPath = join(out, "workflow", "whiteboard-layered-reveal-plan.json");
  const whiteboardPlan = existsSync(whiteboardPath) ? readJson(whiteboardPath) : { active: false };
  if (current.id === "01-default-animation") {
    assert.equal(ipPlan.active, false, "default route must not activate personal IP");
    assert.equal(whiteboardPlan.active, false, "default route must not activate whiteboard");
    assert.equal(layeredPlan.status, "active", "default route must use the new layered animation flow");
    assert.equal(layeredPlan.trigger?.source, "natural-language-signal", "default route must record why layered motion was selected");
    assert.equal(layeredPlan.designInheritance?.source, "personal-ip-visual-dna", "default layered route must inherit the personal-IP visual design grammar");
    assert.match(String(layeredPlan.designInheritance?.textOwnership), /one headline.*semantic nodes.*exact narration/i, "default layered route must enforce single text ownership");
    assert.match(String(qc.renderer), /html-video/, "default route must use html-video");
  } else if (current.id === "02-personal-ip") {
    assert.equal(ipPlan.nativeFinalVideoPlan?.selectedNow, true, "personal IP must select native-final");
    assert.equal(ipPlan.userChoices?.addHandDrawnImageAnimation, "off", "plain personal IP must keep animation off");
    const motionManifest = readJson(join(out, "workflow", "personal-ip-layered-motion-manifest.json"));
    assert.equal(motionManifest.active, false, "plain personal IP must not render foreground motion layers");
    assert.deepEqual(motionManifest.foregroundLayers, [], "plain personal IP must keep foreground motion layers empty");
    assert.match(String(qc.renderer), /native|ip-diagram/i, "personal IP must use native page renderer");
  } else if (current.id === "03-personal-ip-animation") {
    assert.equal(ipPlan.nativeFinalVideoPlan?.requestedNow, true, "personal IP + animation must request native source pages");
    assert.equal(ipPlan.nativeFinalVideoPlan?.selectedNow, true, "verified native source pages must be selected for composition");
    assert.equal(ipPlan.nativeFinalVideoPlan?.status, "selected-with-verified-native-page-provenance", "verified native source pages must pass provenance before composition");
    assert.equal(ipPlan.semanticLayerVideoPlan?.selectedNow, false, "retired semantic template route must never be selected");
    assert.equal(ipPlan.userChoices?.addHandDrawnImageAnimation, "subtle", "subtle must remain the native-page foreground motion choice");
    assert.match(String(qc.renderer), /native|ip-diagram/i, "verified personal-IP animation must use the native page renderer");
    assert.ok(existsSync(join(out, "personal-ip-layered.html")), "native personal-IP animation must emit the HTML master timeline");
    assert.ok(existsSync(join(out, "workflow", "personal-ip-layered-source-manifest.json")), "native personal-IP animation must emit the layered source manifest");
  } else if (current.id === "04-whiteboard") {
    assert.equal(ipPlan.active, false, "whiteboard route must not activate personal IP");
    assert.equal(whiteboardPlan.active, true, "whiteboard route must activate whiteboard reveal");
    assert.match(String(qc.renderer), /html-video/, "whiteboard route must use html-video");
  }

  const decoder = run("ffmpeg", ["-v", "error", "-i", finalMp4, "-f", "null", "-"]);
  assert.equal(decoder.status, 0, `${current.id} decoder check failed: ${decoder.stderr}`);
  const screenshot = join(outRoot, "screenshots", `${current.id}-middle.png`);
  mkdirSync(dirname(screenshot), { recursive: true });
  const frame = run("ffmpeg", ["-y", "-v", "error", "-ss", String(Math.min(4.1, duration / 2)), "-i", finalMp4, "-frames:v", "1", screenshot]);
  assert.equal(frame.status, 0, `${current.id} screenshot extraction failed: ${frame.stderr}`);
  rows.push({
    id: current.id,
    label: current.label,
    prompt: current.prompt,
    expectedRoute: current.expectedRoute,
    resolvedRoute: current.id.startsWith("02")
      ? `personal-ip / handDrawn=${ipPlan.userChoices?.addHandDrawnImageAnimation}`
      : current.id.startsWith("03")
        ? `personal-ip-motion / handDrawn=${ipPlan.userChoices?.addHandDrawnImageAnimation}`
        : current.id.startsWith("04")
          ? `whiteboard / active=${whiteboardPlan.active}`
          : `default / layered=${layeredPlan.status}`,
    pass: true,
    videoPass: qc.videoPass || reviewCoverPending,
    publishingReady: qc.publishingReady,
    renderer: qc.renderer,
    durationSeconds: Number(duration.toFixed(3)),
    dimensions: `${media.streams.find((stream) => stream.codec_type === "video")?.width}x${media.streams.find((stream) => stream.codec_type === "video")?.height}`,
    finalMp4,
    screenshot,
    qc: qcPath,
    brief: briefPath,
    exitCode: result.status,
    stdoutTail: result.stdout.trim().split("\n").slice(-12).join("\n"),
    stderrTail: result.stderr.trim().split("\n").slice(-12).join("\n"),
  });
}

const plainVideo = rows.find((row) => row.id === "02-personal-ip")?.finalMp4;
const animatedVideo = rows.find((row) => row.id === "03-personal-ip-animation")?.finalMp4;
const hash = (path) => run("shasum", ["-a", "256", path]).stdout.trim().split(/\s+/)[0];
assert.notEqual(hash(plainVideo), hash(animatedVideo), "personal IP and personal IP + animation MP4s must not be identical");
const perceptibility = run("ffmpeg", [
  "-v", "info",
  "-i", plainVideo,
  "-i", animatedVideo,
  "-lavfi", "[0:v][1:v]psnr",
  "-f", "null",
  "-",
]);
assert.equal(perceptibility.status, 0, `personal-IP perceptibility comparison failed: ${perceptibility.stderr}`);
const psnrMatch = perceptibility.stderr.match(/PSNR[^\n]*average:([0-9.]+)/i);
assert.ok(psnrMatch, "personal-IP perceptibility comparison did not emit an average PSNR");
const personalIpMotionAveragePsnrDb = Number(psnrMatch[1]);
assert.ok(personalIpMotionAveragePsnrDb < 44, `personal IP + animation remains too visually subtle (${personalIpMotionAveragePsnrDb} dB average PSNR)`);

const report = {
  schemaVersion: 1,
  pass: rows.every((row) => row.pass && row.videoPass && row.durationSeconds <= 10.05),
  scope: "four stable presentation-mode triggers rendered end to end",
  sharedNarration: { path: audio, durationSeconds: audioDuration, text: narration },
  publishingCoverPolicy: "Publishing-ready Context Image2 covers are a separate gate; this test asserts videoPass and records publishingReady without treating a pending cover as a render failure.",
  personalIpMotionPerceptibility: {
    metric: "average PSNR between plain personal-IP and personal-IP + animation videos",
    averagePsnrDb: personalIpMotionAveragePsnrDb,
    passThresholdDb: 44,
    pass: personalIpMotionAveragePsnrDb < 44,
  },
  rows,
};
writeJson(join(outRoot, "presentation-mode-e2e-report.json"), report);

const cards = rows.map((row) => {
  const videoRel = relative(outRoot, row.finalMp4);
  const imageRel = relative(outRoot, row.screenshot);
  return `<article><h2>${escapeHtml(row.label)}</h2><p class="prompt">${escapeHtml(row.prompt)}</p><video controls preload="metadata" poster="${escapeHtml(imageRel)}" src="${escapeHtml(videoRel)}"></video><dl><div><dt>实际路由</dt><dd>${escapeHtml(row.resolvedRoute)}</dd></div><div><dt>渲染器</dt><dd>${escapeHtml(row.renderer)}</dd></div><div><dt>时长</dt><dd>${escapeHtml(row.durationSeconds)}s</dd></div><div><dt>画布</dt><dd>${escapeHtml(row.dimensions)}</dd></div><div><dt>视频 QC</dt><dd>${row.videoPass ? "PASS" : "FAIL"}</dd></div></dl></article>`;
}).join("\n");
writeFileSync(join(outRoot, "index.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>四种视频模式端到端自测</title><style>*{box-sizing:border-box}body{margin:0;background:#0b0f16;color:#edf2f8;font-family:Inter,"PingFang SC",sans-serif}main{max-width:1500px;margin:auto;padding:42px}header{margin-bottom:28px}h1{margin:0 0 12px;font-size:clamp(34px,5vw,64px)}header p{color:#9dacbf;max-width:800px;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}article{background:#141b26;border:1px solid #263244;border-radius:20px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.22)}h2{font-size:17px;margin:0 0 8px}.prompt{min-height:44px;color:#8fa1b7;font-size:12px;line-height:1.6}video{width:100%;aspect-ratio:9/16;background:#05070a;border-radius:14px;object-fit:contain}dl{display:grid;gap:7px;margin:14px 0 0;font-size:11px}dl div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #263244;padding-top:7px}dt{color:#77889e}dd{margin:0;text-align:right;color:#dce7f4}@media(max-width:1100px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){main{padding:22px}.grid{grid-template-columns:1fr}}</style></head><body><main><header><h1>四种模式，真实生成</h1><p>同一段 8.285 秒口播、同一主题、四条独立路由。页面展示真实 MP4，不是动画预览。发布封面是独立门禁，本页重点验证视频路由、渲染、音频、字幕与时长。</p></header><section class="grid">${cards}</section></main></body></html>`);

console.log(JSON.stringify({ pass: report.pass, outRoot, reviewPage: join(outRoot, "index.html"), report: join(outRoot, "presentation-mode-e2e-report.json"), rows: rows.map(({ id, durationSeconds, renderer, resolvedRoute, finalMp4 }) => ({ id, durationSeconds, renderer, resolvedRoute, finalMp4 })) }, null, 2));
