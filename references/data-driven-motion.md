# Data Driven Motion

Use this reference when a video needs numeric evidence, time-series curves, growth/decline stories, market or policy trends, scientific measurements, or any scene where a number changes over time.

This is a planner rule, not a default rendering mode. Data-driven motion should be called only when the visual evidence makes the narration more credible or easier to understand than a static claim card.

## Planner Trigger

The planner should consider data-driven motion when the brief, source, or scene contains:

- trend words: growth, decline, volatility, spike, collapse, recovery, cycle, curve, slope, acceleration, slowdown;
- data words: data, metric, index, rate, value, ranking, share, percentage, benchmark, historical series;
- Chinese equivalents: 数据, 指标, 曲线, 趋势, 增长, 下降, 波动, 峰值, 拐点, 占比, 排名, 年份, 月度, 同比, 环比;
- a user explicitly asks to search for values, compare numbers, prove a trend, or dynamically draw a chart.

Do not trigger data-driven motion for decorative numbers, unsupported claims, or a scene whose point is emotional/narrative rather than evidentiary.

## Data Acquisition Rule

Before rendering any data-driven scene, write `workflow/data-source-plan.json`.

Required fields:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-data-source-plan",
  "searchIntent": "Find monthly EV sales in China from 2020 to 2025.",
  "metricDefinition": "unit, denominator, geography, frequency, transformation",
  "sourcePreference": ["official API", "official CSV", "reputable public dataset", "clearly cited secondary source"],
  "searchQueries": ["..."],
  "selectedSources": [
    {
      "name": "Source name",
      "url": "https://...",
      "publisher": "publisher",
      "retrievalMethod": "web-search | API | CSV | manual-source-material",
      "licenseOrTerms": "recorded if available",
      "whySelected": "primary source / complete time series / clear metadata"
    }
  ],
  "rejectedSources": [
    {
      "url": "https://...",
      "reason": "unclear provenance / chart-only / stale / no downloadable values"
    }
  ],
  "freshnessRequired": true,
  "verification": ["source URL saved", "retrieval command saved", "row count checked", "units checked"]
}
```

Preferred source order:

1. Official APIs or official downloadable data.
2. Public datasets with metadata and stable download links.
3. Reputable secondary sources only when primary data is unavailable, with the limitation recorded.
4. Never scrape chart pixels or infer values from screenshots unless the user explicitly accepts degraded evidence.

## Data Shaping Rule

Write `workflow/data-series.json` before rendering.

Required fields:

```json
{
  "schemaVersion": 1,
  "series": [
    {
      "id": "primary-series",
      "label": "Metric label",
      "unit": "%",
      "frequency": "monthly",
      "geography": "China",
      "sourceUrl": "https://...",
      "points": [
        { "date": "2020-01", "value": 12.3 }
      ],
      "transformations": ["none | indexed-to-100 | yoy-change | rolling-average"],
      "qualityNotes": ["missing months interpolated: none"]
    }
  ],
  "sceneBindings": [
    {
      "sceneId": "scene-03",
      "seriesIds": ["primary-series"],
      "narrationClaim": "The curve accelerates after 2022.",
      "visualFocus": "highlight inflection and endpoint"
    }
  ]
}
```

The planner must not render a curve from unsourced values. If exact values are not available, use a qualitative diagram and mark the scene as `dataEvidenceStatus: "qualitative"` rather than pretending it is measured data.

## Motion Planning Rule

Write `workflow/data-motion-plan.json` when `workflow/data-series.json` exists.

Required fields:

```json
{
  "schemaVersion": 1,
  "stage": "pre-render-data-motion-plan",
  "renderer": "html-data-curve | manim-insert | d3-diagram | static-degraded",
  "selectionRule": "Use html-data-curve for simple time series; Manim only for formula/physics/geometric relationships; D3 only when layout/stat transforms need it.",
  "scenes": [
    {
      "sceneId": "scene-03",
      "chartType": "line",
      "motionVerb": "trace",
      "semanticJob": "prove trend, highlight anomaly, compare slopes, show endpoint",
      "timecodeBinding": "workflow/sync-timecode-plan.json scene-03",
      "dataBinding": "workflow/data-series.json primary-series",
      "animation": {
        "build": "axis -> line trace -> inflection highlight -> endpoint label",
        "callouts": ["inflection", "latest value"],
        "durationPolicy": "bound to narration cue, not free-running"
      },
      "fallback": "show final chart state with source footnote and mark motion degraded",
      "verification": ["ffprobe", "keyframe screenshots", "line visibly traces", "source footnote visible", "caption safe area clear"]
    }
  ]
}
```

## Renderer Routing

Use the smallest renderer that expresses the data honestly:

| Need | Renderer | Reason |
| --- | --- | --- |
| One or two time-series lines, area, endpoint callout | `data-curve-trace` HTML template | Local-first, deterministic, works with existing HTML/video capture. |
| Ranking, grouped bars, scatter, many points, generated scales | D3 inside HTML template | D3 helps with scales/layout but exact text remains local HTML/SVG. |
| Formula-driven curve, physics path, geometric proof, parametric relationship | `manim-insert` | The relationship is mathematical, not just chart styling. |
| No sourced values, only conceptual shape | HTML/SVG qualitative diagram | Avoid fake precision. |

## QC Gates

A data-driven motion scene fails QC when:

- `workflow/data-source-plan.json` is missing;
- `workflow/data-series.json` is missing or has no source URL for measured data;
- the plotted series does not match the stated unit, geography, frequency, or transformation;
- the line animation is decorative and not bound to narration timing;
- a source footnote is absent when measured data is shown;
- subtitles/captions overlap axes, endpoint labels, or callouts;
- the video claims current/latest data without a retrieval date and source freshness note.

## Integration Boundary

Data-driven motion may own chart geometry, curve tracing, callouts, and source footnotes. It must not own narration, TTS, subtitle segmentation, cover variants, delivery page, or the final QC package. Those remain part of `codex-video-workflow`.
