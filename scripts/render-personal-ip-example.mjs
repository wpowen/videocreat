#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { chromiumLaunchOptions, loadPlaywright } from './lib/load-playwright.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT = resolve(ROOT, 'media/showcase/personal-ip/example-film');
const SOURCE_DIR = resolve(ROOT, 'research/教你如何撑起故事的脊梁-个人IP横屏-20260716-fullauto');
const PAGE_1 = resolve(SOURCE_DIR, 'assets/native-pages/001-page-01.png');
const PAGE_2 = resolve(SOURCE_DIR, 'assets/native-pages/002-page-02.png');
const SOURCE_VIDEO = resolve(SOURCE_DIR, 'renders/final.mp4');
const QC_SOURCE = resolve(SOURCE_DIR, 'logs/qc.json');
const OUTPUT = resolve(OUT, 'personal-ip-two-page-horizontal.mp4');
const POSTER = resolve(OUT, 'personal-ip-two-page-poster.jpg');
const OVERLAY_1 = resolve(OUT, 'subtitle-overlay-01.png');
const OVERLAY_2 = resolve(OUT, 'subtitle-overlay-02.png');
const PACKAGED_PAGE_1 = resolve(OUT, 'source-page-01.png');
const PACKAGED_PAGE_2 = resolve(OUT, 'source-page-02.png');

function run(bin, args, options = {}) {
  return execFileSync(bin, args, { stdio: 'inherit', ...options });
}

function capture(bin, args) {
  const result = spawnSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(`${bin} failed (${result.status})\n${result.stdout || ''}${result.stderr || ''}`);
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function projectPath(path) {
  return relative(ROOT, path).split('\\').join('/');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function probe(path) {
  const result = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path,
  ], { encoding: 'utf8' }));
  if (result.format) delete result.format.filename;
  return result;
}

mkdirSync(OUT, { recursive: true });
copyFileSync(PAGE_1, PACKAGED_PAGE_1);
copyFileSync(PAGE_2, PACKAGED_PAGE_2);

