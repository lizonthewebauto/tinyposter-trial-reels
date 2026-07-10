#!/usr/bin/env node
// Step 2: build the 5-variant plan from out/analysis.json.
// The numbers (cuts, zoom, speed, colors) are set here on purpose.
// People and agents should only rewrite the TEXT fields in out/plan.json:
// overlays[].text, caption, title. See references/plan-format.md.
//
// Usage:
//   node scripts/plan.mjs [--topic "..."] [--cta "..."] [--count 5]
//     [--target 27] [--platforms INSTAGRAM,TIKTOK]
import path from "node:path";
import {
  clamp,
  ensureOutDir,
  fail,
  OUT_DIR,
  parseArgs,
  readJson,
  slugify,
  writeJson,
} from "./lib.mjs";

const KNOWN_PLATFORMS = [
  "TWITTER",
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TIKTOK",
  "YOUTUBE",
  "PINTEREST",
  "BLUESKY",
  "THREADS",
  "REDDIT",
  "MASTODON",
];

const SPEEDS = [1.16, 1.12, 1.2, 1.15, 1.24];
const BOX_COLORS = [
  "rgba(17,17,17,1)",
  "rgba(36,89,83,0.98)",
  "rgba(240,106,61,0.98)",
  "rgba(43,122,120,0.98)",
  "rgba(142,77,119,0.98)",
];

// Placeholder words. The agent rewrites these before rendering.
const OVERLAY_SETS = [
  ["STOP SCROLLING", "WATCH TO THE END", "SAVE THIS"],
  ["NEW WAY TO DO THIS", "NO ONE SHOWS THIS", "TRY IT TODAY"],
  ["THIS CHANGES IT", "SAME IDEA NEW LOOK", "KEEP WATCHING"],
  ["START AT THE END", "HERE IS THE TRICK", "DO NOT SKIP"],
  ["THE FAST VERSION", "ALL IN 30 SECONDS", "SAVE FOR LATER"],
];

const HOOK_LINES = [
  "Stop scrolling. This one is short.",
  "Nobody shows this part.",
  "Same idea, new angle.",
  "I flipped this one on purpose.",
  "The fast version, no filler.",
];

// --no-flip: keep the footage un-mirrored. Use it when the video has
// readable on-screen text, baked-in captions, or a screen recording.
const args = parseArgs(process.argv.slice(2), ["no-flip"]);
const analysis = readJson(
  path.join(OUT_DIR, "analysis.json"),
  'Run: node scripts/analyze.mjs "/path/to/video.mp4" first.',
);

const count = clamp(Number(args.count ?? 5) || 5, 1, 8);
let target = Number(args.target ?? 27) || 27;
if (target > 60) {
  console.warn("Target above 60s is not allowed. Using 60.");
  target = 60;
} else if (target > 40) {
  console.warn(
    "Heads up: reels over 40s test worse. You asked for it, so keeping it.",
  );
}
target = Math.min(target, analysis.durationSec);

const topic = String(args.topic ?? "").trim();
const cta = String(args.cta ?? "FOLLOW FOR MORE").trim().toUpperCase();

const platforms = String(args.platforms ?? "INSTAGRAM")
  .split(",")
  .map((p) => p.trim().toUpperCase())
  .filter(Boolean);
for (const p of platforms) {
  if (!KNOWN_PLATFORMS.includes(p)) {
    fail(`Unknown platform "${p}". Choose from: ${KNOWN_PLATFORMS.join(", ")}`);
  }
}
if (platforms.includes("PINTEREST")) {
  fail("Pinterest only takes images, not videos. Remove it from --platforms.");
}

const pool = analysis.speech;
if (!Array.isArray(pool) || pool.length === 0) {
  fail("analysis.json has no usable segments. Re-run analyze.");
}

function buildSegments(variantIndex, speed) {
  const i = variantIndex; // 1-based
  const k = (i - 1) % pool.length;
  let rotated = pool.slice(k).concat(pool.slice(0, k));
  if (i % 4 === 0) {
    rotated = [...rotated].reverse();
  }
  // With a big pool, skip every other entry on even variants so each
  // variant uses visibly different footage. Only do it when the skipped
  // pool still holds enough footage to reach the target length.
  let step = pool.length >= 8 && i % 2 === 0 ? 2 : 1;
  if (step === 2) {
    let stepped = 0;
    for (let idx = 0; idx < rotated.length; idx += 2) {
      stepped += (rotated[idx][1] - rotated[idx][0]) / speed;
    }
    if (stepped < target * 0.95) {
      step = 1;
    }
  }

  const segments = [];
  let outSeconds = 0;
  for (let idx = 0; idx < rotated.length; idx += step) {
    const [start, end] = rotated[idx];
    const remaining = target - outSeconds;
    if (remaining < 0.5) {
      break;
    }
    const sourceLen = end - start;
    const takeSourceLen = Math.min(sourceLen, remaining * speed);
    if (takeSourceLen < 0.4) {
      continue;
    }
    const segIndex = segments.length;
    segments.push({
      startSec: Number(start.toFixed(3)),
      endSec: Number((start + takeSourceLen).toFixed(3)),
      zoom: Number((1.12 + ((i + segIndex) % 4) * 0.06).toFixed(2)),
      offsetX: (segIndex % 2 === 0 ? 1 : -1) * (24 + i * 5),
    });
    outSeconds += takeSourceLen / speed;
  }
  return { segments, outSeconds };
}

