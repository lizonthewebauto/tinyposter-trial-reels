#!/usr/bin/env node
// Step 4 (fallback path): post or schedule one rendered variant through
// the Tinyposter REST API using a tp_ token. If the Tinyposter MCP
// connector is available in your agent, prefer that instead.
//
// Usage:
//   node scripts/post.mjs --check
//   node scripts/post.mjs --file out/variant-1.mp4 \
//     --caption-file out/captions/variant-1.txt \
//     --platforms INSTAGRAM [--trial] [--reel] [--title "..."] \
//     [--now | --at 2026-07-10T14:30:00-04:00]
//
//   --trial : post it as an Instagram TRIAL reel (shown only to non-followers
//             as a test, kept off your main feed). This is the whole point of
//             trial reels, so it is the default for Instagram here.
//   --reel  : post as a normal reel (goes to your followers' feed).
//
// Auth: set TINYPOSTER_TOKEN (get one at https://tinyposter.app/dashboard/tokens)
//
// Exit codes: 0 ok, 1 problem, 2 no token, 3 file too big, 4 missing title,
//   42 scheduling needs a paid plan, 43 platform not connected.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib.mjs";

const MAX_BYTES = 50 * 1024 * 1024;
const TITLE_REQUIRED = ["TIKTOK", "YOUTUBE"];

const args = parseArgs(process.argv.slice(2), ["check", "now", "trial", "reel"]);
const base = (
  args.base ||
  process.env.TINYPOSTER_BASE_URL ||
  "https://tinyposter.app"
).replace(/\/$/, "");
const token = args.token || process.env.TINYPOSTER_TOKEN;

function exit(code, message) {
  console.error(`\n${message}\n`);
  process.exit(code);
}

if (!token) {
  exit(
    2,
    "No Tinyposter token found. Get one at https://tinyposter.app/dashboard/tokens\nThen run: export TINYPOSTER_TOKEN=tp_your_token (Windows: set TINYPOSTER_TOKEN=tp_your_token)",
  );
}

