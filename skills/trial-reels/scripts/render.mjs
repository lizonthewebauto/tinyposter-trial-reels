#!/usr/bin/env node
// Step 3: render every variant in out/plan.json to out/variant-N.mp4.
// Also writes caption text files, QA still frames, and out/manifest.json.
//
// Usage:
//   node scripts/render.mjs [--only 3]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  clamp,
  ensureOutDir,
  fail,
  FPS,
  OUT_DIR,
  parseArgs,
  PUBLIC_DIR,
  readJson,
  remotionBinary,
  ROOT,
  variantFrames,
  writeJson,
} from "./lib.mjs";

const MAX_BYTES = 49 * 1024 * 1024; // stay under Tinyposter's 50 MB cap
const QA_MARKS = [2, 10, 19];
const SAFE = { xMin: 84, xMax: 996, yMin: 255, yMax: 1350 };

const args = parseArgs(process.argv.slice(2));
const plan = readJson(
  path.join(OUT_DIR, "plan.json"),
  "Run analyze.mjs then plan.mjs first.",
);

const only = args.only ? Number(args.only) : null;
if (args.only && (!Number.isInteger(only) || only < 1)) {
  fail("--only needs a variant number, like --only 3");
}

if (!fs.existsSync(plan.input)) {
  fail(`The source video moved or was deleted: ${plan.input}`);
}

// Defensive clamps: a hand-edited plan cannot break the render or
// escape the text safe zone (the composition clamps geometry too).
function sanitizeVariant(raw) {
  const v = { ...raw };
  v.speed = clamp(Number(v.speed) || 1.15, 0.9, 1.5);
  v.grain = clamp(Number(v.grain ?? 0.05), 0, 1);
  v.flip = v.flip !== false;
  v.sharpen = v.sharpen === true;
  v.color = {
    brightness: clamp(Number(v.color?.brightness ?? 0), -0.3, 0.3),
    contrast: clamp(Number(v.color?.contrast ?? 1), 0.7, 1.6),
    saturation: clamp(Number(v.color?.saturation ?? 1), 0.5, 1.8),
  };
  v.segments = (v.segments ?? [])
    .map((s) => ({
      startSec: Math.max(0, Number(s.startSec) || 0),
      endSec: Math.max(0, Number(s.endSec) || 0),
      zoom: clamp(Number(s.zoom) || 1.12, 1, 1.5),
      offsetX: clamp(Number(s.offsetX) || 0, -60, 60),
    }))
    .filter((s) => s.endSec - s.startSec >= 0.2);
  if (v.segments.length === 0) {
    fail(`Variant ${v.id} has no usable segments in plan.json.`);
  }
  const outSeconds = variantFrames(v) / FPS;
  v.overlays = (v.overlays ?? []).map((o) => ({
    kind: o.kind === "popup" ? "popup" : "headline",
    text: String(o.text ?? "").slice(0, 60),
    x: o.x === undefined ? undefined : clamp(Number(o.x) || 0, 0, 1080),
    y: clamp(Number(o.y) || SAFE.yMin, SAFE.yMin, SAFE.yMax),
    startSec: clamp(Number(o.startSec) || 0, 0, outSeconds),
    endSec: clamp(Number(o.endSec) || 0, 0, outSeconds),
    sizePx: clamp(Number(o.sizePx) || 48, 24, 90),
    bg: typeof o.bg === "string" ? o.bg : "rgba(17,17,17,1)",
    color: typeof o.color === "string" ? o.color : undefined,
  }));
  return v;
}

const variants = plan.variants.map(sanitizeVariant);
const picked = only ? variants.filter((v) => v.id === only) : variants;
if (picked.length === 0) {
  fail(`No variant with id ${only} in the plan.`);
}

// Stage the source into public/ so the composition can use staticFile().
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
const srcExt = path.extname(plan.input).toLowerCase();
const stagedName = `source${srcExt}`;
const stagedPath = path.join(PUBLIC_DIR, stagedName);
const srcStat = fs.statSync(plan.input);
const stagedStat = fs.existsSync(stagedPath) ? fs.statSync(stagedPath) : null;
if (
  !stagedStat ||
  stagedStat.size !== srcStat.size ||
  stagedStat.mtimeMs < srcStat.mtimeMs
) {
  console.log("Copying the source video into the project...");
  fs.copyFileSync(plan.input, stagedPath);
}

console.log(
  "Getting the renderer ready. The very first run may download a small browser. That is normal.",
);
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "remotion", "index.ts"),
  onProgress: () => {},
});

