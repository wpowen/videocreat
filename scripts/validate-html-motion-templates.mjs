#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const registryPath = join(skillRoot, "templates/html-motion/motion-template-registry.json");
const outDir = join(workspace, "research/codex-video-workflow-poc/html-motion-template-validation");
const shotDir = join(outDir, "screenshots");
const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].filter(Boolean);

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function findChrome() {
  return chromeCandidates.find((candidate) => existsSync(candidate));
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result;
}

function injectValidationScript(html, templateId, progress) {
  const script = `
<script>
window.addEventListener("load", () => {
  const sample = {
    headlineA: "读者不买",
    headlineB: "灵感",
    support: "只追：持续兑现",
    seal: "承诺",
    kicker: "MODEL",
    title: "承诺如何成立",
    panelTitle: "旧债被偿还",
    panelBody: "新问题同时被打开，故事才会继续。",
    cardA: "行动",
    cardB: "代价",
    cardC: "状态改变",
    caption: "验证字幕安全区：动效不能遮挡口播字幕。",
    nodes: ["承诺", "压力", "选择", "代价", "改变", "新承诺"]
  };
  if (window.motionTemplate && typeof window.motionTemplate.setContent === "function") {
    window.motionTemplate.setContent(sample);
  }
  if (window.motionTemplate && typeof window.motionTemplate.setProgress === "function") {
    window.motionTemplate.setProgress(${progress});
    setTimeout(() => window.motionTemplate.setProgress(${progress}), 250);
  }
  document.documentElement.dataset.validationTemplate = ${JSON.stringify(templateId)};
});
</script>`;
  return html.replace("</body>", `${script}\n</body>`);
}

function screenshot(chrome, htmlPath, pngPath, virtualTimeBudget) {
  run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1920,1080",
    `--virtual-time-budget=${virtualTimeBudget}`,
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href,
  ]);
}

function diffWithPython(a, b) {
  const code = `
import json
from PIL import Image, ImageChops, ImageStat
a = Image.open(${JSON.stringify(a)}).convert("RGB")
b = Image.open(${JSON.stringify(b)}).convert("RGB")
diff = ImageChops.difference(a, b)
stat = ImageStat.Stat(diff)
mean = sum(stat.mean) / len(stat.mean)
extrema = diff.getextrema()
nonzero = sum(1 for p in diff.resize((240, 135)).getdata() if p != (0, 0, 0))
total = 240 * 135
print(json.dumps({"meanDiff": mean, "changedSampleRatio": nonzero / total, "extrema": extrema}))
`;
  const result = spawnSync("python3", ["-c", code], { encoding: "utf8" });
  if (result.status !== 0) {
    return { warning: "python/Pillow diff unavailable", stderr: result.stderr };
  }
  return JSON.parse(result.stdout);
}

function inspectWithPython(path) {
  const code = `
import json
from PIL import Image, ImageStat
im = Image.open(${JSON.stringify(path)}).convert("RGB")
stat = ImageStat.Stat(im)
print(json.dumps({"size": im.size, "mean": stat.mean, "stddev": stat.stddev}))
`;
  const result = spawnSync("python3", ["-c", code], { encoding: "utf8" });
  if (result.status !== 0) {
    return { warning: "python/Pillow image inspect unavailable", stderr: result.stderr };
  }
  return JSON.parse(result.stdout);
}

function main() {
  ensureDir(shotDir);
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const chrome = findChrome();
  const report = {
    ok: false,
    chrome,
    registry: "templates/html-motion/motion-template-registry.json",
    outputDir: outDir,
    templates: [],
  };
  if (!chrome) {
    report.error = "No Chrome/Chromium executable found; set CHROME_BIN to enable screenshot validation.";
    writeFileSync(join(outDir, "motion-validation-report.json"), JSON.stringify(report, null, 2) + "\n");
    process.exitCode = 1;
    return;
  }

  const tempRoot = join(tmpdir(), `codex-video-motion-${Date.now()}`);
  ensureDir(tempRoot);
  for (const template of registry.templates) {
    const source = join(skillRoot, template.file);
    if (!existsSync(source)) {
      report.templates.push({ id: template.id, pass: false, error: "template file missing" });
      continue;
    }
    const html = readFileSync(source, "utf8");
    const exposesApi = /window\.motionTemplate/.test(html);
    const initialHtml = join(tempRoot, `${template.id}-initial.html`);
    const laterHtml = join(tempRoot, `${template.id}-later.html`);
    writeFileSync(initialHtml, injectValidationScript(html, template.id, 0), "utf8");
    writeFileSync(laterHtml, injectValidationScript(html, template.id, 0.82), "utf8");
    const initialPng = join(shotDir, `${template.id}-initial.png`);
    const laterPng = join(shotDir, `${template.id}-later.png`);
    screenshot(chrome, initialHtml, initialPng, 120);
    screenshot(chrome, laterHtml, laterPng, 1800);
    const initialInfo = inspectWithPython(initialPng);
    const laterInfo = inspectWithPython(laterPng);
    const diff = diffWithPython(initialPng, laterPng);
    const hasVisibleDiff = Number(diff.meanDiff || 0) >= 0.8 || Number(diff.changedSampleRatio || 0) >= 0.01;
    const nonBlank = Array.isArray(initialInfo.stddev) && initialInfo.stddev.some((value) => value > 8);
    report.templates.push({
      id: template.id,
      engine: template.engine,
      source: template.file,
      exposesApi,
      screenshots: [initialPng, laterPng],
      initialInfo,
      laterInfo,
      diff,
      pass: exposesApi && hasVisibleDiff && nonBlank,
    });
  }
  report.ok = report.templates.every((template) => template.pass);
  writeFileSync(join(outDir, "motion-validation-report.json"), JSON.stringify(report, null, 2) + "\n");
  if (!report.ok) process.exitCode = 1;
  console.log(JSON.stringify(report, null, 2));
}

main();
