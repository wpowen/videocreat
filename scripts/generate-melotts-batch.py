#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import hashlib
from pathlib import Path


def load_polyphone_lexicon(path: str | None) -> dict:
    if not path:
        return {"active": False, "entries": 0, "hash": None}
    lexicon_path = Path(path)
    if not lexicon_path.exists():
        raise FileNotFoundError(f"polyphone lexicon not found: {lexicon_path}")
    raw = lexicon_path.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    phrases = data.get("phrases", [])
    if not phrases:
        raise ValueError(f"pronunciation plan contains no synthesis-ready phrases: {lexicon_path}")
    phrase_dict = {}
    for entry in phrases:
        phrase = str(entry.get("phrase", "")).strip()
        pinyin = entry.get("pinyin", [])
        if not phrase or not isinstance(pinyin, list) or len(phrase) != len(pinyin):
            raise ValueError(f"invalid polyphone lexicon entry: {entry!r}")
        phrase_dict[phrase] = [[item] for item in pinyin]
    import jieba
    from pypinyin import load_phrases_dict
    load_phrases_dict(phrase_dict)
    for phrase in phrase_dict:
        jieba.add_word(phrase, freq=10**9, tag="x")
    return {
        "active": True,
        "entries": len(phrase_dict),
        "hash": data.get("effectivePronunciationHash") or hashlib.sha256(raw).hexdigest(),
        "narrationHash": data.get("narrationHash"),
        "version": data.get("schemaVersion") or data.get("version"),
        "matchedPhrases": [item.get("phrase") for item in data.get("phraseMatches", []) if item.get("phrase")],
    }


def tts_safe_text(text: str) -> str:
    replacements = {
        "^": " 上标 ",
        "_": " ",
        "/": " 除以 ",
        "=": " 等于 ",
        "%": " 百分比 ",
        "√": " 根号 ",
        "×": " 乘以 ",
        "·": "，",
        "–": "-",
        "—": "，",
        "「": "“",
        "」": "”",
    }
    value = text
    for source, target in replacements.items():
        value = value.replace(source, target)
    value = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9，。！？、；：,.!?;:（）()《》“”\"'\s+\-]", "，", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value or "。"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--segments-json", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--language", default="ZH")
    parser.add_argument("--speed", type=float, default=0.95)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--polyphone-lexicon", required=True)
    parser.add_argument("--application-verification", required=True)
    args = parser.parse_args()

    verification_path = Path(args.application_verification)
    if verification_path.exists():
        verification_path.unlink()

    polyphone_status = load_polyphone_lexicon(args.polyphone_lexicon)
    if not polyphone_status["active"] or polyphone_status["entries"] <= 0:
        raise ValueError("pronunciation loader is not active")
    print(f"loaded polyphone lexicon entries={polyphone_status['entries']} hash={polyphone_status['hash']}", flush=True)

    from melo.api import TTS

    language = args.language.upper()
    model = TTS(language=language, device=args.device)
    speaker_ids = model.hps.data.spk2id
    speaker_id = speaker_ids[list(speaker_ids.keys())[0]]
    segments = json.loads(Path(args.segments_json).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    missing_matched_phrases = [
        phrase for phrase in polyphone_status["matchedPhrases"]
        if not any(phrase in str(segment.get("text", "")) for segment in segments)
    ]
    if missing_matched_phrases:
        raise ValueError(f"controlled phrases are split or absent from TTS segments: {missing_matched_phrases}")

    for segment in segments:
        text = str(segment.get("text", "")).strip()
        if not text:
            raise ValueError(f"empty text for segment {segment.get('index')}")
        output = output_dir / f"segment-{int(segment['index']):04d}.wav"
        if output.exists():
            output.unlink()
        model.tts_to_file(tts_safe_text(text), speaker_id, str(output), speed=args.speed, quiet=True)
        print(f"saved {output}", flush=True)

    verification_path.parent.mkdir(parents=True, exist_ok=True)
    verification_path.write_text(json.dumps({
        "schemaVersion": 1,
        "status": "passed",
        "backend": "melotts_local",
        "pronunciationLoaderActive": True,
        "loadedPronunciationEntries": polyphone_status["entries"],
        "loadedPronunciationHash": polyphone_status["hash"],
        "pronunciationPlanHash": polyphone_status["hash"],
        "narrationHash": polyphone_status["narrationHash"],
        "matchedPhraseCount": len(polyphone_status["matchedPhrases"]),
        "segmentBoundaryAuditPassed": True,
        "backendStrategy": "MeloTTS pypinyin.load_phrases_dict plus jieba.add_word before model inference",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
