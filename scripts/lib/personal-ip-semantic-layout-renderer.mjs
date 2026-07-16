const PALETTE = {
  ink: "#18232d",
  muted: "#64717d",
  orange: "#f0642c",
  red: "#d94b45",
  blue: "#3f6ed8",
  green: "#2f9568",
  paper: "#ffffff",
  line: "#d9dfe4",
  wash: "#f3f5f7",
};

export function escapeSvg(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clean(value = "", max = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stripPunctuation(value = "") {
  return clean(value).replace(/[。、“”‘’；：，,.!?！？]/g, "");
}

function wrapText(value, maxChars = 14, maxLines = 2) {
  const chars = Array.from(clean(value, maxChars * maxLines));
  const lines = [];
  for (let index = 0; index < chars.length && lines.length < maxLines; index += maxChars) {
    lines.push(chars.slice(index, index + maxChars).join(""));
  }
  return lines;
}

function textLines({ value, x, y, maxChars = 14, maxLines = 2, lineHeight = 42, fontSize = 30, weight = 700, anchor = "start", className = "" }) {
  const lines = wrapText(value, maxChars, maxLines);
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${weight}"${className ? ` class="${className}"` : ""}>${lines.map((line, index) => `<tspan x="${x}"${index ? ` dy="${lineHeight}"` : ""}>${escapeSvg(line)}</tspan>`).join("")}</text>`;
}

function sceneLabel(scene) {
  return ({
    "literary-example": "人物示例",
    "four-force-model": "四项动力",
    "causal-model": "因果链",
    "choice-system": "错误选择",
    "resource-system": "对手资源",
    comparison: "镜像冲突",
    "transformation-timeline": "人物弧线",
    scorecard: "评分量表",
    checklist: "完成清单",
    "evidence-ledger": "证据表格",
    "method-path": "实践路径",
    "core-statement": "核心判断",
  })[scene.contentKind] || "核心判断";
}

function sceneItems(scene, limit = 7) {
  const cards = [...(scene.hookItems || []), ...(scene.routeItems || [])].map((item) => Array.isArray(item)
    ? { icon: item[0], label: item[1], body: item[2] }
    : { icon: item?.icon, label: item?.label, body: item?.body });
  const methodology = (scene.methodologyVisualUnits || []).map((unit, index) => ({
    icon: String(index + 1),
    label: clean(unit?.text, 12),
    body: clean(unit?.text, 26),
  }));
  const semantic = (scene.semanticUnits || []).map((text, index) => ({
    icon: String(index + 1),
    label: clean(text, 12),
    body: clean(text, 26),
  }));
  const result = [];
  const fingerprints = new Set();
  for (const item of [...methodology, ...cards, ...semantic]) {
    const label = clean(item.label || item.body, 12);
    const body = clean(item.body || item.label, 30);
    const fingerprint = `${label}|${body}`;
    if (!label || fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    result.push({ icon: clean(item.icon || String(result.length + 1), 2), label, body });
    if (result.length >= limit) break;
  }
  if (!result.length) result.push({ icon: "1", label: clean(scene.title || scene.subtitle || "核心判断", 12), body: clean(scene.subtitle || scene.takeaway || scene.title, 30) });
  return result;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveMasterGuidance(masterVisualAnalysis, canvas) {
  const objects = new Map((masterVisualAnalysis?.objectInventory || []).map((object) => [String(object.id), object]));
  const bindings = masterVisualAnalysis?.roleBindings || {};
  const sourceCanvas = masterVisualAnalysis?.canvas || {};
  const sourceWidth = Number(sourceCanvas.width || 0);
  const sourceHeight = Number(sourceCanvas.height || 0);
  if (!sourceWidth || !sourceHeight) return null;
  const boundFor = (role) => {
    const object = objects.get(String(bindings[role] || ""));
    if (!object?.bounds) return null;
    return {
      id: object.id,
      x: Number(object.bounds.x) / sourceWidth * canvas.width,
      y: Number(object.bounds.y) / sourceHeight * canvas.height,
      w: Number(object.bounds.width) / sourceWidth * canvas.width,
      h: Number(object.bounds.height) / sourceHeight * canvas.height,
    };
  };
  const headline = boundFor("headline");
  const content = boundFor("content-group");
  const persona = boundFor("personal-ip");
  if (!headline || !content || !persona) return null;
  const horizontal = canvas.aspectRatio === "16:9";
  const bottomLimit = horizontal ? canvas.height - 120 : canvas.height - 260;
  const guided = {
    personaSide: persona.x + persona.w / 2 < canvas.width / 2 ? "left" : "right",
    headline: {
      x: clamp(headline.x, 40, canvas.width - 520),
      y: clamp(headline.y, 80, horizontal ? 190 : 300),
      w: clamp(headline.w, 480, canvas.width - 100),
    },
    content: {
      x: clamp(content.x, 40, canvas.width - (horizontal ? 840 : 740)),
      y: clamp(content.y, horizontal ? 190 : 420, bottomLimit - (horizontal ? 420 : 600)),
      w: clamp(content.w, horizontal ? 800 : 700, canvas.width - 80),
      h: 0,
    },
    persona: {
      x: clamp(persona.x, 20, canvas.width - (horizontal ? 240 : 220)),
      y: clamp(persona.y, 70, bottomLimit - (horizontal ? 360 : 420)),
      w: clamp(persona.w, horizontal ? 240 : 220, horizontal ? 460 : 380),
      h: clamp(persona.h, horizontal ? 360 : 420, horizontal ? 780 : 700),
    },
    objectIds: {
      headline: headline.id,
      content: content.id,
      persona: persona.id,
    },
  };
  guided.content.h = clamp(content.h, horizontal ? 420 : 600, bottomLimit - guided.content.y);
  const palette = (masterVisualAnalysis?.styleTokens?.palette || []).filter((value) => /^#[0-9a-f]{6}$/i.test(String(value)));
  guided.palette = {
    paper: palette[0] || PALETTE.paper,
    ink: palette[1] || PALETTE.ink,
    accent: palette[2] || PALETTE.orange,
    secondary: palette[3] || PALETTE.blue,
  };
  guided.styleTokens = masterVisualAnalysis.styleTokens;
  return guided;
}

function geometry(scene, canvas, masterGuidance = null) {
  if (masterGuidance) return masterGuidance;
  const horizontal = canvas.aspectRatio === "16:9";
  const leftPersonaLayouts = new Set(["force-compass", "resource-pressure-map", "action-checklist", "method-path"]);
  const personaSide = leftPersonaLayouts.has(scene.layoutVariant) ? "left" : "right";
  if (horizontal) {
    return personaSide === "left"
      ? { personaSide, persona: { x: 34, y: 135, w: 350, h: 760 }, content: { x: 430, y: 250, w: 1410, h: 650 }, headline: { x: 430, y: 105, w: 1360 } }
      : { personaSide, persona: { x: 1510, y: 135, w: 370, h: 760 }, content: { x: 70, y: 250, w: 1380, h: 650 }, headline: { x: 80, y: 105, w: 1320 } };
  }
  return personaSide === "left"
    ? { personaSide, persona: { x: 40, y: 115, w: 320, h: 540 }, content: { x: 56, y: 680, w: 968, h: 950 }, headline: { x: 390, y: 130, w: 620 } }
    : { personaSide, persona: { x: 700, y: 115, w: 330, h: 540 }, content: { x: 56, y: 680, w: 968, h: 950 }, headline: { x: 60, y: 130, w: 610 } };
}

function card({ x, y, w, h, item, index, accent = PALETTE.orange, compact = false }) {
  const titleSize = compact ? 24 : 28;
  const bodySize = compact ? 18 : 21;
  const titleLines = wrapText(item.label, compact ? 7 : 9, 2);
  const bodyLines = wrapText(stripPunctuation(item.body), compact ? 9 : 12, 2);
  return `<g data-reveal-item="${index}" data-card-box><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="#fff" stroke="${PALETTE.line}" stroke-width="2"/><circle cx="${x + 36}" cy="${y + 38}" r="20" fill="${accent}" fill-opacity=".12" stroke="${accent}"/><text x="${x + 36}" y="${y + 46}" text-anchor="middle" font-size="20" font-weight="800" fill="${accent}">${escapeSvg(item.icon)}</text><text x="${x + 68}" y="${y + 38}" font-size="${titleSize}" font-weight="800">${titleLines.map((line, lineIndex) => `<tspan x="${x + 68}"${lineIndex ? ` dy="${titleSize + 5}"` : ""}>${escapeSvg(line)}</tspan>`).join("")}</text><text x="${x + 24}" y="${y + h - 44}" font-size="${bodySize}" fill="${PALETTE.muted}">${bodyLines.map((line, lineIndex) => `<tspan x="${x + 24}"${lineIndex ? ` dy="${bodySize + 6}"` : ""}>${escapeSvg(line)}</tspan>`).join("")}</text></g>`;
}

function renderQuote(scene, g, items) {
  const { x, y, w, h } = g.content;
  const units = (scene.semanticUnits || []).map((unit) => clean(unit, 80)).filter(Boolean);
  const quote = clean(
    units.find((unit) => /《[^》]+》|我来迟了|不曾迎接远客/.test(unit))
      || scene.captions?.[0]
      || scene.subtitle
      || scene.title,
    62,
  );
  const observations = [
    { label: "声音先到", body: "人物还没露面，现场已经被她的动作占住。", accent: PALETTE.orange },
    { label: "接管现场", body: clean(units.find((unit) => /接管现场|控场|抓进自己手里/.test(unit)) || "她习惯把局面抓进自己手里。", 30), accent: PALETTE.blue },
    { label: "可靠又危险", body: clean(units.find((unit) => /靠谱|危险|更大的问题/.test(unit)) || "她解决问题的方式，也可能制造更大的问题。", 34), accent: PALETTE.red },
  ];
  const quoteLines = wrapText(quote, w > 1000 ? 17 : 12, w > 1000 ? 3 : 5);
  const quoteX = x + 30;
  const quoteY = y + 42;
  const quoteW = Math.min(760, w * 0.56);
  const insightX = x + quoteW + 90;
  const insightW = w - quoteW - 120;
  const insightRows = observations.map((item, index) => {
    const rowY = y + 92 + index * 146;
    return `<g data-reveal-item="${index + 2}"><circle cx="${insightX + 28}" cy="${rowY + 26}" r="12" fill="${item.accent}"/><text x="${insightX + 58}" y="${rowY + 34}" font-size="28" font-weight="850" fill="${item.accent}">${escapeSvg(item.label)}</text><text x="${insightX + 58}" y="${rowY + 78}" font-size="21" fill="#dfe6eb">${escapeSvg(item.body)}</text><path d="M${insightX + 58} ${rowY + 100}H${insightX + insightW - 24}" stroke="#ffffff" stroke-opacity=".14" stroke-width="2"/></g>`;
  }).join("");
  return {
    main: `<g data-scene-main><g data-reveal-item="1"><rect x="${quoteX}" y="${quoteY}" width="${quoteW}" height="${h - 78}" rx="34" fill="#fff" stroke="${PALETTE.orange}" stroke-width="3"/><text x="${quoteX + 44}" y="${quoteY + 96}" font-family="Songti SC,serif" font-size="112" font-weight="850" fill="${PALETTE.orange}" opacity=".26">“</text><text x="${quoteX + 92}" y="${quoteY + 150}" font-family="Songti SC,serif" font-size="${w > 1000 ? 48 : 40}" font-weight="780">${quoteLines.map((line, index) => `<tspan x="${quoteX + 92}"${index ? ` dy="${w > 1000 ? 64 : 54}"` : ""}>${escapeSvg(line)}</tspan>`).join("")}</text><path d="M${quoteX + 92} ${quoteY + h - 148}C${quoteX + 220} ${quoteY + h - 122} ${quoteX + quoteW - 160} ${quoteY + h - 138} ${quoteX + quoteW - 76} ${quoteY + h - 156}" fill="none" stroke="${PALETTE.orange}" stroke-width="6" stroke-linecap="round"/><text x="${quoteX + 92}" y="${quoteY + h - 82}" font-size="23" fill="${PALETTE.muted}">人物先于解释进入现场</text></g><g data-reveal-item="2"><rect x="${insightX}" y="${y + 42}" width="${insightW}" height="${h - 78}" rx="34" fill="${PALETTE.ink}"/><text x="${insightX + 58}" y="${y + 96}" font-size="23" font-weight="800" fill="#aebbc6">观察这句话的动作</text>${insightRows}</g></g>`,
    path: `<g data-scene-path><path data-reveal-item="1" d="M${x + 30} ${y + h - 20}C${x + 310} ${y + h + 8} ${x + w - 300} ${y + h - 14} ${x + w - 40} ${y + h - 2}" fill="none" stroke="${PALETTE.blue}" stroke-width="5" stroke-linecap="round"/><circle data-reveal-item="2" cx="${x + w - 68}" cy="${y + h - 20}" r="18" fill="${PALETTE.orange}"/></g>`,
  };
}

function renderCompass(scene, g, items) {
  const { x, y, w, h } = g.content;
  const labels = ["欲望", "目标", "需要", "误信念"];
  const cx = x + w * .52;
  const cy = y + h * .5;
  const positions = [[cx, y + 80], [x + w - 190, cy], [cx, y + h - 90], [x + 190, cy]];
  const cards = positions.map(([px, py], index) => {
    const item = items[index] || { icon: String(index + 1), label: labels[index], body: labels[index] };
    return `<g data-reveal-item="${index + 1}"><circle cx="${px}" cy="${py}" r="78" fill="#fff" stroke="${[PALETTE.orange, PALETTE.blue, PALETTE.green, PALETTE.red][index]}" stroke-width="4"/><text x="${px}" y="${py + 10}" text-anchor="middle" font-size="30" font-weight="850">${escapeSvg(labels[index])}</text><text x="${px}" y="${py + 44}" text-anchor="middle" font-size="18" fill="${PALETTE.muted}">${escapeSvg(clean(item.body, 10))}</text></g>`;
  }).join("");
  return {
    main: `<g data-scene-main><circle cx="${cx}" cy="${cy}" r="112" fill="#fff7ef" stroke="${PALETTE.ink}" stroke-width="4"/><text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="34" font-weight="850">人物选择</text><text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="24" fill="${PALETTE.orange}">不是一张性格标签</text>${cards}</g>`,
    path: `<g data-scene-path>${positions.map(([px, py], index) => `<path data-reveal-item="${index + 1}" d="M${cx} ${cy}L${px} ${py}" stroke="${[PALETTE.orange, PALETTE.blue, PALETTE.green, PALETTE.red][index]}" stroke-width="5" stroke-dasharray="10 12"/>`).join("")}</g>`,
  };
}

function renderChain(scene, g, items) {
  const { x, y, w, h } = g.content;
  const shown = items.slice(0, 5);
  const cardW = w > 1000 ? Math.min(230, (w - 120) / shown.length) : w - 80;
  const horizontal = w > 1000;
  const cards = shown.map((item, index) => {
    const cx = horizontal ? x + 30 + index * ((w - 60) / shown.length) : x + 40;
    const cy = horizontal ? y + h * .38 + (index % 2 ? 80 : 0) : y + 30 + index * 160;
    return card({ x: cx, y: cy, w: cardW, h: horizontal ? 190 : 132, item, index: index + 1, accent: index === shown.length - 1 ? PALETTE.red : PALETTE.orange, compact: true });
  }).join("");
  const path = shown.slice(1).map((_, index) => horizontal
    ? `<path data-reveal-item="${index + 1}" d="M${x + 30 + index * ((w - 60) / shown.length) + cardW} ${y + h * .38 + 96 + (index % 2 ? 80 : 0)}C${x + 74 + index * ((w - 60) / shown.length) + cardW} ${y + h * .25} ${x + 10 + (index + 1) * ((w - 60) / shown.length)} ${y + h * .25} ${x + 30 + (index + 1) * ((w - 60) / shown.length)} ${y + h * .38 + 96 + ((index + 1) % 2 ? 80 : 0)}" fill="none" stroke="${PALETTE.orange}" stroke-width="6" marker-end="url(#arrow)"/>`
    : `<path data-reveal-item="${index + 1}" d="M${x + w / 2} ${y + 162 + index * 160}V${y + 190 + index * 160}" stroke="${PALETTE.orange}" stroke-width="6" marker-end="url(#arrow)"/>`).join("");
  return { main: `<g data-scene-main>${cards}</g>`, path: `<g data-scene-path>${path}</g>` };
}

function renderBranches(scene, g, items) {
  const { x, y, w, h } = g.content;
  const horizontal = w > 1000;
  const cx = x + w * .43;
  const cy = y + 120;
  const shown = items.slice(0, horizontal ? 3 : 4);
  const branchCards = shown.map((item, index) => {
    const bx = horizontal ? x + 20 + index * ((w - 40) / shown.length) : x + 40;
    const by = horizontal ? y + 330 + (index === 1 ? 70 : 0) : y + 280 + index * 150;
    return card({ x: bx, y: by, w: horizontal ? Math.min(360, (w - 80) / shown.length) : w - 80, h: horizontal ? 210 : 122, item, index: index + 1, accent: index === shown.length - 1 ? PALETTE.green : PALETTE.red, compact: true });
  }).join("");
  const paths = shown.map((_, index) => {
    const tx = horizontal ? x + 20 + index * ((w - 40) / shown.length) + Math.min(360, (w - 80) / shown.length) / 2 : x + w / 2;
    const ty = horizontal ? y + 330 + (index === 1 ? 70 : 0) : y + 280 + index * 150;
    return `<path data-reveal-item="${index + 1}" d="M${cx} ${cy + 78}C${cx} ${cy + 190} ${tx} ${ty - 80} ${tx} ${ty}" fill="none" stroke="${index === shown.length - 1 ? PALETTE.green : PALETTE.red}" stroke-width="5"/>`;
  }).join("");
  return {
    main: `<g data-scene-main><rect x="${cx - 150}" y="${cy}" width="300" height="156" rx="44" fill="#fff7ef" stroke="${PALETTE.orange}" stroke-width="4"/><text x="${cx}" y="${cy + 68}" text-anchor="middle" font-size="34" font-weight="850">人物会怎么选？</text><text x="${cx}" y="${cy + 112}" text-anchor="middle" font-size="22" fill="${PALETTE.muted}">替代项存在，选择才成立</text>${branchCards}</g>`,
    path: `<g data-scene-path>${paths}</g>`,
  };
}

function renderSplit(scene, g, items) {
  const { x, y, w, h } = g.content;
  const half = (w - 60) / 2;
  const left = items.slice(0, Math.max(1, Math.ceil(items.length / 2))).slice(0, 3);
  const right = items.slice(left.length).slice(0, 3);
  const column = (columnItems, ox, color, title, start) => `<g data-reveal-item="${start}"><rect x="${ox}" y="${y + 34}" width="${half}" height="${h - 68}" rx="34" fill="#fff" stroke="${color}" stroke-width="3"/><text x="${ox + 34}" y="${y + 94}" font-size="34" font-weight="850" fill="${color}">${title}</text>${columnItems.map((item, index) => `<g data-reveal-item="${start + index}"><circle cx="${ox + 48}" cy="${y + 166 + index * 128}" r="14" fill="${color}"/><text x="${ox + 80}" y="${y + 176 + index * 128}" font-size="27" font-weight="780">${escapeSvg(clean(item.label, 12))}</text><text x="${ox + 80}" y="${y + 212 + index * 128}" font-size="20" fill="${PALETTE.muted}">${escapeSvg(clean(stripPunctuation(item.body), 18))}</text></g>`).join("")}</g>`;
  return { main: `<g data-scene-main>${column(left, x, PALETTE.red, "旧的选择", 1)}${column(right.length ? right : left, x + half + 60, PALETTE.green, "新的选择", 4)}</g>`, path: `<g data-scene-path><path data-reveal-item="2" d="M${x + half + 30} ${y + 76}V${y + h - 76}" stroke="${PALETTE.orange}" stroke-width="5" stroke-dasharray="12 14"/></g>` };
}

function renderScorecard(scene, g, items) {
  const { x, y, w, h } = g.content;
  const shown = items.slice(0, 5);
  const ringX = x + (w > 1000 ? 220 : w / 2);
  const ringY = y + 240;
  const rowsX = w > 1000 ? x + 470 : x + 40;
  const rowsY = w > 1000 ? y + 70 : y + 520;
  const rowsW = w > 1000 ? w - 520 : w - 80;
  return {
    main: `<g data-scene-main><circle cx="${ringX}" cy="${ringY}" r="140" fill="#fff" stroke="${PALETTE.line}" stroke-width="24"/><path data-reveal-item="1" d="M${ringX} ${ringY - 140}A140 140 0 1 1 ${ringX - 96} ${ringY + 102}" fill="none" stroke="${PALETTE.orange}" stroke-width="24" stroke-linecap="round"/><text x="${ringX}" y="${ringY + 12}" text-anchor="middle" font-size="72" font-weight="900">100</text><text x="${ringX}" y="${ringY + 58}" text-anchor="middle" font-size="23" fill="${PALETTE.muted}">人物系统满分</text>${shown.map((item, index) => { const width = Math.max(90, rowsW * (.48 + index * .1) % (rowsW * .94)); return `<g data-reveal-item="${index + 1}"><text x="${rowsX}" y="${rowsY + index * 104}" font-size="24" font-weight="780">${escapeSvg(clean(item.label, 12))}</text><rect x="${rowsX}" y="${rowsY + 24 + index * 104}" width="${rowsW}" height="22" rx="11" fill="#e8edf1"/><rect x="${rowsX}" y="${rowsY + 24 + index * 104}" width="${width}" height="22" rx="11" fill="${index === shown.length - 1 ? PALETTE.green : PALETTE.blue}"/></g>`; }).join("")}</g>`,
    path: `<g data-scene-path><path data-reveal-item="1" d="M${ringX - 150} ${ringY + 188}C${ringX - 70} ${ringY + 224} ${ringX + 80} ${ringY + 220} ${ringX + 158} ${ringY + 184}" fill="none" stroke="${PALETTE.red}" stroke-width="6"/></g>`,
  };
}

function renderChecklist(scene, g, items) {
  const { x, y, w, h } = g.content;
  const shown = items.slice(0, 6);
  const boardX = x + (w > 1000 ? 160 : 36);
  const boardW = w > 1000 ? w - 260 : w - 72;
  return {
    main: `<g data-scene-main><rect x="${boardX}" y="${y + 24}" width="${boardW}" height="${h - 48}" rx="36" fill="#fff" stroke="${PALETTE.ink}" stroke-width="3"/><rect x="${boardX + boardW * .34}" y="${y}" width="${boardW * .32}" height="58" rx="22" fill="#fff7ef" stroke="${PALETTE.orange}" stroke-width="3"/><text x="${boardX + boardW / 2}" y="${y + 39}" text-anchor="middle" font-size="26" font-weight="850">完成前逐项检查</text>${shown.map((item, index) => `<g data-reveal-item="${index + 1}"><rect x="${boardX + 44}" y="${y + 104 + index * ((h - 180) / shown.length)}" width="34" height="34" rx="9" fill="#fff" stroke="${PALETTE.green}" stroke-width="3"/><path d="M${boardX + 51} ${y + 120 + index * ((h - 180) / shown.length)}l10 10 20 -25" fill="none" stroke="${PALETTE.green}" stroke-width="5" stroke-linecap="round"/><text x="${boardX + 100}" y="${y + 130 + index * ((h - 180) / shown.length)}" font-size="26" font-weight="760">${escapeSvg(clean(item.label, 16))}</text></g>`).join("")}</g>`,
    path: `<g data-scene-path><path data-reveal-item="1" d="M${boardX + 30} ${y + h - 8}C${boardX + 260} ${y + h + 20} ${boardX + boardW - 220} ${y + h - 18} ${boardX + boardW - 24} ${y + h + 2}" fill="none" stroke="${PALETTE.orange}" stroke-width="6"/></g>`,
  };
}

function renderLedger(scene, g, items) {
  const { x, y, w, h } = g.content;
  const shown = items.slice(0, 6);
  const rowH = (h - 90) / Math.max(3, shown.length);
  return {
    main: `<g data-scene-main><rect x="${x + 20}" y="${y + 22}" width="${w - 40}" height="${h - 44}" rx="32" fill="#fff" stroke="${PALETTE.ink}" stroke-width="3"/><rect x="${x + 20}" y="${y + 22}" width="${w - 40}" height="72" rx="32" fill="#fff7ef"/><text x="${x + 60}" y="${y + 70}" font-size="28" font-weight="850">要填写的项目</text><text x="${x + w * .46}" y="${y + 70}" font-size="28" font-weight="850">判断与证据</text>${shown.map((item, index) => `<g data-reveal-item="${index + 1}"><path d="M${x + 38} ${y + 94 + index * rowH}H${x + w - 38}" stroke="${PALETTE.line}" stroke-width="2"/><rect x="${x + 56}" y="${y + 112 + index * rowH}" width="${Math.min(260, w * .28)}" height="${rowH - 34}" rx="18" fill="${index % 2 ? "#eef4ff" : "#fff1e8"}"/><text x="${x + 82}" y="${y + 155 + index * rowH}" font-size="24" font-weight="800">${escapeSvg(clean(item.label, 12))}</text><text x="${x + w * .46}" y="${y + 155 + index * rowH}" font-size="22" fill="${PALETTE.muted}">${escapeSvg(clean(stripPunctuation(item.body), w > 1000 ? 28 : 16))}</text></g>`).join("")}</g>`,
    path: `<g data-scene-path><path data-reveal-item="1" d="M${x + w * .4} ${y + 36}V${y + h - 36}" stroke="${PALETTE.orange}" stroke-width="4" stroke-dasharray="10 12"/></g>`,
  };
}

function renderResourceMap(scene, g, items) {
  const { x, y, w, h } = g.content;
  const shown = items.slice(0, 6);
  const cx = x + w * .52;
  const cy = y + h * .48;
  const rx = w * .36;
  const ry = h * .34;
  const nodes = shown.map((item, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / shown.length;
    const nx = cx + Math.cos(angle) * rx;
    const ny = cy + Math.sin(angle) * ry;
    return { item, nx, ny, index };
  });
  return {
    main: `<g data-scene-main><circle cx="${cx}" cy="${cy}" r="104" fill="#fff7ef" stroke="${PALETTE.red}" stroke-width="4"/><text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="34" font-weight="850">持续反制</text><text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="22" fill="${PALETTE.muted}">资源决定冲突强度</text>${nodes.map(({ item, nx, ny, index }) => `<g data-reveal-item="${index + 1}"><rect x="${nx - 110}" y="${ny - 54}" width="220" height="108" rx="28" fill="#fff" stroke="${index % 2 ? PALETTE.blue : PALETTE.orange}" stroke-width="3"/><text x="${nx}" y="${ny - 4}" text-anchor="middle" font-size="25" font-weight="820">${escapeSvg(clean(item.label, 10))}</text><text x="${nx}" y="${ny + 30}" text-anchor="middle" font-size="18" fill="${PALETTE.muted}">${escapeSvg(clean(stripPunctuation(item.body), 12))}</text></g>`).join("")}</g>`,
    path: `<g data-scene-path>${nodes.map(({ nx, ny, index }) => `<path data-reveal-item="${index + 1}" d="M${cx} ${cy}L${nx} ${ny}" stroke="${index % 2 ? PALETTE.blue : PALETTE.orange}" stroke-width="5" stroke-dasharray="9 11"/>`).join("")}</g>`,
  };
}

function renderMethodPath(scene, g, items) {
  const { x, y, w, h } = g.content;
  const shown = items.slice(0, 6);
  const horizontal = w > 1000;
  const nodes = shown.map((item, index) => {
    const nx = horizontal ? x + 80 + index * ((w - 160) / Math.max(1, shown.length - 1)) : x + 120 + (index % 2) * (w - 240);
    const ny = horizontal ? y + h * .53 + Math.sin(index * 1.4) * 120 : y + 80 + index * ((h - 160) / Math.max(1, shown.length - 1));
    return { item, nx, ny, index };
  });
  const pathD = nodes.map((node, index) => `${index ? "L" : "M"}${node.nx} ${node.ny}`).join(" ");
  return {
    main: `<g data-scene-main>${nodes.map(({ item, nx, ny, index }) => `<g data-reveal-item="${index + 1}"><circle cx="${nx}" cy="${ny}" r="58" fill="#fff" stroke="${index === nodes.length - 1 ? PALETTE.green : PALETTE.orange}" stroke-width="5"/><text x="${nx}" y="${ny - 2}" text-anchor="middle" font-size="26" font-weight="850">${index + 1}</text><text x="${nx}" y="${ny + 92}" text-anchor="middle" font-size="22" font-weight="760">${escapeSvg(clean(item.label, 9))}</text></g>`).join("")}</g>`,
    path: `<g data-scene-path><path data-reveal-item="1" d="${pathD}" fill="none" stroke="${PALETTE.blue}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14 15"/></g>`,
  };
}

function renderStatement(scene, g, items) {
  const { x, y, w, h } = g.content;
  return {
    main: `<g data-scene-main><rect x="${x + 30}" y="${y + 40}" width="${w - 60}" height="${h - 80}" rx="50" fill="#fff" stroke="${PALETTE.line}" stroke-width="3"/><text x="${x + w / 2}" y="${y + h * .42}" text-anchor="middle" font-family="Songti SC,serif" font-size="${w > 1000 ? 58 : 45}" font-weight="850">${wrapText(scene.takeaway || scene.subtitle || scene.title, w > 1000 ? 18 : 12, 3).map((line, index) => `<tspan x="${x + w / 2}"${index ? ` dy="${w > 1000 ? 72 : 58}"` : ""}>${escapeSvg(line)}</tspan>`).join("")}</text><text data-reveal-item="1" x="${x + w / 2}" y="${y + h - 86}" text-anchor="middle" font-size="24" fill="${PALETTE.orange}">${escapeSvg(clean(items[0]?.body, 28))}</text></g>`,
    path: `<g data-scene-path><path data-reveal-item="1" d="M${x + 110} ${y + h - 42}C${x + 380} ${y + h - 4} ${x + w - 360} ${y + h - 16} ${x + w - 100} ${y + h - 38}" fill="none" stroke="${PALETTE.red}" stroke-width="7"/></g>`,
  };
}

function renderContent(scene, g, items) {
  if (scene.layoutVariant === "quote-stage") return renderQuote(scene, g, items);
  if (scene.layoutVariant === "force-compass") return renderCompass(scene, g, items);
  if (scene.layoutVariant === "causal-chain" || scene.layoutVariant === "arc-timeline") return renderChain(scene, g, items);
  if (scene.layoutVariant === "choice-branches") return renderBranches(scene, g, items);
  if (scene.layoutVariant === "mirror-split") return renderSplit(scene, g, items);
  if (scene.layoutVariant === "scorecard") return renderScorecard(scene, g, items);
  if (scene.layoutVariant === "action-checklist") return renderChecklist(scene, g, items);
  if (scene.layoutVariant === "evidence-ledger") return renderLedger(scene, g, items);
  if (scene.layoutVariant === "resource-pressure-map") return renderResourceMap(scene, g, items);
  if (scene.layoutVariant === "method-path") return renderMethodPath(scene, g, items);
  return renderStatement(scene, g, items);
}

function sceneGroup(scene, index, content, role) {
  return `<g data-scene-index="${index}" data-scene-id="${escapeSvg(scene.id)}" data-layout-variant="${escapeSvg(scene.layoutVariant)}" data-content-kind="${escapeSvg(scene.contentKind)}" data-scene-role="${role}" visibility="hidden" opacity="0">${content}</g>`;
}

export function buildContentDrivenSemanticLayers({ scenes, canvas, personaData, masterVisualAnalysis }) {
  const horizontal = canvas.aspectRatio === "16:9";
  const masterGuidance = resolveMasterGuidance(masterVisualAnalysis, canvas);
  if (!masterGuidance) throw new Error("Semantic renderer requires validated master role bounds and style tokens.");
  const guidedPalette = masterGuidance.palette;
  const backgrounds = scenes.map((scene, index) => sceneGroup(scene, index, `<g data-master-style-material="${escapeSvg(masterGuidance.styleTokens.material)}" data-master-style-composition="${escapeSvg(masterGuidance.styleTokens.composition)}"><rect width="${canvas.width}" height="${canvas.height}" fill="${guidedPalette.paper}"/><path d="M0 ${horizontal ? 240 : 650}C${canvas.width * .25} ${horizontal ? 214 : 620} ${canvas.width * .72} ${horizontal ? 270 : 690} ${canvas.width} ${horizontal ? 232 : 640}" fill="none" stroke="${index % 2 ? guidedPalette.secondary : guidedPalette.accent}" stroke-opacity=".12" stroke-width="8"/><circle cx="${index % 2 ? canvas.width - 120 : 120}" cy="${horizontal ? canvas.height - 100 : canvas.height - 280}" r="${horizontal ? 210 : 160}" fill="${index % 2 ? guidedPalette.accent : guidedPalette.secondary}" opacity=".035"/></g>`, "background")).join("");
  const headlines = [];
  const mains = [];
  const paths = [];
  const annotations = [];
  const personas = [];
  const agents = [];
  scenes.forEach((scene, index) => {
    const g = geometry(scene, canvas, masterGuidance);
    const items = sceneItems(scene);
    const rendered = renderContent(scene, g, items);
    const headlineMax = horizontal ? (g.headline.w > 1300 ? 18 : 15) : 10;
    headlines.push(sceneGroup(scene, index, `<g data-master-object-id="${escapeSvg(g.objectIds.headline)}"><path d="M${g.headline.x} ${g.headline.y - 36}h58" stroke="${guidedPalette.accent}" stroke-width="8" stroke-linecap="round"/><text x="${g.headline.x + 76}" y="${g.headline.y - 27}" font-size="22" font-weight="800" fill="${guidedPalette.secondary}">${sceneLabel(scene)}</text>${textLines({ value: scene.title, x: g.headline.x, y: g.headline.y + 62, maxChars: headlineMax, maxLines: horizontal ? 2 : 3, lineHeight: horizontal ? 66 : 58, fontSize: horizontal ? 58 : 48, weight: 880, className: "serif" })}<path data-reveal-item="1" d="M${g.headline.x} ${g.headline.y + (horizontal ? 160 : 190)}C${g.headline.x + 250} ${g.headline.y + (horizontal ? 142 : 174)} ${g.headline.x + Math.min(g.headline.w, 850)} ${g.headline.y + (horizontal ? 154 : 184)} ${g.headline.x + Math.min(g.headline.w, 980)} ${g.headline.y + (horizontal ? 164 : 194)}" fill="none" stroke="${guidedPalette.accent}" stroke-width="7" stroke-linecap="round"/></g>`, "headline"));
    mains.push(sceneGroup(scene, index, `<g data-master-object-id="${escapeSvg(g.objectIds.content)}">${rendered.main}</g>`, "content"));
    paths.push(sceneGroup(scene, index, rendered.path, "path"));
    const annotationY = g.content.y + g.content.h + (horizontal ? 8 : 16);
    const annotationH = horizontal ? 42 : 58;
    const annotationContent = scene.layoutVariant === "quote-stage"
      ? ""
      : `<g data-reveal-item="${Math.max(2, items.length)}"><rect x="${g.content.x + 24}" y="${annotationY}" width="${Math.min(g.content.w - 48, horizontal ? 760 : 900)}" height="${annotationH}" rx="${annotationH / 2}" fill="#fff7ef" stroke="${PALETTE.orange}" stroke-width="2"/><text x="${g.content.x + 52}" y="${annotationY + (horizontal ? 28 : 38)}" font-size="${horizontal ? 19 : 21}" font-weight="760" fill="${PALETTE.red}">${escapeSvg(clean(scene.takeaway || scene.subtitle, horizontal ? 32 : 24))}</text></g>`;
    annotations.push(sceneGroup(scene, index, annotationContent, "annotation"));
    personas.push(sceneGroup(scene, index, `<g data-master-object-id="${escapeSvg(g.objectIds.persona)}"><image href="${personaData}" x="${g.persona.x}" y="${g.persona.y}" width="${g.persona.w}" height="${g.persona.h}" preserveAspectRatio="xMidYMid meet"/><path data-reveal-item="1" d="M${g.persona.x + 42} ${g.persona.y + g.persona.h - 18}C${g.persona.x + 120} ${g.persona.y + g.persona.h + 4} ${g.persona.x + g.persona.w - 86} ${g.persona.y + g.persona.h - 4} ${g.persona.x + g.persona.w - 32} ${g.persona.y + g.persona.h - 20}" fill="none" stroke="${guidedPalette.accent}" stroke-width="7" stroke-linecap="round"/></g>`, "persona"));
    const agentX = horizontal
      ? (g.personaSide === "left" ? 112 : canvas.width - 210)
      : (g.personaSide === "left" ? canvas.width - 178 : 62);
    const agentY = horizontal ? 784 : 520;
    const agentScale = horizontal ? 1 : 0.92;
    agents.push(sceneGroup(scene, index, `<g data-agent data-reveal-item="2" transform="translate(${agentX} ${agentY}) scale(${agentScale})"><path d="M36 20V5M28 5h16" fill="none" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round"/><rect x="8" y="20" width="64" height="58" rx="18" fill="#fff" stroke="${PALETTE.ink}" stroke-width="4"/><circle cx="29" cy="45" r="5" fill="${PALETTE.blue}"/><circle cx="51" cy="45" r="5" fill="${PALETTE.orange}"/><path d="M26 62h28" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round"/><rect x="18" y="78" width="44" height="22" rx="6" fill="#eef5ff" stroke="${PALETTE.blue}" stroke-width="3"/><path d="M28 88h24" stroke="${PALETTE.blue}" stroke-width="3" stroke-linecap="round"/></g>`, "agent"));
  });
  const captionY = horizontal ? 958 : 1740;
  const captionX = horizontal ? 320 : 82;
  const captionW = horizontal ? 1280 : 916;
  const captionH = horizontal ? 82 : 108;
  const caption = `<g id="layer-caption" data-layer="caption"><rect x="${captionX}" y="${captionY}" width="${captionW}" height="${captionH}" rx="${captionH / 2}" fill="${PALETTE.ink}"/><text id="caption-text" x="${canvas.width / 2}" y="${captionY + (horizontal ? 53 : 68)}" text-anchor="middle" font-size="${horizontal ? 28 : 31}" font-weight="750" fill="#fff"></text></g>`;
  return [
    ["00-background", "background", 0, `<g id="layer-background" data-layer="background">${backgrounds}</g>`],
    ["30-content-path", "semantic-path", 10, `<g id="layer-upgrade-route" data-layer="path">${paths.join("")}</g>`],
    ["10-headline", "headline", 20, `<g id="layer-headline" data-layer="headline">${headlines.join("")}</g>`],
    ["20-content-main", "content-group", 30, `<g id="layer-content-main" data-layer="content">${mains.join("")}</g>`],
    ["40-annotation", "annotation", 34, `<g id="layer-annotation" data-layer="annotation">${annotations.join("")}</g>`],
    ["50-persona", "personal-ip", 40, `<g id="layer-persona" data-layer="persona">${personas.join("")}</g>`],
    ["60-agent", "execution-agent", 45, `<g id="layer-agent" data-layer="agent">${agents.join("")}</g>`],
    ["100-caption", "subtitle-overlay", 100, caption],
  ];
}

export const SEMANTIC_LAYOUT_DEFINITIONS = [
  "quote-stage",
  "force-compass",
  "causal-chain",
  "choice-branches",
  "resource-pressure-map",
  "mirror-split",
  "arc-timeline",
  "scorecard",
  "action-checklist",
  "evidence-ledger",
  "method-path",
  "editorial-statement",
];