function buildOverlays(variantIndex, outSeconds, headlineTexts) {
  const i = variantIndex;
  const L = outSeconds;
  const color = (offset) => BOX_COLORS[(i - 1 + offset) % BOX_COLORS.length];
  const [hook, popup1, popup2] = headlineTexts;
  return [
    {
      kind: "headline",
      text: hook,
      y: 255,
      startSec: 0,
      endSec: Number((0.16 * L).toFixed(2)),
      sizePx: 64,
      bg: color(0),
    },
    {
      kind: "popup",
      text: popup1,
      x: 112 + (i % 3) * 40,
      y: 1030,
      startSec: Number((0.16 * L).toFixed(2)),
      endSec: Number((0.32 * L).toFixed(2)),
      sizePx: 38,
      bg: color(1),
    },
    {
      kind: "popup",
      text: popup2,
      x: 450 - (i % 3) * 40,
      y: 1160,
      startSec: Number((0.34 * L).toFixed(2)),
      endSec: Number((0.52 * L).toFixed(2)),
      sizePx: 38,
      bg: color(2),
    },
    {
      kind: "headline",
      text: cta,
      y: 1280,
      startSec: Number((0.6 * L).toFixed(2)),
      endSec: Number((0.97 * L).toFixed(2)),
      sizePx: 54,
      bg: color(3),
    },
  ];
}

function buildCaption(variantIndex) {
  const i = variantIndex;
  const hook = HOOK_LINES[(i - 1) % HOOK_LINES.length];
  const body = topic
    ? `This one is about ${topic}.`
    : "One video, five looks. This is a test version.";
  const ctaLine = `${cta.charAt(0)}${cta.slice(1).toLowerCase()}.`;
  return `${hook}\n\n${body}\n\n${ctaLine}`;
}

const variants = [];
for (let i = 1; i <= count; i += 1) {
  const speed = SPEEDS[(i - 1) % SPEEDS.length];
  const { segments, outSeconds } = buildSegments(i, speed);
  if (segments.length === 0 || outSeconds < 3) {
    fail(
      `Variant ${i} would be under 3 seconds. The video may be too short or too quiet. Try --target lower, or re-run analyze with --no-silence-detect.`,
    );
  }
  const overlayTexts = [...OVERLAY_SETS[(i - 1) % OVERLAY_SETS.length]];
  if (topic && i === 1) {
    overlayTexts[0] = topic.toUpperCase().slice(0, 28);
  }
  const overlays = buildOverlays(i, outSeconds, overlayTexts);
  const caption = buildCaption(i);
  variants.push({
    id: i,
    slug: `v${i}-${slugify(overlayTexts[0])}`,
    flip: !args["no-flip"],
    speed,
    segments,
    color: {
      brightness: Number((0.01 * ((i - 1) % 4)).toFixed(3)),
      contrast: Number((1.08 + ((i - 1) % 5) * 0.03).toFixed(3)),
      saturation: Number((0.96 + ((i - 1) % 4) * 0.06).toFixed(3)),
    },
    overlays,
    grain: 0.05,
    sharpen: false,
    caption,
    title: overlayTexts[0].slice(0, 90),
  });
}

ensureOutDir();
const plan = {
  schema: "tinyposter.trialReels.plan.v1",
  createdAt: new Date().toISOString(),
  input: analysis.input,
  analysisMethod: analysis.method,
  targetSeconds: target,
  platforms,
  variants,
};
const outFile = path.join(OUT_DIR, "plan.json");
writeJson(outFile, plan);

console.log(`Wrote ${outFile}`);
console.log(`Variants: ${variants.length}, target ${target}s each.`);
for (const v of variants) {
  const secs = v.segments
    .reduce((sum, s) => sum + (s.endSec - s.startSec) / v.speed, 0)
    .toFixed(1);
  console.log(
    `  ${v.id}. ${v.slug} - speed ${v.speed}x, ${v.segments.length} cuts, ~${secs}s`,
  );
}
console.log(
  "\nNow rewrite the TEXT in out/plan.json: every overlays[].text, caption, and title.",
);
console.log(
  "Keep all numbers as they are. Then run: node scripts/render.mjs",
);