async function renderSubtitleOverlay(path, kicker, line) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(chromiumLaunchOptions(chromium));
  const page = await browser.newPage({ viewport: { width: 1920, height: 186 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:186px;background:transparent}body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif;background:rgba(17,24,39,.86);padding:25px 72px;color:white}.kicker{font-size:34px;font-weight:700;letter-spacing:.5px}.line{font-size:42px;line-height:1.25;color:#ffe7c2;font-weight:600;margin-top:4px}</style><div class="kicker">${escapeHtml(kicker)}</div><div class="line">${escapeHtml(line)}</div>`);
  await page.screenshot({ path, omitBackground: true });
  await browser.close();
}

await renderSubtitleOverlay(OVERLAY_1, '页面 01  ·  Hook / Story Spine', '用人物选择，把事件串成可追踪的故事脊柱');
await renderSubtitleOverlay(OVERLAY_2, '页面 02  ·  Framework / Node System', '把八个节点变成可执行、可回收的叙事结构');

// Two native Personal IP pages, with a gentle push-in and a short crossfade.
// The subtitle copy describes the semantic job of each page instead of hiding
// the source artwork behind a dense caption wall.
const filter = [
  `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00055,1.04)':d=111:s=1920x1080:fps=30[base0]`,
  `[1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='1.04-on*0.00036':d=111:s=1920x1080:fps=30[base1]`,
  `[2:v]scale=1920:186[ov0]`,
  `[3:v]scale=1920:186[ov1]`,
  `[base0][ov0]overlay=x=0:y=894[v0]`,
  `[base1][ov1]overlay=x=0:y=894[v1]`,
  `[v0][v1]xfade=transition=fade:duration=0.35:offset=3.35,format=yuv420p[v]`,
].join(';');

run('ffmpeg', [
  '-y', '-loop', '1', '-i', PACKAGED_PAGE_1, '-loop', '1', '-i', PACKAGED_PAGE_2, '-loop', '1', '-i', OVERLAY_1, '-loop', '1', '-i', OVERLAY_2,
  '-filter_complex', filter, '-map', '[v]', '-t', '7.05', '-r', '30',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', `${OUTPUT}.silent.mp4`,
]);

// Keep the verified native-final narration/music bed, trimmed to the short reel.
run('ffmpeg', [
  '-y', '-i', `${OUTPUT}.silent.mp4`, '-ss', '0', '-t', '7.05', '-i', SOURCE_VIDEO,
  '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', OUTPUT,
]);
run('ffmpeg', ['-y', '-ss', '2.2', '-i', OUTPUT, '-frames:v', '1', '-q:v', '2', POSTER]);
rmSync(`${OUTPUT}.silent.mp4`, { force: true });

const sourceQc = JSON.parse(readFileSync(QC_SOURCE, 'utf8'));
const outputProbe = probe(OUTPUT);
const videoStream = outputProbe.streams?.find((stream) => stream.codec_type === 'video');
const audioStream = outputProbe.streams?.find((stream) => stream.codec_type === 'audio');
const blackdetect = capture('ffmpeg', [
  '-v', 'info', '-i', OUTPUT, '-vf', 'blackdetect=d=0.2:pix_th=0.05', '-an', '-f', 'null', '-',
]);
const volumedetect = capture('ffmpeg', [
  '-v', 'info', '-i', OUTPUT, '-af', 'volumedetect', '-vn', '-f', 'null', '-',
]);
const meanVolume = Number(volumedetect.match(/mean_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
const maxVolume = Number(volumedetect.match(/max_volume:\s*([\-\d.]+)\s*dB/)?.[1]);
const qcChecks = {
  outputExists: existsSync(OUTPUT) && statSync(OUTPUT).size > 0,
  duration: Math.abs(Number(outputProbe.format?.duration) - 7.05) <= 0.15,
  resolution: videoStream?.width === 1920 && videoStream?.height === 1080,
  frameRate: videoStream?.r_frame_rate === '30/1',
  videoCodec: videoStream?.codec_name === 'h264',
  audioCodec: audioStream?.codec_name === 'aac',
  noDetectedBlackSegments: !blackdetect.includes('black_start:'),
  audibleMeanLevel: Number.isFinite(meanVolume) && meanVolume >= -35 && meanVolume <= -6,
  unclippedPeak: Number.isFinite(maxVolume) && maxVolume <= 0 && maxVolume >= -12,
  subtitleOverlaysPresent: [OVERLAY_1, OVERLAY_2].every((path) => existsSync(path) && statSync(path).size > 0),
  sourceQcPassed: sourceQc.status === 'pass',
  sourcePublishingReady: sourceQc.publishingReady === true,
};
const qcPassed = Object.values(qcChecks).every(Boolean);
const metadata = {
  schemaVersion: 1,
  status: qcPassed ? 'pass' : 'failed',
  output: projectPath(OUTPUT),
  outputSha256: sha256(OUTPUT),
  outputProbe,
  outputQc: {
    passed: qcPassed,
    checks: qcChecks,
    meanVolumeDb: meanVolume,
    maxVolumeDb: maxVolume,
  },
  source: {
    route: 'ip-diagram-native-final-pages',
    video: projectPath(SOURCE_VIDEO),
    videoSha256: sha256(SOURCE_VIDEO),
    qc: projectPath(QC_SOURCE),
    qcStatus: sourceQc.status,
    publishingReady: sourceQc.publishingReady,
    pages: [
      { page: 'ip-page-01', file: projectPath(PACKAGED_PAGE_1), sourceProjectPath: projectPath(PAGE_1), sha256: sha256(PACKAGED_PAGE_1), semanticRole: 'hook and story spine' },
      { page: 'ip-page-02', file: projectPath(PACKAGED_PAGE_2), sourceProjectPath: projectPath(PAGE_2), sha256: sha256(PACKAGED_PAGE_2), semanticRole: 'central question and eight-node framework' },
    ],
  },
  edit: {
    durationSeconds: 7.05,
    resolution: '1920x1080',
    pageCount: 2,
    transition: '0.35s crossfade',
    subtitleMode: 'deterministic bottom band; one semantic line per page',
    personaPolicy: 'Uses the verified generic-host native pages; this is not a claim of user likeness.',
    audioPolicy: 'Trimmed from the verified native-final source audio; no new voice identity is asserted.',
  },
};
writeFileSync(resolve(OUT, 'provenance.json'), `${JSON.stringify(metadata, null, 2)}\n`);
if (!qcPassed) throw new Error(`Personal-IP demo QC failed: ${Object.entries(qcChecks).filter(([, value]) => !value).map(([name]) => name).join(', ')}`);
console.log(JSON.stringify({ output: OUTPUT, poster: POSTER, duration: metadata.outputProbe.format.duration, sha256: metadata.outputSha256 }, null, 2));
