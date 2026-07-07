# Research Sources

Primary sources used for the June 2026 workflow decision:

- `https://github.com/nexu-io/html-video` - target repository; local clone was used to test content graph, per-frame HTML, CLI/runtime, and MP4 export.
- `https://www.remotion.dev/` - Remotion describes programmatic video creation with React, MP4 rendering, automations, and coding-agent workflows.
- `https://www.remotion.dev/docs/api` - Remotion renderer APIs such as `renderMedia`, frame rendering, still rendering, and metadata utilities.
- `https://www.remotion.dev/docs/parameterized-rendering` - data/input-driven rendering guidance.
- `https://gsap.com/` - GSAP positions itself as a high-performance JavaScript animation library for CSS, SVG, canvas, WebGL, colors, strings, and objects.
- `https://gsap.com/docs/v3/Plugins/ScrollTrigger/` - ScrollTrigger supports scrub, pin, snap, and trigger-based animation useful for timeline-like reveal logic.
- `https://motion.dev/` - Motion describes high-performance web animations, independent transforms, scroll animation, native gestures, and hardware-accelerated behavior.
- `https://motion.dev/docs/react` - Motion for React supports production-grade UI motion, layout, gesture, and scroll animations.
- `https://animejs.com/` - Anime.js provides an all-in-one JavaScript animation engine with timelines, staggering, SVG tooling, springs, and scroll observer.
- `https://animejs.com/documentation/timeline/` - Anime.js timelines can add animations, timers, callbacks, labels, and synchronized timeline events.
- `https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Web_Animations_API_Concepts` - MDN explains the browser-native timing and animation model behind WAAPI.
- `https://www.w3.org/TR/web-animations-1/` - W3C Web Animations defines synchronization and timing models for web presentation changes.
- `https://tympanus.net/codrops/` - Codrops offers UI motion/tutorial inspiration; extract abstract patterns only, not copied code or creator style.
- `https://tympanus.net/codrops/hub/` - Codrops Creative Hub surfaces open-source demos and interaction concepts for motion inspiration.
- `https://rive.app/docs/editor/state-machine` - Rive state machines connect animations and define interaction-driven transitions.
- `https://lottiefiles.com/what-is-lottie` - Lottie is a JSON-based animation format for lightweight scalable animation assets.
- `https://lottiefiles.com/tools/web-player` - LottieFiles web player can embed `.lottie`/JSON assets by snippet when assets are authorized.
- `https://threejs.org/` - Three.js is the web 3D route for meaningful WebGL/depth-driven scenes.
- `https://threejs.org/examples/` - Three.js examples include animation, keyframes, skinning, render targets, and WebGL/WebGPU experiments.
- `https://github.com/galacean/effects-runtime` - Galacean Effects can load and render animation effects through `@galacean/effects`; use as a bounded visual-effects layer for particles, fireworks, 2D/3D accents, scans, and transitions, not as a replacement for the video workflow. Its README also notes Spine plugin license obligations.
- `https://www.galacean.com/effects/` - Galacean Effects editor/source route for effect JSON resources; production use still requires local asset provenance, rights record, and QC.
- `https://ffmpeg.org/ffmpeg-filters.html` - ffmpeg filtergraph, audio/video filters, and blackdetect-style local QC primitives.
- `https://zulko.github.io/moviepy/` - MoviePy as an open-source Python fallback for scripted editing.
- `https://github.com/openai/whisper` - MIT-licensed Whisper code/weights as a possible local ASR/subtitle candidate.
- `https://github.com/Netflix/vmaf` - VMAF as an advanced perceptual quality candidate when a reference video exists.
- `https://ai.google.dev/gemini-api/docs/video` - Veo/Gemini API video generation capability; useful but not default because it requires external API/account policy.
- `https://docs.dev.runwayml.com/` - Runway API video generation/editing capability; useful but not default because it requires account/credits.
- `https://developers.openai.com/api/docs/guides/video-generation` - OpenAI Sora video generation API deprecation and shutdown notice.
- `https://developers.openai.com/api/docs/models/gpt-image-2` - GPT Image 2 model page; supports text input and image input/output for image generation/editing through documented endpoints.
- `https://developers.openai.com/api/docs/guides/image-generation` - OpenAI image generation guide; GPT Image models, including `gpt-image-2`, can generate and edit images from text prompts.
- `https://developers.openai.com/api/reference/resources/images/methods/generate/` - Images API create endpoint and output format parameters for GPT image models.
- `https://github.com/YouMind-OpenLab/awesome-gpt-image-2/blob/main/README_zh.md` - community GPT Image 2 prompt collection used as a prompt-method reference for taxonomy, structured fields, dynamic slots, composition/material language, and negative constraints; do not copy community examples or protected styles.
- `https://collectui.com/` - current CollectUI page researched on 2026-06-30; presents daily UI inspiration, latest designs, designers, categories, trending, favorites, submission, compact card grids, and a curated design-audience positioning. Use as interface-pattern curation logic only.
- `https://www.pinterest.com/hmq1285/ui%E6%A0%B7%E5%BC%8F/` - current Pinterest board metadata researched on 2026-06-30; board title is `UI样式`, with 150 ideas around UI design, icon design, app/web/mobile UI, cards, dashboards, finance, and e-learning references. Use as motif/moodboard taxonomy only.
- `https://business.x.com/en/help/campaign-setup/creative-ad-specifications` - X video specs and short-form recommendations.
- `https://business.x.com/en/advertising/creative-best-practices` - X creative guidance including early movement and concise videos.
- `https://help.x.com/en/using-x/media-studio-faqs` - X Media Studio thumbnail selection/upload behavior and aspect-ratio warning.
- `https://ads.tiktok.com/help/article/creative-best-practices` - TikTok guidance on captions, text overlay density, transitions, and CTA.
- `https://support.google.com/youtube/answer/9314415` - YouTube audience-retention report guidance; use the first-30-second intro/key-moments framing as a diagnostic quality constraint for opening promise and expectation match.
- `https://www.nngroup.com/topic/animation/` - Nielsen Norman Group animation and motion UX guidance; use as a constraint that motion must guide attention, communicate state/relationship, or support comprehension rather than become decorative distraction.
- `https://support.tiktok.com/en/using-tiktok/creating-videos/editing-posting-and-deleting` - TikTok video cover definition and pre-post cover selection behavior.
- `https://support.google.com/google-ads/answer/16041697?hl=en` - YouTube Shorts ad guidance on vertical assets, brevity, and sound.
- `https://support.google.com/google-ads/answer/13547298?hl=en` - YouTube video ad specs including 1080p horizontal/vertical/square recommendations.
- `https://support.google.com/youtube/answer/12340300?hl=en` - YouTube thumbnail/title tips: audience targeting, readable text, simple composition, and device-aware thumbnails.
- `https://support.google.com/youtube/answer/72431` - YouTube custom-thumbnail size, format, ratio, policy, and Shorts limitations.
- `https://www.canva.cn/learn/bilibili-cover-design/` - Chinese/Bilibili cover design patterns: clear frame, composition, subject, atmosphere, and concise title logic.

Use platform/creator sources as quality constraints only. Do not copy specific scripts, shots, voices, thumbnails, creator personas, or brand packaging.
