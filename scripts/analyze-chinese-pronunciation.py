#!/usr/bin/env python3
"""Build a strict, auditable Chinese pronunciation plan before TTS."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import jieba
from pypinyin import Style, lazy_pinyin, load_phrases_dict, pinyin
from pypinyin.phrases_dict import phrases_dict as builtin_phrases


TONE3_RE = re.compile(r"^[a-z]+[1-5]$", re.IGNORECASE)
HAN_RE = re.compile(r"[\u4e00-\u9fff]")


def load_entries(path: str, key_names: tuple[str, ...], source: str) -> list[dict]:
    if not path:
        return []
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    values = []
    for key in key_names:
        if isinstance(data.get(key), list):
            values = data[key]
            break
    entries = []
    for index, raw in enumerate(values):
        if not isinstance(raw, dict):
            raise ValueError(f"{source} entry {index} must be an object")
        phrase = str(raw.get("phrase", "")).strip()
        pronunciation = raw.get("pinyin")
        if not phrase:
            raise ValueError(f"{source} entry {index} has an empty phrase")
        if not isinstance(pronunciation, list) or not pronunciation:
            raise ValueError(f"{source} entry {phrase!r} needs a non-empty pinyin array")
        if not all(isinstance(item, str) and TONE3_RE.fullmatch(item) for item in pronunciation):
            raise ValueError(f"{source} entry {phrase!r} contains invalid tone-number pinyin")
        if len(phrase) != len(pronunciation):
            raise ValueError(f"{source} entry {phrase!r} pinyin count must equal phrase length")
        entries.append({
            "phrase": phrase,
            "pinyin": [item.lower() for item in pronunciation],
            "note": str(raw.get("note", "")).strip(),
            "source": source,
        })
    return entries


def merge_entries(base: list[dict], overrides: list[dict]) -> tuple[list[dict], list[dict]]:
    selected: dict[str, dict] = {}
    shadowed = []
    for entry in [*base, *overrides]:
        previous = selected.get(entry["phrase"])
        if previous:
            shadowed.append({
                "phrase": entry["phrase"],
                "selectedSource": entry["source"],
                "shadowedSource": previous["source"],
                "shadowedPinyin": previous["pinyin"],
            })
        selected[entry["phrase"]] = entry
    return sorted(selected.values(), key=lambda item: (-len(item["phrase"]), item["phrase"])), shadowed


def non_overlapping_matches(text: str, entries: list[dict], occupied: set[int]) -> list[dict]:
    matches = []
    for entry in entries:
        start = 0
        while True:
            index = text.find(entry["phrase"], start)
            if index < 0:
                break
            end = index + len(entry["phrase"])
            positions = set(range(index, end))
            if not positions.intersection(occupied):
                occupied.update(positions)
                matches.append({
                    "phrase": entry["phrase"],
                    "pinyin": entry["pinyin"],
                    "source": entry["source"],
                    "note": entry.get("note", ""),
                    "start": index,
                    "end": end,
                })
            start = index + 1
    return sorted(matches, key=lambda item: item["start"])


def builtin_matches(text: str, occupied: set[int]) -> list[dict]:
    candidates = []
    max_length = min(10, len(text))
    seen = set()
    for length in range(max_length, 1, -1):
        for start in range(0, len(text) - length + 1):
            phrase = text[start:start + length]
            if phrase in seen or phrase not in builtin_phrases:
                continue
            seen.add(phrase)
            candidates.append({
                "phrase": phrase,
                "pinyin": lazy_pinyin(phrase, style=Style.TONE3, neutral_tone_with_five=True),
                "source": "pypinyin-builtin-phrase",
                "note": "resolved by pypinyin built-in phrase dictionary",
            })
    return non_overlapping_matches(text, candidates, occupied)


def standalone_candidates(character: str) -> list[str]:
    if not HAN_RE.fullmatch(character):
        return []
    values = pinyin(character, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True)[0]
    return list(dict.fromkeys(item.lower() for item in values if TONE3_RE.fullmatch(item)))


def validate_melo_frontend(entries: list[dict]) -> list[dict]:
    phrase_dict = {entry["phrase"]: [[item] for item in entry["pinyin"]] for entry in entries}
    if phrase_dict:
        load_phrases_dict(phrase_dict)
        for entry in entries:
            jieba.add_word(entry["phrase"], freq=10**9, tag="x")
    try:
        from melo.text import chinese
    except Exception:
        return [{"status": "skipped", "reason": "melo.text.chinese unavailable"}]
    results = []
    for entry in entries:
        try:
            normalized = chinese.text_normalize(entry["phrase"])
            phones, tones, _ = chinese.g2p(normalized)
            results.append({
                "phrase": entry["phrase"],
                "status": "passed",
                "phoneCount": len(phones),
                "tones": tones,
            })
        except Exception as error:
            raise ValueError(f"MeloTTS frontend rejected {entry['phrase']!r}: {error}") from error
    return results


def annotate_text(text: str, resolutions: dict[int, dict]) -> str:
    output = []
    for index, character in enumerate(text):
        resolution = resolutions.get(index)
        if resolution:
            output.append(f"{character}[{resolution['selected']}]" )
        else:
            output.append(character)
    return "".join(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-file", required=True)
    parser.add_argument("--base-lexicon", required=True)
    parser.add_argument("--overrides", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--allow-unresolved", action="store_true")
    args = parser.parse_args()

    text = Path(args.text_file).read_text(encoding="utf-8")
    base = load_entries(args.base_lexicon, ("phrases", "pronunciations"), "base-lexicon")
    overrides = load_entries(args.overrides, ("pronunciations", "phrases"), "run-override") if args.overrides else []
    entries, shadowed = merge_entries(base, overrides)
    frontend_validation = validate_melo_frontend(entries)

    occupied: set[int] = set()
    phrase_matches = non_overlapping_matches(text, entries, occupied)
    builtin_phrase_matches = builtin_matches(text, occupied)
    coverage = {}
    for match in [*phrase_matches, *builtin_phrase_matches]:
        for offset, selected in enumerate(match["pinyin"]):
            coverage[match["start"] + offset] = {
                "selected": selected,
                "source": match["source"],
                "phrase": match["phrase"],
            }

    resolved = []
    unresolved = []
    for index, character in enumerate(text):
        candidates = standalone_candidates(character)
        if len(candidates) <= 1:
            continue
        resolution = coverage.get(index)
        item = {
            "character": character,
            "index": index,
            "context": text[max(0, index - 8):min(len(text), index + 9)],
            "candidates": candidates,
        }
        if resolution:
            resolved.append({**item, **resolution})
        else:
            default = lazy_pinyin(character, style=Style.TONE3, neutral_tone_with_five=True)[0]
            unresolved.append({**item, "default": default, "reason": "no reviewed phrase covers this polyphonic character"})

    effective_payload = [{"phrase": entry["phrase"], "pinyin": entry["pinyin"], "source": entry["source"]} for entry in entries]
    effective_hash = hashlib.sha256(json.dumps(effective_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    narration_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    blocking = bool(unresolved) and not args.allow_unresolved
    report = {
        "schemaVersion": 1,
        "stage": "pre-tts-whole-document-pronunciation-analysis",
        "ok": not unresolved,
        "blocking": blocking,
        "allowUnresolved": args.allow_unresolved,
        "narrationHash": narration_hash,
        "effectivePronunciationHash": effective_hash,
        "analysisOrder": "whole document before TTS segmentation and synthesis",
        "matchingPolicy": "run override > base lexicon > pypinyin built-in phrase; longest non-overlapping phrase wins",
        "backendStrategy": "melotts-pypinyin-plus-jieba-phrase-injection" if resolved else "default-backend-pronunciation",
        "effectiveEntries": effective_payload,
        "phrases": effective_payload,
        "shadowedEntries": shadowed,
        "phraseMatches": phrase_matches,
        "builtinPhraseMatches": builtin_phrase_matches,
        "resolved": resolved,
        "unresolved": unresolved,
        "counts": {
            "characters": len(text),
            "effectiveEntries": len(entries),
            "phraseMatches": len(phrase_matches),
            "polyphoneCandidates": len(resolved) + len(unresolved),
            "resolved": len(resolved),
            "unresolved": len(unresolved),
        },
        "annotatedText": annotate_text(text, coverage),
        "meloFrontendValidation": frontend_validation,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "blocking": blocking, **report["counts"]}, ensure_ascii=False))
    return 2 if blocking else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"pronunciation preflight failed: {error}", file=sys.stderr)
        raise SystemExit(1)
