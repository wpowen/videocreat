#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanupFileName(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.file === "string") return value.file;
  return "";
}

function targetKey(id = "") {
  if (id === "master-16x9-3840x2160") return "master-16x9-4k";
  if (id === "bilibili-1146x717") return "bilibili-common-1146x717";
  return id;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function ratioLabel(width, height) {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function inferGroup(targetId, width, height) {
  if (/bilibili/i.test(targetId)) return "B站封面";
  if (/reels/i.test(targetId)) return "Reels封面";
  if (/vertical-profile|3x4|3-4/i.test(targetId)) return "竖版3比4";
  if (/vertical/i.test(targetId)) return "竖版9比16";
  if (/square/i.test(targetId) || width === height) return "方形1比1";
  if (/4x3|4-3/i.test(targetId)) return "横版4比3";
  return "横版16比9";
}

function standardCoverFileForTarget(targetId) {
  const files = {
    "master-16x9-4k": "cover/cover-master-16x9-3840x2160.png",
    "horizontal-16x9-1920x1080": "cover/cover-16x9-1920x1080.png",
    "horizontal-16x9-1280x720": "cover/cover-16x9-1280x720.png",
    "horizontal-4x3-1600x1200": "cover/cover-horizontal-4x3-1600x1200.png",
    "bilibili-common-1146x717": "cover/cover-bilibili-1146x717.png",
    "vertical-1080x1920": "cover/cover-vertical-1080x1920.png",
    "vertical-profile-1080x1440": "cover/cover-vertical-profile-1080x1440.png",
    "instagram-reels-cover": "cover/cover-instagram-reels-420x654.png",
    "square-1200x1200": "cover/cover-square-1200x1200.png",
  };
  return files[targetKey(targetId)] || "";
}

function presetFiles({ topicDir, preset }) {
  const file = preset?.file ? String(preset.file) : standardCoverFileForTarget(preset?.id);
  if (!file) return [];
  const stem = file.replace(/\.[^.]+$/, "");
  return ["png", "jpg"]
    .map((format) => ({ format, file: `${stem}.${format}` }))
    .filter((candidate) => existsSync(join(topicDir, candidate.file)));
}

function isSameRatio16x9(width, height) {
  return width > 0 && height > 0 && Math.abs(width / height - 16 / 9) < 0.001;
}

function mergePresetFilesIntoEntry({ topicDir, entry, preset }) {
  const files = presetFiles({ topicDir, preset });
  if (files.length === 0) return entry;
  const width = Number(entry.width || preset.width || 0);
  const height = Number(entry.height || preset.height || 0);
  const canBeUploadReady =
    entry.uploadReady === true ||
    entry.image2NativeTargetRatioReady === true ||
    preset.uploadReady === true ||
    preset.image2NativeTargetRatioReady === true ||
    isSameRatio16x9(width, height);
  const internalReviewFiles = [
    ...new Set([...(entry.internalReviewFiles || []), ...files.map((file) => file.file)]),
  ];
  if (!canBeUploadReady) return { ...entry, internalReviewFiles };
  return {
    ...entry,
    width,
    height,
    ratio: entry.ratio || ratioLabel(width, height),
    targetRatio: entry.targetRatio || width / height,
    qualityStatus: "upload-ready-native-target-ratio",
    uploadReady: true,
    needsRegeneration: false,
    requiresNativeImage2TargetRatio: entry.requiresNativeImage2TargetRatio ?? true,
    image2NativeTargetRatioReady: true,
    localTargetRatioRecomposition: false,
    targetRatioNativeMatch: true,
    sourceAssetRatio: entry.sourceAssetRatio || ratioLabel(width, height),
    selectedAsset: entry.selectedAsset || {
      status: "available",
      provider: "cover-design-resolution-preset",
      mode: "exact-target-ratio-file",
      source: preset.file,
    },
    internalReviewFiles,
    files,
  };
}

function entryFromMissingResolutionPreset({ topicDir, preset, title }) {
  const key = targetKey(preset?.id);
  if (!key || /^video-opening/.test(key) || !standardCoverFileForTarget(key)) return null;
  const width = Number(preset.width || 0);
  const height = Number(preset.height || 0);
  if (!width || !height) return null;
  const files = presetFiles({ topicDir, preset });
  const nativeReady = preset.uploadReady === true && preset.image2NativeTargetRatioReady === true && files.length > 0;
  const sameRatioReady = isSameRatio16x9(width, height) && files.length > 0;
  const uploadReady = nativeReady || sameRatioReady;
  return {
    targetId: key,
    label: preset.label || `${title}-${width}x${height}`,
    group: inferGroup(key, width, height),
    width,
    height,
    ratio: preset.ratio || ratioLabel(width, height),
    note: uploadReady
      ? "cover-design resolutionPresets 已存在可用同目标比例文件，批量索引自动补入最终目录。"
      : "cover-design resolutionPresets 声明了该标准目标，但当前缺少原生 Image 2/Codex 目标比例封面，需补充生成。",
    qualityStatus: uploadReady ? "upload-ready-native-target-ratio" : "needs-native-target-ratio-image2",
    uploadReady,
    needsRegeneration: !uploadReady,
    requiresNativeImage2TargetRatio: true,
    image2NativeTargetRatioReady: uploadReady,
    localTargetRatioRecomposition: false,
    targetRatioNativeMatch: uploadReady,
    sourceAssetRatio: uploadReady ? ratioLabel(width, height) : preset.sourceAssetRatio || "未知",
    targetRatio: width / height,
    selectedAsset: uploadReady
      ? {
          status: "available",
          provider: "cover-design-resolution-preset",
          mode: "exact-target-ratio-file",
          source: preset.file,
        }
      : null,
    rootFiles: [],
    internalReviewFiles: files.map((file) => file.file),
    files: uploadReady ? files : [],
    previewFiles: [],
  };
}

function selectionEntriesWithResolutionPresets({ topicDir, coverDesign, selection, title }) {
  const presets = Array.isArray(coverDesign.resolutionPresets) ? coverDesign.resolutionPresets : [];
  const presetByKey = new Map(presets.map((preset) => [targetKey(preset.id), preset]));
  const baseEntries = (selection.entries || []).map((entry) =>
    mergePresetFilesIntoEntry({ topicDir, entry, preset: presetByKey.get(targetKey(entry.targetId)) }),
  );
  const knownKeys = new Set(baseEntries.map((entry) => targetKey(entry.targetId)));
  const added = [];
  for (const preset of presets) {
    const key = targetKey(preset.id);
    if (!key || knownKeys.has(key) || /^video-opening/.test(key)) continue;
    const entry = entryFromMissingResolutionPreset({ topicDir, preset, title });
    if (!entry) continue;
    added.push(entry);
    knownKeys.add(key);
  }
  return [...baseEntries, ...added];
}

function candidateSourceForEntry({ topicDir, coverDesign, entry, format }) {
  for (const file of entry.files || []) {
    if (file.format === format && file.file) {
      const source = join(topicDir, file.file);
      if (existsSync(source)) return source;
    }
  }
  for (const file of entry.internalReviewFiles || []) {
    if (typeof file !== "string" || !file.toLowerCase().endsWith(`.${format}`)) continue;
    const source = join(topicDir, file);
    if (existsSync(source)) return source;
  }
  const rasterVariant = (coverDesign.rasterExport?.variants || []).find((variant) => variant.targetId === entry.targetId);
  for (const file of rasterVariant?.files || []) {
    if (file.format !== format || !file.file) continue;
    const source = join(topicDir, file.file);
    if (existsSync(source)) return source;
  }
  return null;
}

function cleanRootCoverCopies({ batchRoot, topicDir, coverDesign, selection, cleanedTopicFiles }) {
  const cleanupCandidates = new Set([
    ...(Array.isArray(coverDesign.rootOutputCopies) ? coverDesign.rootOutputCopies : []),
    ...(Array.isArray(coverDesign.rootCopyPruning?.prunedRootFiles) ? coverDesign.rootCopyPruning.prunedRootFiles : []),
    ...((selection.entries || []).flatMap((entry) => entry.rootFiles || [])),
    ...((selection.needsRegeneration || []).flatMap((entry) => entry.rootFiles || [])),
  ]);
  for (const candidate of cleanupCandidates) {
    const file = cleanupFileName(candidate);
    if (!file || file.includes("/") || file.includes("\\")) continue;
    const absolute = join(topicDir, file);
    if (existsSync(absolute)) {
      rmSync(absolute, { force: true });
      cleanedTopicFiles.push(relative(batchRoot, absolute));
    }
  }
  for (const dirName of ["按尺寸选择"]) {
    const dir = join(topicDir, dirName);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}

function rebuildTopicFinalDirectory({ batchRoot, topicDir, coverDesign, selection, missing }) {
  const finalDirName = "最终成品";
  const previewDirName = "封面预览-非上传终版";
  const finalDir = join(topicDir, finalDirName);
  rmSync(finalDir, { recursive: true, force: true });
  rmSync(join(topicDir, previewDirName), { recursive: true, force: true });
  mkdirSync(finalDir, { recursive: true });
  const title = coverDesign.coverTitle || basename(topicDir);
  const records = [];
  const needsRegeneration = [];
  const updatedEntries = [];
  const entries = selectionEntriesWithResolutionPresets({ topicDir, coverDesign, selection, title });

  for (const entry of entries) {
    const localPreview = entry.localTargetRatioRecomposition === true || entry.qualityStatus === "upload-ready-local-target-ratio-recomposition";
    const nativeReady = entry.qualityStatus === "upload-ready-native-target-ratio" || entry.image2NativeTargetRatioReady === true;
    const uploadReady = entry.uploadReady === true && nativeReady && !localPreview;
    const group = entry.group || "其他尺寸";
    const updatedEntry = {
      ...entry,
      uploadReady,
      needsRegeneration: !uploadReady,
      qualityStatus: uploadReady
        ? "upload-ready-native-target-ratio"
        : localPreview
          ? "review-only-local-target-ratio-recomposition"
          : entry.qualityStatus || "needs-native-target-ratio-image2",
      files: [],
      previewFiles: [],
    };
    if (!uploadReady) {
      if (localPreview) {
        const previewGroupDir = join(topicDir, previewDirName, group);
        mkdirSync(previewGroupDir, { recursive: true });
        for (const format of ["png", "jpg"]) {
          const source = candidateSourceForEntry({ topicDir, coverDesign, entry, format });
          if (!source) continue;
          const relativeDest = join(previewDirName, group, `${entry.label}-非上传终版.${format}`);
          copyFileSync(source, join(topicDir, relativeDest));
          updatedEntry.previewFiles.push({ format, file: relativeDest });
        }
      }
      needsRegeneration.push({
        topic: title,
        targetId: entry.targetId,
        label: entry.label,
        group,
        width: entry.width,
        height: entry.height,
        ratio: entry.ratio,
        sourceAssetRatio: entry.sourceAssetRatio,
        targetRatio: entry.targetRatio,
        qualityStatus: updatedEntry.qualityStatus,
        selectedAsset: entry.selectedAsset || null,
        internalReviewFiles: entry.internalReviewFiles || [],
        previewFiles: updatedEntry.previewFiles || [],
      });
      updatedEntries.push(updatedEntry);
      continue;
    }
    const groupDir = join(finalDir, group);
    mkdirSync(groupDir, { recursive: true });
    for (const format of ["png", "jpg"]) {
      const source = candidateSourceForEntry({ topicDir, coverDesign, entry, format });
      if (!source) {
        missing.push({ topic: title, targetId: entry.targetId, label: entry.label, format });
        continue;
      }
      const relativeDest = join(finalDirName, group, `${entry.label}.${format}`);
      const absoluteDest = join(topicDir, relativeDest);
      copyFileSync(source, absoluteDest);
      updatedEntry.files.push({ format, file: relativeDest });
      if (format === "jpg") {
        records.push({
          topic: title,
          targetId: entry.targetId,
          label: entry.label,
          group,
          width: entry.width,
          height: entry.height,
          ratio: entry.ratio,
          uploadReady: true,
          qualityStatus: entry.qualityStatus || "upload-ready-native-target-ratio",
          image2NativeTargetRatioReady: Boolean(entry.image2NativeTargetRatioReady),
          localTargetRatioRecomposition: Boolean(entry.localTargetRatioRecomposition),
          file: relative(batchRoot, absoluteDest),
          topicFinalDirectory: relative(batchRoot, finalDir),
        });
      }
    }
    updatedEntries.push(updatedEntry);
  }

  const explicitNeeds = [];
  const knownNeedIds = new Set(needsRegeneration.map((entry) => entry.targetId));
  const currentEntryIds = new Set(updatedEntries.map((entry) => entry.targetId));
  for (const entry of selection.needsRegeneration || []) {
    if (knownNeedIds.has(entry.targetId) || currentEntryIds.has(entry.targetId)) continue;
    explicitNeeds.push({ topic: title, ...entry });
  }
  const allNeeds = [...needsRegeneration, ...explicitNeeds];

  const groups = [...new Set(records.map((record) => record.group))];
  const guide = [
    "# 封面尺寸选择说明\n",
    "这个目录是当前主题唯一上传选择入口。图片按中文比例/平台分组，避免所有尺寸平铺在一个目录里。\n\n",
    "这里只放 `image2NativeTargetRatioReady=true` 的原生 Image 2 版本；`localTargetRatioRecomposition=true` 的本地重排图只会放到同主题的 `封面预览-非上传终版/`，不能作为上传终版。\n\n",
    allNeeds.length > 0 ? "仍缺少的原生目标比例见 `需原生重生成清单.md`。\n\n" : "",
    "| 分组 | 数量 | 原生 Image 2 | 本地重排补齐 | 用途 |\n",
    "| --- | ---: | ---: | ---: | --- |\n",
    ...groups.map((group) => {
      const groupRecords = records.filter((record) => record.group === group);
      const nativeCount = groupRecords.filter((record) => record.image2NativeTargetRatioReady).length;
      const localCount = groupRecords.filter((record) => record.localTargetRatioRecomposition).length;
      return `| ${group} | ${groupRecords.length} | ${nativeCount} | ${localCount} | ${groupRecords[0]?.label || ""} |\n`;
    }),
  ];
  writeFileSync(join(finalDir, "封面尺寸说明.md"), guide.join(""), "utf8");

  if (allNeeds.length > 0) {
    const regenerationGuide = [
      "# 需原生重生成清单\n",
      "这些目标仍缺少原生目标比例 Image 2 一体化封面，不能用裁切、白边、模糊背景或层叠图冒充终版。\n\n",
      "| 分组 | 中文名称 | 尺寸 | 目标比例 | 当前源比例 | 状态 |\n",
      "| --- | --- | ---: | ---: | ---: | --- |\n",
      ...allNeeds.map((entry) => `| ${entry.group} | ${entry.label} | ${entry.width}x${entry.height} | ${entry.ratio} | ${entry.sourceAssetRatio ?? "未知"} | ${entry.qualityStatus || "needs-native-target-ratio-image2"} |\n`),
    ];
    writeFileSync(join(finalDir, "需原生重生成清单.md"), regenerationGuide.join(""), "utf8");
    writeJson(join(finalDir, "需原生重生成清单.json"), { topic: title, records: allNeeds });
  }

  const updatedSelection = {
    ...selection,
    selectionDirectory: finalDirName,
    finalDeliveryDirectory: finalDirName,
    reviewOnlyPreviewDirectory: previewDirName,
    topicScopedFinalDeliveryDirectory: true,
    groupedByChineseAspectRatio: true,
    humanSelectionContainsOnlyUploadReady: true,
    nonUploadReadyVisualFilesCopied: false,
    localTargetRatioRecompositionPreviewOnly: true,
    allTargetsUploadReady: allNeeds.length === 0,
    pendingNativeTargetCount: allNeeds.length,
    entries: updatedEntries,
    needsRegeneration: allNeeds.map(({ topic, ...entry }) => entry),
  };
  writeJson(join(topicDir, "workflow", "cover-size-selection.json"), updatedSelection);
  writeJson(join(finalDir, "封面尺寸索引.json"), {
    topic: title,
    topicDirectory: relative(batchRoot, topicDir),
    records,
    needsRegeneration: allNeeds,
    pendingNativeTargetCount: allNeeds.length,
    allTargetsUploadReady: allNeeds.length === 0,
    missing,
  });
  return { title, finalDir, records, needsRegeneration: allNeeds };
}

const batchRoot = resolve(argValue("--root", process.cwd()));
const allowPendingNativeTargets = hasFlag("--allow-pending-native-targets");
const indexRoot = join(batchRoot, "_封面总索引");
rmSync(indexRoot, { recursive: true, force: true });
mkdirSync(indexRoot, { recursive: true });
for (const confusingRoot of ["最终成品", "_按尺寸选择"]) {
  const dir = join(batchRoot, confusingRoot);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

const missing = [];
const cleanedTopicFiles = [];
const topicDirs = readdirSync(batchRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "最终成品")
  .map((entry) => join(batchRoot, entry.name))
  .sort((a, b) => basename(a).localeCompare(basename(b), "zh-Hans-CN"));

const topics = [];
for (const topicDir of topicDirs) {
  const coverDesignPath = join(topicDir, "workflow", "cover-design.json");
  const selectionPath = join(topicDir, "workflow", "cover-size-selection.json");
  if (!existsSync(coverDesignPath) || !existsSync(selectionPath)) continue;
  const coverDesign = readJson(coverDesignPath);
  const selection = readJson(selectionPath);
  const topicResult = rebuildTopicFinalDirectory({ batchRoot, topicDir, coverDesign, selection, missing });
  cleanRootCoverCopies({ batchRoot, topicDir, coverDesign, selection, cleanedTopicFiles });
  topics.push(topicResult);
}

const records = topics.flatMap((topic) => topic.records);
const needsRegeneration = topics.flatMap((topic) => topic.needsRegeneration);
const pendingNativeTargetCount = needsRegeneration.length;
const allTargetsUploadReady = pendingNativeTargetCount === 0;
const groups = [...new Set(records.map((record) => record.group))];
const pendingGroups = [...new Set(needsRegeneration.map((record) => record.group))];
const css = ":root{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#171717;background:#f6f4ef}body{margin:0}header{background:#111;color:#fff;padding:18px 28px;box-shadow:0 6px 18px rgba(0,0,0,.18)}h1{font-size:24px;margin:0 0 8px}header p{margin:0;color:#ddd}.wrap{padding:24px 28px 48px}nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}nav a{background:#fff;border:1px solid #ddd;border-radius:6px;padding:8px 10px;color:#111;text-decoration:none;font-size:14px}section{margin:0 0 34px}h2{font-size:21px;margin:0 0 12px}.warning{background:#fff8e8;border:1px solid #d7a441;border-radius:8px;padding:14px 16px;margin-bottom:24px}.warning h2{font-size:18px;margin:0 0 8px}.warning p{margin:0 0 8px;color:#5f4618}.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{background:#fff;border:1px solid #e2c782;border-radius:999px;padding:5px 9px;font-size:13px;color:#3e2e12}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.card{background:#fff;border:1px solid #dedbd2;border-radius:8px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.06)}.thumb{background:#202020;display:flex;align-items:center;justify-content:center;min-height:160px}.thumb img{max-width:100%;max-height:240px;display:block}.meta{padding:10px 12px}.topic{font-weight:700;font-size:14px;line-height:1.35}.spec{margin-top:4px;color:#666;font-size:12px}.badge{display:inline-block;margin-top:7px;padding:3px 7px;border-radius:4px;background:#0f7a3a;color:#fff;font-size:12px}.local{background:#a96b00}.links{margin-top:8px;display:flex;gap:8px}.links a{font-size:12px;color:#0b6bcb;text-decoration:none}.note{color:#555;font-size:13px;margin:-4px 0 12px}";
const html = [
  "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>封面总索引</title><style>",
  css,
  "</style></head><body><header><h1>封面总索引</h1><p>总索引只做预览和跳转；最终图片保留在每个主题自己的 最终成品/ 目录下。</p></header><div class=\"wrap\"><nav>",
  ...groups.map((group) => `<a href="#${esc(group)}">${esc(group)}</a>`),
  "</nav>",
  pendingNativeTargetCount > 0
    ? `<section class="warning"><h2>仍需原生重生成：${pendingNativeTargetCount} 个目标尺寸</h2><p>这些尺寸没有进入可上传最终图，因为当前包没有对应目标比例的 Image 2/Codex 原生封面。每个主题的缺口清单在该主题的 <code>最终成品/需原生重生成清单.md</code>。</p><div class="chips">${pendingGroups.map((group) => `<span class="chip">${esc(group)} × ${needsRegeneration.filter((record) => record.group === group).length}</span>`).join("")}</div></section>`
    : "",
  ...groups.map((group) => {
    const groupRecords = records.filter((record) => record.group === group);
    return `<section id="${esc(group)}"><h2>${esc(group)}</h2><p class="note">点击图片进入对应主题目录下的最终文件。</p><div class="grid">${
      groupRecords.map((record) => {
        const jpg = esc(record.file);
        const png = jpg.replace(/\.jpg$/i, ".png");
        const badgeClass = record.localTargetRatioRecomposition ? "badge local" : "badge";
        const badge = record.localTargetRatioRecomposition ? "本地重排补齐" : "原生/上传就绪";
        return `<article class="card"><a class="thumb" href="../${jpg}"><img loading="lazy" src="../${jpg}" alt="${esc(record.topic)} ${esc(record.label)}"></a><div class="meta"><div class="topic">${esc(record.topic)}</div><div class="spec">${esc(record.label)}<br>${esc(record.width)}x${esc(record.height)} / ${esc(record.ratio)}</div><div class="${badgeClass}">${badge}</div><div class="links"><a href="../${jpg}">JPG</a><a href="../${png}">PNG</a><a href="../${esc(record.topicFinalDirectory)}">主题最终目录</a></div></div></article>`;
      }).join("")
    }</div></section>`;
  }),
  "</div></body></html>",
].join("");
writeFileSync(join(indexRoot, "封面总索引.html"), html, "utf8");
writeJson(join(indexRoot, "封面总索引.json"), {
  batchRoot,
  deliveryRule: "Final images stay under each topic directory's 最终成品/ folder. This index contains links only, not duplicate cover copies.",
  topicScopedFinalDeliveryDirectory: true,
  rootFinalImageDirectoriesRemoved: true,
  topics: topics.length,
  records: records.length,
  recordsByGroup: Object.fromEntries(groups.map((group) => [group, records.filter((record) => record.group === group).length])),
  localTargetRatioRecompositionRecords: records.filter((record) => record.localTargetRatioRecomposition).length,
  needsRegeneration,
  pendingNativeTargetCount,
  allTargetsUploadReady,
  allowPendingNativeTargets,
  cleanedTopicFiles,
  missing,
});

const ok = missing.length === 0 && (allowPendingNativeTargets || pendingNativeTargetCount === 0);
const result = {
  ok,
  batchRoot,
  indexRoot,
  topics: topics.length,
  records: records.length,
  localTargetRatioRecompositionRecords: records.filter((record) => record.localTargetRatioRecomposition).length,
  needsRegeneration: pendingNativeTargetCount,
  pendingNativeTargetCount,
  allTargetsUploadReady,
  allowPendingNativeTargets,
  failureReason: ok
    ? null
    : missing.length > 0
      ? "missing-source-files"
      : "pending-native-target-ratio-covers",
  missing,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