ensureOutDir();
fs.mkdirSync(path.join(OUT_DIR, "captions"), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, "qa"), { recursive: true });

async function renderVariant(v, encoding) {
  const inputProps = {
    src: stagedName,
    flip: v.flip,
    speed: v.speed,
    segments: v.segments,
    color: v.color,
    overlays: v.overlays,
    grain: v.grain,
    sharpen: v.sharpen,
  };
  const composition = await selectComposition({
    serveUrl,
    id: "TrialReel",
    inputProps,
  });
  const outputLocation = path.join(OUT_DIR, `variant-${v.id}.mp4`);
  let lastLogged = -10;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    pixelFormat: "yuv420p",
    x264Preset: "veryfast",
    ...encoding,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastLogged + 10) {
        lastLogged = pct;
        process.stdout.write(`\rVariant ${v.id}: ${pct}%   `);
      }
    },
  });
  process.stdout.write(`\rVariant ${v.id}: 100%  \n`);
  return outputLocation;
}

const manifestVariants = [];
for (const v of picked) {
  const frames = variantFrames(v);
  const durationSec = frames / FPS;
  console.log(
    `\nRendering variant ${v.id} of ${plan.variants.length} (${durationSec.toFixed(1)}s, ${frames} frames)...`,
  );

  let file = await renderVariant(v, { crf: 23 });
  let sizeBytes = fs.statSync(file).size;
  let pass = "crf23";
  for (const bitrate of ["8M", "6M"]) {
    if (sizeBytes <= MAX_BYTES) {
      break;
    }
    console.log(
      `Variant ${v.id} is ${(sizeBytes / 1e6).toFixed(1)} MB, over the 50 MB posting cap. Re-rendering smaller...`,
    );
    file = await renderVariant(v, { videoBitrate: bitrate });
    sizeBytes = fs.statSync(file).size;
    pass = `bitrate-${bitrate}`;
  }
  if (sizeBytes > MAX_BYTES) {
    fail(
      `Variant ${v.id} is still over 50 MB. Lower --target when planning (shorter reels), then re-render.`,
    );
  }

  const captionFile = path.join(OUT_DIR, "captions", `variant-${v.id}.txt`);
  fs.writeFileSync(captionFile, `${v.caption ?? ""}\n`);

  const qaFrames = [];
  for (const mark of QA_MARKS) {
    if (mark > durationSec - 0.2) {
      continue;
    }
    const qaFile = path.join(OUT_DIR, "qa", `v${v.id}-${mark}s.jpg`);
    const res = remotionBinary("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(mark),
      "-i",
      file,
      "-frames:v",
      "1",
      "-y",
      qaFile,
    ]);
    if (res.status === 0) {
      qaFrames.push(qaFile);
    }
  }

  manifestVariants.push({
    id: v.id,
    slug: v.slug,
    file,
    sizeBytes,
    encodePass: pass,
    durationSec: Number(durationSec.toFixed(2)),
    captionFile,
    title: v.title ?? "",
    speed: v.speed,
    flip: v.flip,
    color: v.color,
    segments: v.segments,
    overlays: v.overlays,
    qaFrames,
  });
}

// Merge with an existing manifest so --only re-renders update one entry.
const manifestPath = path.join(OUT_DIR, "manifest.json");
let existing = [];
if (only && fs.existsSync(manifestPath)) {
  try {
    existing = JSON.parse(fs.readFileSync(manifestPath, "utf8")).variants ?? [];
  } catch {
    existing = [];
  }
}
const merged = [
  ...existing.filter((e) => !manifestVariants.some((m) => m.id === e.id)),
  ...manifestVariants,
].sort((a, b) => a.id - b.id);

writeJson(manifestPath, {
  schema: "tinyposter.trialReels.manifest.v1",
  createdAt: new Date().toISOString(),
  renderer: "remotion",
  source: plan.input,
  platforms: plan.platforms,
  safeZone: SAFE,
  variants: merged,
});

console.log(`\nDone. Wrote ${manifestPath}`);
console.log("\nWhat you got:");
for (const m of merged) {
  console.log(
    `  variant ${m.id}: ${path.basename(m.file)} (${(m.sizeBytes / 1e6).toFixed(1)} MB, ${m.durationSec}s)`,
  );
}
console.log(
  "\nNext: look at the pictures in out/qa to check the text placement.",
);
console.log(
  "Then post with the Tinyposter tools, or: node scripts/post.mjs --check",
);
