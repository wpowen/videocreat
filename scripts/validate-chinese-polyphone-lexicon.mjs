#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const lexiconPath = join(skillRoot, "assets/chinese-polyphone-phrases.json");
const meloPython = join(skillRoot, "research/voice-quality-poc/melotts/.venv/bin/python");

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
    const phrase = entry && typeof entry.phrase === "string" ? entry.phrase : "";
    const pronunciation = Array.isArray(entry?.pinyin) ? entry.pinyin : [];
    expect(Boolean(phrase), "each entry needs a phrase", failures);
    expect(!phrase || !seen.has(phrase), `duplicate phrase: ${phrase}`, failures);
    if (phrase) seen.add(phrase);
    expect(Array.isArray(entry?.pinyin), `entry ${phrase || "<invalid>"} needs pinyin array`, failures);
    expect(pronunciation.every((item) => typeof item === "string" && /^[a-z]+[1-5]$/i.test(item)), `entry ${phrase || "<invalid>"} has invalid tone-number pinyin`, failures);
    expect(!phrase || [...phrase].length === pronunciation.length, `entry ${phrase || "<invalid>"} pinyin count must match character count`, failures);
  }

  if (existsSync(meloPython) && failures.length === 0) {
    const probe = spawnSync(meloPython, ["-", lexiconPath], {
      cwd: skillRoot,
      encoding: "utf8",
      input: String.raw`
import json
import sys
from pathlib import Path
import jieba
from pypinyin import Style, lazy_pinyin, load_phrases_dict
from melo.text import chinese

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
phrase_dict = {entry["phrase"]: [[p] for p in entry["pinyin"]] for entry in data["phrases"]}
load_phrases_dict(phrase_dict)
for phrase in phrase_dict:
    jieba.add_word(phrase, freq=10**9, tag="x")
sample_phrases = ["处处", "削苹果", "剥削", "模样", "埋怨", "挣扎", "传记", "凡人修仙传", "传略", "一行人"]
result = {}
for phrase in sample_phrases:
    phones, tones, word2ph = chinese.g2p(chinese.text_normalize(phrase))
    result[phrase] = {
        "pinyin": lazy_pinyin(phrase, neutral_tone_with_five=True, style=Style.TONE3),
        "phones": phones,
        "tones": tones,
        "word2ph": word2ph,
    }
print(json.dumps(result, ensure_ascii=False))
`,
    });
    expect(probe.status === 0, `pypinyin probe failed: ${probe.stderr || probe.stdout}`, failures);
    if (probe.status === 0) {
      const actual = JSON.parse(probe.stdout);
      const expected = Object.fromEntries(phrases.map((entry) => [entry.phrase, entry.pinyin]));
      for (const phrase of Object.keys(actual)) {
        expect(JSON.stringify(actual[phrase].pinyin) === JSON.stringify(expected[phrase]), `probe mismatch for ${phrase}: ${actual[phrase].pinyin} !== ${expected[phrase]}`, failures);
        expect(Array.isArray(actual[phrase].phones) && actual[phrase].phones.length > 2, `MeloTTS frontend produced no phones for ${phrase}`, failures);
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    lexicon: "assets/chinese-polyphone-phrases.json",
    version: lexicon.version || null,
    entries: phrases.length,
    pythonProbe: existsSync(meloPython) ? "passed: research/voice-quality-poc/melotts/.venv/bin/python" : "failed: MeloTTS venv not found",
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!existsSync(meloPython)) process.exitCode = 1;
  if (!report.ok) process.exitCode = 1;
}

main();
