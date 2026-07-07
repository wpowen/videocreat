# Voice Direction

Use this reference before generating narration audio or when the user asks for口语化,停顿,更自然,像真人讲,教程感,新闻感,故事感, or product-demo pacing.

## Core Rule

Voice direction is planned before TTS. Every run should write:

- `workflow/voice-direction.json`
- `script/narration.txt` for the original approved narration
- `script/narration-spoken.txt` for the TTS-ready spoken narration
- `workflow/voice-subtitle-manifest.json` after audio generation

Do not send the original narration directly to TTS when a speech style is requested or inferred.

## Audio Generation Parameters

Chinese final-quality narration must use a local backend:

- Prefer `cosyvoice_local`, then `melotts_local`.
- MeloTTS Chinese must use `-l ZH`, not lowercase `zh`.
- MeloTTS should use `-d cpu` by default for reproducible local runs.
- Default Chinese MeloTTS speed should be around `0.95` for clear口播 pacing unless the brief requires another pace and the chosen value is recorded.
- For Chinese MeloTTS, load `assets/chinese-polyphone-phrases.json` before model inference so phrase-level 多音字 choices such as `处处`, `削苹果`, `埋怨`, and `一行人` can override generic pypinyin guesses. Record the lexicon source/hash/version in the voice manifest.
- Do not use an audio fade that starts at `0` on the narration track. Fade-out may start only near the end of the final target duration, after `apad/atrim`.
- Preserve review files: `assets/narration.wav`, `assets/narration.m4a`, and `assets/narration.mp3`.
- Record backend, language, speed, device, normalization/filter chain, and fallback failures in `workflow/voice-subtitle-manifest.json`.

## Loudness Policy

Final口播 must sound like normal spoken-video volume, not a nearly silent track. Prefer a slightly amplified narration over a quiet one, while avoiding clipping.

Every final MP4 should run FFmpeg `volumedetect` and write `logs/volumedetect.log`. Treat these as hard local acceptance checks unless the user explicitly asks for a deliberately quiet mix:

- mean volume should normally land around `-30 dB` to `-18 dB`;
- hard fail if mean volume is below `-36 dB`;
- hard fail if max volume is below `-18 dB`;
- warn and review manually if max volume is near clipping.

## Pause Rules

For口语化/conversational narration:

- Add breathing pauses after complete sentences or complete semantic beats.
- Use punctuation and line breaks as TTS pause cues.
- Keep sentence meaning complete before every pause.
- The end of a sentence may pause; the middle of a sentence should not pause.
- Slightly longer pauses are useful after the hook, examples, reversals, and final rules.
- Subtitle visual wrapping must not become a TTS split. If a sentence is too long for one subtitle line, keep it as one audio cue, then display the wrapped caption lines sequentially as one-line visual subtitles.

## Punctuation Pause Durations

- Comma-like punctuation (`，`, `,`, `、`) is a short in-clause pause, not a line break and not a sentence-end pause.
- If a backend, renderer, or post-processing step needs an explicit comma pause value, use `0.5s`.
- If a prior adapter treated comma pauses as `1s`, replace that comma-only value with `0.5s`.
- Sentence-ending punctuation (`。`, `！`, `？`, `!`, `?`) keeps the backend/default pause duration.
- Semantic endings (`；`, `;`) also keep the existing sentence/semantic-beat pause policy unless the user explicitly requests a different rhythm.
- Record this in `workflow/voice-direction.json` as `pauseDurations.commaLikeSeconds: 0.5` and `pauseDurations.sentenceEnd: "tts-default"`.
- `script/narration-spoken.txt` must not introduce a newline immediately after `，`, `,`, or `、`.

Never pause between:

- subject and predicate;
- verb and object;
- number and unit;
- cause and required result;
- setup and the answer it depends on;
- a quoted example and the explanation that makes it understandable.

## Video-Type Presets

| Type | Speech style | Pace | Pause placement |
| --- | --- | --- | --- |
| Creator/novel-writing explainer | `conversational` | medium-slow | after complete sentences, examples, reversals, final rule |
| Tutorial/how-to | `tutorial` | steady | after step labels and completed instructions |
| Knowledge explainer | `explainer` | medium | after definitions, contrasts, and examples |
| Story/narrative | `story` | variable | after scene beats, reveals, and reversals |
| News/analysis | `news` | controlled | after facts, dates, numbers, and causal conclusions |
| Product demo | `product` | crisp | after benefit, action, and proof |
| Documentary | `documentary` | slow | after imagery-heavy sentences and section turns |

## Spoken Narration Policy

The spoken narration may add line breaks for pauses, but it must not:

- break sentence completeness;
- split a word, quote, or incomplete sentence only because it does not fit on one subtitle line;
- rewrite claims;
- invent facts;
- add unauthorized persona, accent, or real-person imitation;
- rely on cloned/reference voice;
- drift from subtitles so far that captions feel unrelated.

## Manifest Expectations

`workflow/voice-direction.json` should include:

- `speechStyle`
- `videoType`
- `pace`
- `tone`
- `pause`
- `sentenceRule`
- `hardRules`
- output file paths

QC should fail when the voice direction is missing, the spoken narration file is missing, or the pause policy does not explicitly protect sentence completeness.
