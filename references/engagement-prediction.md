# Engagement Prediction Audit

Use this reference when the user asks whether a generated video can be scored,
ranked, or improved before publishing based on predicted views, likes, comments,
shares, or virality.

The safe integration shape is an audit loop, not a promise engine. Treat
engagement prediction as a pre-publish diagnostic that can compare variants and
surface weak content signals. Do not claim exact platform performance unless a
current, platform-specific, locally evaluated model proves that claim.

## Source Reviewed

- Repository: `https://github.com/juanls1/TikTok-Virality-Predictor`
- Reviewed commit: `eaf9df1ced9189995731ca413c18e3d782be5470`
- Repository API status on 2026-06-30: public, default branch `main`, no
  GitHub license field.
- README claim: the project predicts TikTok virality from video, text, and
  audio data.
- README virality target: `views + (1 - corr_views_likes) * likes + (1 -
  corr_views_comments) * comments + (1 - corr_views_shares) * shares`.
- README future work: estimating the ratio of views, likes, shares, and
  comments from virality is listed as future improvement, not current shipped
  behavior.
- Streamlit app behavior: accepts an uploaded MP4 plus caption and hashtags,
  extracts audio, transcribes audio, extracts frames, and returns text, audio,
  image, weighted-average, or multimodal virality predictions.

Useful source URLs:

- `https://github.com/juanls1/TikTok-Virality-Predictor`
- `https://raw.githubusercontent.com/juanls1/TikTok-Virality-Predictor/main/README.md`
- `https://raw.githubusercontent.com/juanls1/TikTok-Virality-Predictor/main/src/streamlit/app.py`
- `https://raw.githubusercontent.com/juanls1/TikTok-Virality-Predictor/main/src/utils/utils_streamlit.py`

## What To Borrow

Borrow the multimodal review shape:

- video frames as visual evidence;
- audio extraction and audio-feature review;
- transcription, caption, and hashtag text review;
- independent modality scores plus a combined score;
- variant comparison before final packaging;
- explicit model card and calibration record before any numeric claim.

Borrowable feature groups for `codex-video-workflow`:

- first-frame and cover-promise consistency;
- first-three-second hook clarity;
- subtitle/caption readability;
- narration transcript clarity and searchable topic terms;
- audio presence, loudness, rhythm, and silence risk;
- visual state changes and frame variety;
- caption/hashtag/title package completeness for the target platform.

## What Not To Borrow

- Do not copy repository code or model artifacts into this skill unless a
  compatible license or explicit permission is recorded.
- Do not treat the repository as production-ready for current TikTok, Douyin,
  YouTube Shorts, Bilibili, Reels, or X performance prediction without a fresh
  evaluation set.
- Do not promise exact views, likes, comments, or shares. The reviewed project
  predicts a composite virality score; exact metric decomposition is future
  work in its README.
- Do not make a public-platform scraper, cloud ASR, or upload-account workflow a
  default dependency.
- Do not treat generated-video quality signals as causal proof of distribution
  performance. Platform ranking, audience graph, account history, topic demand,
  timing, moderation, paid promotion, and retention telemetry are outside the
  generated MP4 itself.

## Planner Capability Card

```json
{
  "capabilityId": "engagement-prediction-audit",
  "capabilityType": "optional pre-publish diagnostic",
  "source": "juanls1/TikTok-Virality-Predictor-inspired multimodal audit",
  "decision": "activate only when the user asks for virality, engagement, views, likes, variant ranking, or publish-readiness prediction",
  "borrowedControls": [
    "video-frame feature review",
    "audio feature review",
    "transcript/caption/hashtag review",
    "independent modality findings",
    "combined relative potential score",
    "variant comparison"
  ],
  "rejectedControls": [
    "exact views/likes prediction without evaluated model",
    "copying unlicensed source code or model artifacts",
    "using the external repository as the governor",
    "unauthorized platform scraping",
    "cloud ASR as a default dependency"
  ],
  "qcAdditions": [
    "workflow/engagement-prediction-plan.json",
    "workflow/engagement-feature-audit.json",
    "workflow/engagement-model-card.md",
    "workflow/engagement-variant-report.md when comparing variants"
  ]
}
```

## Required Artifacts When Active

Write `workflow/engagement-prediction-plan.json`:

