#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


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
    args = parser.parse_args()

    from melo.api import TTS

    language = args.language.upper()
    model = TTS(language=language, device=args.device)
    speaker_ids = model.hps.data.spk2id
    speaker_id = speaker_ids[list(speaker_ids.keys())[0]]
    segments = json.loads(Path(args.segments_json).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for segment in segments:
        text = str(segment.get("text", "")).strip()
        if not text:
            raise ValueError(f"empty text for segment {segment.get('index')}")
        output = output_dir / f"segment-{int(segment['index']):04d}.wav"
        if output.exists() and output.stat().st_size > 1000:
            print(f"cached {output}", flush=True)
            continue
        model.tts_to_file(tts_safe_text(text), speaker_id, str(output), speed=args.speed, quiet=True)
        print(f"saved {output}", flush=True)


if __name__ == "__main__":
    main()
