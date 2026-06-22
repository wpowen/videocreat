# Cover Design

Use this reference before final packaging for any social video. The cover/thumbnail is not an afterthought; it is the viewer's first decision surface and must be designed from the same content strategy as the video.

## Research Anchors

- YouTube Help says viewers usually see thumbnail and title first, and recommends audience targeting, rule-of-thirds composition, readable fonts, simple design, and device-aware large images.
- YouTube custom-thumbnail guidance recommends large 16:9 images, common image formats, and policy-safe thumbnails.
- TikTok Support defines a video cover as the thumbnail shown in places such as profile and search, selected before posting.
- X Media Studio allows selecting a video frame or uploading a custom thumbnail, and warns that mismatched aspect ratios can cause playback issues.
- X creative specs list PNG/JPEG thumbnails, matching aspect ratio, and platform-specific image/video aspect ratios.
- Bilibili/Chinese creator-cover guidance consistently emphasizes clear subject, high image quality, concise readable text, strong composition, and content-consistent atmosphere.

## Required Artifact

Every final-quality run must write `workflow/cover-design.json` before packaging. It must include:

- `researchSynthesis`: 3-6 bullet summary of platform thumbnail lessons used for this cover.
- `platformTargets`: standalone upload/social targets and ratios, such as YouTube 16:9, Bilibili 4:3 plus horizontal-safe 16:9, Douyin/TikTok 9:16, and X matching-video or square/feed variants.
- `videoInternalCover`: the cover frame intended to appear inside the MP4. Its width, height, and ratio must match the final video canvas.
- `viewerDecision`: what the viewer should understand or feel within one second.
- `coverPromise`: the single viewer-facing promise the cover makes.
- `curiosityGap`: the unresolved tension, question, contradiction, or surprising claim that makes the viewer want the answer.
- `hookText`: the short readable text, preferably 4-10 Chinese characters for mobile-first Chinese covers and no more than two text groups.
- `payoffText`: optional second text group that states the promised outcome; it must be shorter than the hook and cannot duplicate the video title.
- `visualSubject`: the dominant image or metaphor; it must be inspectable at small size.
- `emotionalSignal`: the visible emotion or tension, such as confusion, loss, pressure, contradiction, reveal, danger, desire, or transformation.
- `composition`: focal point, rule-of-thirds or centered poster logic, negative space, and play-button/timecode collision avoidance.
- `typography`: font role, weight, contrast, and mobile readability rule.
- `colorContrast`: dominant palette, accent color, and how the focal signal separates from the background.
- `smallPreviewTest`: the expected result at 120-180 px wide; hook and visual subject must remain legible.
- `platformVariants`: output file paths and dimensions for each platform target.
- `contentTruth`: how the cover accurately reflects the video, avoiding clickbait or a promise the video does not pay off.
- `rejectList`: concrete failures such as tiny text, generic AI shine, too many elements, misleading hook, low-res still, copied creator style, and wrong ratio.

## Design Method

Use this sequence before creating the image:

1. Extract the core viewer pain, desire, or contradiction from the script.
2. Translate the topic into a one-second click promise. Do not simply paste the video title onto a card.
3. Choose one of these thumbnail patterns:
   - **Contradiction**: wrong belief versus right mechanism, before versus after, failure versus fix.
   - **Curiosity gap**: a strong question or missing explanation the video resolves.
   - **Transformation**: low state versus high state with the mechanism visible.
   - **Evidence/reveal**: one concrete artifact, result, or hidden rule made visually inspectable.
   - **Emotional close-up/metaphor**: a face, hand, object, or symbolic scene carrying obvious feeling.
4. Build the cover with no more than 2-3 major visual elements: hook text, subject/metaphor, and one accent signal.
5. Make the hook readable at mobile grid size. Use large type, high contrast, and strong negative space.
6. Check content truth: the video must pay off the promise in the opening and body.
7. Remove platform/spec labels, workflow labels, captions, file paths, renderer names, and any production evidence from the visible cover.

## Platform Logic

| Platform | Default cover target | Design emphasis | Guardrail |
| --- | --- | --- | --- |
| YouTube long form | 16:9, large custom thumbnail | Strong story promise, simple readable text, clear subject, high contrast | Keep title/thumbnail consistent and policy-safe |
| Bilibili | 4:3 standalone cover plus optional 16:9 safe variant | Clear subject, concise Chinese text, content atmosphere, composition beauty | Do not stretch the 16:9 video cover; reflow for 4:3 and keep mobile text readable |
| Douyin/TikTok | 9:16 cover-safe frame or custom vertical cover | Mobile grid readability, search/profile context, fast topic recognition | Select/design before posting; keep key text away from UI crop zones |
| X | Match video ratio; common feed variants include 16:9, 1:1, 4:5 | High clarity in timeline, ratio match for playback, concise text | Custom thumbnail aspect ratio should match the video when used |
| Video opening frame | Match final MP4 ratio, normally 16:9 in this POC | Continuity between click promise and opening scene | Never use a platform-specific crop inside the video unless the video itself has that ratio |

## Quality Rules

- Design at least one cover before final packaging; for cross-platform delivery, create platform variants rather than stretching one canvas.
- Generate the standalone cover package separately from the video-internal cover. Standalone variants can follow platform ratios; the video-internal cover must match the MP4 canvas.
- The cover must be derived from the video's core promise, not from a random attractive frame.
- Use one primary hook, one visual subject, and one accent signal. Remove anything that does not help the click decision.
- Prefer a click-oriented hook over a descriptive title. For example, `读者不买灵感` is stronger than `小说不是灵感产品：读者情绪与商业承诺` because it creates contradiction and curiosity while staying truthful.
- The final cover should feel like a finished platform thumbnail, not a slide title card, UI card, or internal design mock.
- Test at small size by downscaling to mobile-preview width; the hook and subject must remain clear.
- The first seconds of the video should visually honor the cover promise so the click does not feel baited.
- When the user asks for the video to begin with a cover, render that cover into the first seconds of the MP4 and shift narration/subtitles accordingly. Do not treat a separate `cover/*` file as sufficient in that case.
- A beautiful cover is allowed to be restrained. Premium means hierarchy, spacing, contrast, image quality, and accurate promise.

## Hard Failures

- No cover artifact for a final-quality run.
- A cover that cannot be read at mobile preview size.
- A cover whose aspect ratio does not match the target platform or video use.
- A cover that promises a different topic, result, or emotion from the actual video.
- A cover that is only a title card, platform/spec mock, or decorative UI composition without a click reason.
- Visible platform labels, aspect-ratio labels, workflow labels, debug text, timecode evidence, or renderer artifacts in the final cover.
- Copied creator thumbnail style, unauthorized likeness, unlicensed images/fonts, or platform-policy risky imagery.
