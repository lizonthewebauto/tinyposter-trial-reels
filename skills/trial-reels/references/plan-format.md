# plan.json format

`scripts/plan.mjs` writes `out/plan.json`. The agent rewrites ONLY the
text fields, then `scripts/render.mjs` renders it.

## The one rule

Rewrite text. Leave numbers alone.

- Rewrite: `overlays[].text`, `caption`, `title`
- Leave alone: `segments`, `speed`, `color`, `grain`, times, positions

The render script clamps every number again anyway, so a bad number
cannot break the render or push text off the safe zone. But changed
numbers can make variants look samey, which defeats the whole point.

## Time units (important)

- `segments[].startSec` and `segments[].endSec` are SOURCE video seconds
  (where to cut from the original file).
- `overlays[].startSec` and `overlays[].endSec` are OUTPUT video seconds
  (when text shows in the finished reel, after the speed-up).

## Top level

```json
{
  "schema": "tinyposter.trialReels.plan.v1",
  "createdAt": "2026-07-09T18:40:00.000Z",
  "input": "/absolute/path/to/source.mp4",
  "analysisMethod": "silence-detect",
  "targetSeconds": 27,
  "platforms": ["INSTAGRAM"],
  "variants": [ ... ]
}
```

`analysisMethod` is `silence-detect` (cuts follow the talking) or
`even-cuts` (no usable audio, even slices).

## One variant

```json
{
  "id": 1,
  "slug": "v1-stop-scrolling",
  "flip": true,
  "speed": 1.16,
  "segments": [
    { "startSec": 1.65, "endSec": 5.95, "zoom": 1.18, "offsetX": 29 }
  ],
  "color": { "brightness": 0.01, "contrast": 1.11, "saturation": 1.02 },
  "overlays": [
    {
      "kind": "headline",
      "text": "STOP SCROLLING",
      "y": 255,
      "startSec": 0,
      "endSec": 3.2,
      "sizePx": 64,
      "bg": "rgba(17,17,17,1)"
    },
    {
      "kind": "popup",
      "text": "SAVE THIS",
      "x": 112,
      "y": 1030,
      "startSec": 3.2,
      "endSec": 6.4,
      "sizePx": 38,
      "bg": "rgba(240,106,61,0.98)"
    }
  ],
  "grain": 0.05,
  "sharpen": false,
  "caption": "Hook line.\n\nBody line.\n\nCall to action.",
  "title": "STOP SCROLLING"
}
```

Field notes:

- `flip: true` mirrors the footage left-right. It is the cheapest way to
  make a variant look different, BUT it also mirrors any text inside the
  video. If the source has readable on-screen text, baked-in captions, or
  a screen recording, set `"flip": false` on EVERY variant or the text
  reads backwards. Pure talking-head videos with no text: keep it on.
- `speed`: 1.1 to 1.25 works best. Audio gets a little higher pitched,
  which is fine for trial reels.
- `segments` play in the order listed. Reordering rows reorders the reel.
- `zoom` 1.0 to 1.5, `offsetX` -60 to 60 (side-to-side pan).
- `overlays[].kind`: `headline` is a full-width bar (x is ignored),
  `popup` is a small tilted box (x sets its left edge).
- Safe zone: text always lands between y 255 and y 1350, and x 84 to
  996. The renderer clamps this. Platform buttons live outside it.
- `sizePx`: headlines 54 to 68, popups 34 to 42.
- `bg` and `color` are CSS colors.
- `grain`: leave at 0.05. It makes every render pixel-unique.
- `caption` is the post text for that variant. Make all five different:
  different first line, different angle, same call to action.
- `title` is required when posting to TikTok or YouTube. Keep it under
  90 characters.

## Writing the text (for the agent)

- Overlay text: 2 to 5 words, all caps, plain words. It must be readable
  in one glance on a phone.
- First overlay is the hook. Last overlay is the call to action.
- Five captions, five different hooks. Do not reuse the first line.
- No em-dashes. Short sentences.
