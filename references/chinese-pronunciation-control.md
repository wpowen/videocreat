# Chinese Pronunciation Control

Use this contract before generating Chinese TTS.

## Required order

1. Finalize `script/narration-spoken.txt`.
2. Analyze the whole spoken manuscript with `scripts/analyze-chinese-pronunciation.py` before any TTS process starts.
3. Resolve every blocking polyphonic occurrence from the run overrides, the Skill lexicon, or a reviewed phrase context.
4. Write `workflow/chinese-pronunciation-preflight.json` and `workflow/effective-pronunciation-plan.json`.
5. Build frame and subtitle-cue segments and verify that no controlled phrase is split across TTS segments.
6. Select only a backend that can apply the locked plan.
7. Write `workflow/pronunciation-application-verification.json` and bind the plan hash into the voice manifest and caches.

Do not insert visible pinyin into `narration-spoken.txt`, subtitles, captions, or scene text. `annotatedText` is audit-only.

`workflow/effective-pronunciation-plan.json` is a synthesis contract, not only an analysis report. Its top-level `phrases` array must exist, must be non-empty for a controlled run, and must exactly match the analyzed `effectiveEntries`. Never send a report without synthesis-ready `phrases` to MeloTTS.

## Run-level input

Put project- or manuscript-specific readings in the brief:

```json
{
  "ttsPronunciations": [
    {
      "phrase": "凡人修仙传",
      "pinyin": ["fan2", "ren2", "xiu1", "xian1", "zhuan4"],
      "note": "作品名，传读 zhuàn"
    }
  ]
}
```

Use tone-number pinyin. Use `5` for a neutral tone and `v` for `ü` when required by the MeloTTS frontend, for example `lve4`.

## Resolution rules

- Prefer run-level `ttsPronunciations` over the Skill base lexicon.
- Prefer the longest non-overlapping phrase.
- Treat every occurrence as an auditable decision. Preserve its character offset and surrounding context.
- Fail before TTS when a reviewed phrase is missing, conflicts, is split across cue boundaries, has invalid pinyin, or cannot pass the real MeloTTS frontend.
- `--allow-unresolved-pronunciations` is degraded review mode only. It must not be described as pronunciation-guaranteed final output.

## Backend lowering

The verified local adapter is MeloTTS Chinese:

1. Load phrase pronunciations with `pypinyin.load_phrases_dict()`.
2. Add the same phrases to `jieba` with high priority so MeloTTS does not split a controlled phrase before G2P.
3. Validate through MeloTTS `text_normalize` and `g2p`, including `INITIALS`, `FINALS_TONE3`, the OpenCPOP symbol map, and tone sandhi.

Supplying a pronunciation-plan path while loading zero phrases is a hard error. Do not silently continue with the model default. The application stage must prove that the selected MeloTTS process loaded a positive entry count and that the loaded lexicon hash equals the locked plan hash.

When a pronunciation plan contains controlled Chinese occurrences, `auto` must lock to `melotts_local`. Do not fall back to CosyVoice or `say` if MeloTTS fails. A CosyVoice route may claim deterministic pronunciation control only after its model-specific pinyin/phoneme adapter has its own application verification.

## Required evidence

- `workflow/chinese-pronunciation-preflight.json`
- `workflow/effective-pronunciation-plan.json`
- `workflow/pronunciation-application-verification.json`
- `workflow/voice-subtitle-manifest.json` with `pronunciationNarrationHash` and `pronunciationPlanHash`

`workflow/pronunciation-application-verification.json` must contain `pronunciationLoaderActive: true`, `loadedPronunciationEntries > 0`, and `loadedPronunciationHash` equal to `pronunciationPlanHash` for every controlled run. A frontend probe, `resolved: N`, or `unresolved: 0` alone does not prove that the synthesizer applied the plan.

Changing the spoken manuscript or effective pronunciation plan must invalidate reusable audio. The effective pronunciation hash must participate in both output-local and shared MeloTTS segment cache keys.

## Validation

Run:

```bash
node scripts/validate-chinese-polyphone-lexicon.mjs
node scripts/validate-chinese-pronunciation-preflight.mjs
```

The first command must report a passed real MeloTTS Python probe. A skipped probe is not an end-to-end pass.
