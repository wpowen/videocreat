#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const lexiconPath = join(skillRoot, "assets/chinese-polyphone-phrases.json");
const meloPython = join(workspace, "research/voice-quality-poc/melotts/.venv/bin/python");

function expect(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const failures = [];
  expect(existsSync(lexiconPath), "missing assets/chinese-polyphone-phrases.json", failures);
  const lexicon = existsSync(lexiconPath) ? JSON.parse(readFileSync(lexiconPath, "utf8")) : {};
  const phrases = Array.isArray(lexicon.phrases) ? lexicon.phrases : [];
  expect(typeof lexicon.version === "string" && lexicon.version.length > 0, "lexicon version is required", failures);
  expect(phrases.length >= 20, "lexicon should include a useful starter set", failures);

  const seen = new Set();
  for (const entry of phrases) {
    expect(entry && typeof entry.phrase === "string" && entry.phrase.length > 0, "each entry needs a phrase", failures);
    expect(!seen.has(entry.phrase), `duplicate phrase: ${entry.phrase}`, failures);
    seen.add(entry.phrase);
    expect(Array.isArray(entry.pinyin), `entry ${entry.phrase} needs pinyin array`, failures);
    expect(entry.pinyin.every((item) => typeof item === "string" && /^[a-z]+[1-5]$/i.test(item)), `entry ${entry.phrase} has invalid tone-number pinyin`, failures);
    expect([...entry.phrase].length === entry.pinyin.length, `entry ${entry.phrase} pinyin count must match character count`, failures);
  }

  if (existsSync(meloPython) && failures.length === 0) {
    const probe = spawnSync(meloPython, ["-", lexiconPath], {
      cwd: workspace,
      encoding: "utf8",
      input: String.raw`
import json
import sys
from pathlib import Path
from pypinyin import Style, lazy_pinyin, load_phrases_dict

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
phrase_dict = {entry["phrase"]: [[p] for p in entry["pinyin"]] for entry in data["phrases"]}
load_phrases_dict(phrase_dict)
sample_phrases = ["处处", "削苹果", "剥削", "模样", "埋怨", "挣扎", "传记", "一行人"]
result = {}
for phrase in sample_phrases:
    result[phrase] = lazy_pinyin(phrase, neutral_tone_with_five=True, style=Style.TONE3)
print(json.dumps(result, ensure_ascii=False))
`,
    });
    expect(probe.status === 0, `pypinyin probe failed: ${probe.stderr || probe.stdout}`, failures);
    if (probe.status === 0) {
      const actual = JSON.parse(probe.stdout);
      const expected = Object.fromEntries(phrases.map((entry) => [entry.phrase, entry.pinyin]));
      for (const phrase of Object.keys(actual)) {
        expect(JSON.stringify(actual[phrase]) === JSON.stringify(expected[phrase]), `probe mismatch for ${phrase}: ${actual[phrase]} !== ${expected[phrase]}`, failures);
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    lexicon: "assets/chinese-polyphone-phrases.json",
    version: lexicon.version || null,
    entries: phrases.length,
    pythonProbe: existsSync(meloPython) ? "research/voice-quality-poc/melotts/.venv/bin/python" : "skipped: MeloTTS venv not found",
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
