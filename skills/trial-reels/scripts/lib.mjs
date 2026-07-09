// Shared helpers for the trial-reels scripts.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const OUT_DIR = path.join(ROOT, "out");
export const PUBLIC_DIR = path.join(ROOT, "public");

export const FPS = 30;
export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"];

const REMOTION_CLI = path.join(
  ROOT,
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

export function fail(message) {
  console.error(`\nProblem: ${message}\n`);
  process.exit(1);
}

export function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export function readJson(file, hint) {
  if (!fs.existsSync(file)) {
    fail(`${path.basename(file)} not found. ${hint}`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fail(`${path.basename(file)} is not valid JSON. ${hint}`);
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Run Remotion's bundled ffmpeg/ffprobe without a shell so paths with
 * spaces and Windows both work. subcommand is "ffmpeg" or "ffprobe".
 */
export function remotionBinary(subcommand, args) {
  if (!fs.existsSync(REMOTION_CLI)) {
    fail(
      `Remotion is not installed yet. Run "npm install" inside ${ROOT} first.`,
    );
  }
  return spawnSync(process.execPath, [REMOTION_CLI, subcommand, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function ffprobeJson(input) {
  const res = remotionBinary("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-show_streams",
    "-of",
    "json",
    input,
  ]);
  if (res.status !== 0) {
    fail(
      `Could not read the video. Is this a real video file?\n${(res.stderr || "").trim()}`,
    );
  }
  try {
    return JSON.parse(res.stdout);
  } catch {
    return fail("Could not understand the video info output.");
  }
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function segmentFrames(seg, speed) {
  return Math.max(
    1,
    Math.round(((seg.endSec - seg.startSec) / speed) * FPS),
  );
}

export function variantFrames(variant) {
  return variant.segments.reduce(
    (sum, seg) => sum + segmentFrames(seg, variant.speed),
    0,
  );
}

export function variantSeconds(variant) {
  return variantFrames(variant) / FPS;
}

/** Tiny flag parser: --name value, --name=value, bare --flag, positionals. */
export function parseArgs(argv, booleanFlags = []) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) {
      args._.push(raw);
      continue;
    }
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      args[raw.slice(2, eq)] = raw.slice(eq + 1);
      continue;
    }
    const name = raw.slice(2);
    if (booleanFlags.includes(name)) {
      args[name] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[name] = next;
      i += 1;
    } else {
      args[name] = true;
    }
  }
  return args;
}

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "variant"
  );
}