```json
{
  "schemaVersion": 1,
  "active": true,
  "trigger": "user requested generated-video engagement prediction",
  "governor": "codex-video-workflow",
  "predictionMode": "relative-potential-audit",
  "targetPlatform": "tiktok-or-douyin-short-form",
  "sourceInspiration": {
    "repository": "juanls1/TikTok-Virality-Predictor",
    "reviewedCommit": "eaf9df1ced9189995731ca413c18e3d782be5470",
    "borrowed": ["multimodal feature groups", "independent plus combined score pattern"],
    "notBorrowed": ["unlicensed code", "model weights", "exact metric prediction claim"]
  },
  "inputs": {
    "video": "final.mp4",
    "cover": "cover/*",
    "spokenTranscript": "script/narration-spoken.txt",
    "subtitles": "script/subtitles.srt",
    "titleDescriptionHashtags": "delivery.html copy fields or brief metadata"
  },
  "claimBoundary": "relative score and improvement suggestions only; no exact views, likes, comments, shares, revenue, or guaranteed distribution",
  "requiredEvidence": [
    "workflow/engagement-feature-audit.json",
    "workflow/engagement-model-card.md"
  ]
}
```

Write `workflow/engagement-feature-audit.json`:

```json
{
  "schemaVersion": 1,
  "videoId": "local-generated-output",
  "features": {
    "firstFramePromise": {"status": "pass|warn|fail", "evidence": ""},
    "firstThreeSecondHook": {"status": "pass|warn|fail", "evidence": ""},
    "coverContinuity": {"status": "pass|warn|fail", "evidence": ""},
    "captionReadability": {"status": "pass|warn|fail", "evidence": ""},
    "audioPresenceAndEnergy": {"status": "pass|warn|fail", "evidence": ""},
    "transcriptSearchability": {"status": "pass|warn|fail", "evidence": ""},
    "visualStateVariety": {"status": "pass|warn|fail", "evidence": ""},
    "titleCaptionHashtagPackage": {"status": "pass|warn|fail", "evidence": ""}
  },
  "relativePotential": {
    "score0To100": null,
    "confidence": "low|medium|high",
    "calibration": "heuristic|local-eval|platform-specific-model",
    "notExactMetricPrediction": true
  },
  "recommendedChanges": []
}
```

Write `workflow/engagement-model-card.md`:

- model or heuristic owner;
- target platform and content category;
- training/evaluation data provenance;
- last evaluation date;
- metrics used for evaluation;
- known bias and drift risks;
- whether the model predicts composite virality, relative ranking, or exact
  metrics;
- explicit statement that exact views/likes prediction is disabled unless
  evaluation evidence exists.

When comparing variants, write `workflow/engagement-variant-report.md` with:

- variant ids and file paths;
- feature differences;
- relative score differences;
- recommended winner;
- which recommendation should feed back into cover, hook, title, captions,
  voice, or visual rhythm.

## Workflow Integration

1. Run after a draft render has a playable MP4, cover, subtitles, and delivery
   copy, or run on multiple candidate drafts.
2. Extract local evidence with existing video workflow artifacts first:
   screenshots, `logs/ffprobe.json`, `logs/volumedetect.log`,
   `script/narration-spoken.txt`, `script/subtitles.srt`,
   `workflow/visual-rhythm-plan.json`, and `workflow/cover-design.json`.
3. If no evaluated predictor exists, emit a relative heuristic audit only.
4. If a trained predictor exists, require `workflow/engagement-model-card.md`
   before showing any score.
5. Feed recommendations back into bounded areas: cover promise, first-frame
   hook, title/caption package, subtitle readability, audio energy, visual
   rhythm, and scene pacing.
6. Keep platform-readiness language conservative. Human editorial review,
   upload policy, AI labeling, account history, and real retention telemetry
   remain outside this local skill.

## Pass And Fail Rules

Pass when:

- the audit states its trigger, target platform, evidence, and claim boundary;
- exact metric predictions are disabled unless a current evaluated model exists;
- recommendations map to specific local artifacts or render changes;
- source, license, and model-card constraints are recorded.

Fail when:

- a score is presented as guaranteed views, likes, comments, or shares;
- the external repository is described as already solving exact metric
  prediction;
- the audit bypasses current video QC and suggests publishing a package with
  failed audio, subtitle, cover, rights, or layout checks;
- unlicensed external source code, datasets, or model weights are copied into
  the distributable skill package.
