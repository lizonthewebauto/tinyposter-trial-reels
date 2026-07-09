#!/usr/bin/env node
// Step 1: look at the source video. Finds duration, size, and where the
// talking is (via silence detection), then writes out/analysis.json.
//
// Usage:
//   node scripts/analyze.mjs <video> [--silence-noise -35dB]
//     [--silence-duration 0.22] [--no-silence-detect]
import fs from "node:fs";
import path from "node:path";
import {
  ensureOutDir,
  fail,
  ffprobeJson,
  OUT_DIR,
  parseArgs,
  remotionBinary,
  VIDEO_EXTENSIONS,
  writeJson,
} from "./lib.mjs";

const MIN_SPEECH_SECONDS = 0.55;
const MIN_TOTAL_SECONDS = 6;
const EVEN_CUT_COUNT = 6;
const EVEN_CUT_INSET = 0.3;

const args = parseArgs(process.argv.slice(2), ["no-silence-detect"]);
const inputArg = args._[0];
if (!inputArg) {
  fail(
    'No video given. Run: node scripts/analyze.mjs "/path/to/video.mp4"',
  );
}

const input = path.resolve(inputArg);
if (!fs.existsSync(input)) {
  fail(`File not found: ${input}`);
}
const ext = path.extname(input).toLowerCase();
if (!VIDEO_EXTENSIONS.includes(ext)) {
  fail(
    `This file type is not supported: ${ext || "(none)"}. Use mp4, mov, or webm.`,
  );
}

const probe = ffprobeJson(input);
const durationSec = Number(probe.format?.duration ?? 0);
if (!Number.isFinite(durationSec) || durationSec < MIN_TOTAL_SECONDS) {
  fail(
    `The video is only ${durationSec.toFixed(1)} seconds long. It needs at least ${MIN_TOTAL_SECONDS} seconds.`,
  );
}

const streams = probe.streams ?? [];
const videoStream = streams.find((s) => s.codec_type === "video");
const audioStream = streams.find((s) => s.codec_type === "audio");
if (!videoStream) {
  fail("No video track found in this file.");
}

const noise = args["silence-noise"] ?? "-35dB";
const silenceDuration = String(args["silence-duration"] ?? "0.22");

let silences = [];
let method = "silence-detect";
if (args["no-silence-detect"] || !audioStream) {
  method = "even-cuts";
} else {
  // The bundled ffmpeg has no null video encoder, so -vn is required.
  const res = remotionBinary("ffmpeg", [
    "-hide_banner",
    "-vn",
    "-i",
    input,
    "-af",
    `silencedetect=noise=${noise}:d=${silenceDuration}`,
    "-f",
    "null",
    "-",
  ]);
  const text = `${res.stderr ?? ""}\n${res.stdout ?? ""}`;
  let start = null;
  for (const line of text.split("\n")) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      start = Number(startMatch[1]);
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && start !== null) {
      silences.push([start, Number(endMatch[1])]);
      start = null;
    }
  }
  if (start !== null) {
    silences.push([start, durationSec]);
  }
}

// Invert silences into speech segments.
let speech = [];
if (method === "silence-detect") {
  let cursor = 0;
  for (const [s, e] of silences) {
    if (s - cursor >= MIN_SPEECH_SECONDS) {
      speech.push([cursor, s]);
    }
    cursor = Math.max(cursor, e);
  }
  if (durationSec - cursor >= MIN_SPEECH_SECONDS) {
    speech.push([cursor, durationSec]);
  }
  if (speech.length === 0) {
    method = "even-cuts";
  }
}

if (method === "even-cuts") {
  speech = [];
  const chunk = durationSec / EVEN_CUT_COUNT;
  for (let i = 0; i < EVEN_CUT_COUNT; i += 1) {
    const s = i * chunk + (i === 0 ? 0 : EVEN_CUT_INSET);
    const e = (i + 1) * chunk - (i === EVEN_CUT_COUNT - 1 ? 0 : EVEN_CUT_INSET);
    if (e - s >= MIN_SPEECH_SECONDS) {
      speech.push([Number(s.toFixed(3)), Number(e.toFixed(3))]);
    }
  }
}

ensureOutDir();
const analysis = {
  schema: "tinyposter.trialReels.analysis.v1",
  input,
  durationSec: Number(durationSec.toFixed(3)),
  width: videoStream.width ?? null,
  height: videoStream.height ?? null,
  hasAudio: Boolean(audioStream),
  method,
  silenceDetect:
    method === "silence-detect" ? { noise, duration: silenceDuration } : null,
  silences: silences.map(([s, e]) => [
    Number(s.toFixed(3)),
    Number(e.toFixed(3)),
  ]),
  speech: speech.map(([s, e]) => [Number(s.toFixed(3)), Number(e.toFixed(3))]),
};
const outFile = path.join(OUT_DIR, "analysis.json");
writeJson(outFile, analysis);

const speechTotal = speech.reduce((sum, [s, e]) => sum + (e - s), 0);
console.log(`Video: ${path.basename(input)}`);
console.log(
  `Length: ${durationSec.toFixed(1)}s, size ${videoStream.width}x${videoStream.height}, audio: ${audioStream ? "yes" : "no"}`,
);
if (method === "even-cuts") {
  console.log(
    "No talking found in the audio (or silence detection was off), so the video was cut into even pieces instead.",
  );
} else {
  console.log(
    `Found ${speech.length} talking parts (${speechTotal.toFixed(1)}s of speech).`,
  );
}
console.log(`Wrote ${outFile}`);
console.log('Next: node scripts/plan.mjs --topic "what the reel is about"');