async function api(method, apiPath, { body, headers, form } = {}) {
  const url = `${base}/api/v1${apiPath}`;
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(form ? {} : body ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
  };
  if (form) {
    init.body = form;
  } else if (body) {
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    exit(1, `Could not reach Tinyposter (${url}). Check your internet.\n${e.message}`);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

function apiErrorInfo(data) {
  const code = data?.error?.code ?? "unknown";
  const message = data?.error?.message ?? "Unknown error.";
  return { code, message };
}

if (args.check) {
  const [{ res: ar, data: accounts }, { res: ur, data: usage }] =
    await Promise.all([api("GET", "/accounts"), api("GET", "/usage")]);
  if (!ar.ok) {
    const { message } = apiErrorInfo(accounts);
    exit(1, `Could not load your accounts: ${message}\nIs the token right?`);
  }
  // GET /api/v1/accounts returns { brand_id, data: [...] }.
  const list = accounts?.data ?? accounts?.accounts ?? [];
  console.log("Connected accounts:");
  if (!Array.isArray(list) || list.length === 0) {
    console.log(
      "  none yet. Connect one at https://tinyposter.app/dashboard (Accounts).",
    );
  } else {
    for (const a of list) {
      console.log(
        `  ${a.platform}: ${a.username ?? a.display_name ?? ""} (${a.status})`,
      );
    }
  }
  if (ur.ok && usage) {
    const u = usage.usage ?? usage;
    const limit = u.unlimited ? "unlimited" : u.limit;
    console.log(
      `\nPlan: ${u.plan}. Posts used this month: ${u.used} of ${limit}.`,
    );
  }
  process.exit(0);
}

const file = args.file;
if (!file) {
  exit(
    1,
    'Missing --file. Example:\n  node scripts/post.mjs --file out/variant-1.mp4 --caption-file out/captions/variant-1.txt --platforms INSTAGRAM --now',
  );
}
const filePath = path.resolve(file);
if (!fs.existsSync(filePath)) {
  exit(1, `File not found: ${filePath}`);
}
const sizeBytes = fs.statSync(filePath).size;
if (sizeBytes > MAX_BYTES) {
  exit(
    3,
    `This video is ${(sizeBytes / 1e6).toFixed(1)} MB. The cap is 50 MB. Re-render with a lower --target (shorter reel) and try again.`,
  );
}

let caption = args.caption ?? "";
if (args["caption-file"]) {
  const capPath = path.resolve(args["caption-file"]);
  if (!fs.existsSync(capPath)) {
    exit(1, `Caption file not found: ${capPath}`);
  }
  caption = fs.readFileSync(capPath, "utf8").trim();
}
if (!caption) {
  exit(1, "No caption. Pass --caption-file out/captions/variant-1.txt or --caption \"...\"");
}

const platforms = String(args.platforms ?? "INSTAGRAM")
  .split(",")
  .map((p) => p.trim().toUpperCase())
  .filter(Boolean);

const title = args.title ? String(args.title) : undefined;
if (!title && platforms.some((p) => TITLE_REQUIRED.includes(p))) {
  exit(
    4,
    "TikTok and YouTube need a --title. Add one, like: --title \"My best tip\"",
  );
}

let scheduledAt;
if (args.at) {
  const when = new Date(String(args.at));
  if (Number.isNaN(when.getTime())) {
    exit(1, `--at is not a valid time: ${args.at}\nUse ISO format with timezone, like 2026-07-10T14:30:00-04:00`);
  }
  if (when.getTime() < Date.now() + 60_000) {
    exit(1, "--at must be at least 1 minute in the future.");
  }
  scheduledAt = when.toISOString();
} else if (!args.now) {
  exit(1, "Say when: --now to post right away, or --at <ISO time> to schedule.");
}

// 1. Upload the video.
console.log(`Uploading ${path.basename(filePath)} (${(sizeBytes / 1e6).toFixed(1)} MB)...`);
const form = new FormData();
form.append(
  "file",
  new Blob([fs.readFileSync(filePath)], { type: "video/mp4" }),
  path.basename(filePath),
);
const { res: upRes, data: upData } = await api("POST", "/uploads", {
  form,
});
if (!upRes.ok) {
  const { code, message } = apiErrorInfo(upData);
  exit(1, `Upload failed (${code}): ${message}`);
}
const uploadId = upData?.upload?.id;
if (!uploadId) {
  exit(1, "Upload worked but no id came back. Try again.");
}

// 2. Create the post. On Instagram, post as a TRIAL reel by default (that is
// the whole point of this skill): shown to non-followers as a test, kept off
// the main feed. Pass --reel to post a normal reel to followers instead.
const asNormalReel = args.reel && !args.trial;
const options =
  platforms.includes("INSTAGRAM")
    ? { INSTAGRAM: { type: "REEL", ...(asNormalReel ? {} : { trial: true }) } }
    : undefined;
console.log(
  scheduledAt
    ? `Scheduling ${options ? (asNormalReel ? "reel" : "trial reel") : "post"} for ${scheduledAt}...`
    : `Posting ${options ? (asNormalReel ? "reel" : "trial reel") : "post"} now...`,
);
const { res: postRes, data: postData } = await api("POST", "/posts", {
  body: {
    text: caption,
    platforms,
    media_upload_ids: [uploadId],
    ...(title ? { title } : {}),
    ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    ...(options ? { options } : {}),
  },
  headers: { "Idempotency-Key": randomUUID() },
});

if (!postRes.ok) {
  const { code, message } = apiErrorInfo(postData);
  if (code === "upgrade_required" || code === "quota_exceeded") {
    exit(
      42,
      `${message}\nUpgrade here: https://tinyposter.app/pricing (plans start at 9 dollars a month).\nYour rendered reels stay saved in the out folder either way.`,
    );
  }
  if (code === "platform_not_connected") {
    exit(
      43,
      `${message}\nConnect the account at https://tinyposter.app/dashboard first, then try again.`,
    );
  }
  exit(1, `Post failed (${code}): ${message}`);
}

const post = postData?.post ?? {};
console.log("\nDone.");
console.log(`  Post id: ${post.id ?? "?"}`);
console.log(`  Status: ${post.status ?? "?"}`);
if (post.scheduled_at) {
  console.log(`  Scheduled for: ${post.scheduled_at}`);
}
console.log(`  Platforms: ${(post.platforms ?? platforms).join(", ")}`);
