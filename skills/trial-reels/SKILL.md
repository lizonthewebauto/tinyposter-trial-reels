---
name: trial-reels
description: Turn one video into 5 different-looking trial reels and post them with Tinyposter. Use when the user wants trial reels, reel variants, A/B test reels, or to test one video five ways on Instagram, TikTok, or YouTube Shorts.
---

# Trial Reels

Take one short video. Render 5 versions that look different (flipped,
re-cut, re-timed, new on-screen text, new captions). Post the first one
through Tinyposter and schedule the rest. The user sees which hook wins.

The user is likely not technical. Everything you say to them must be
short, plain, and calm. All commands below run from this skill folder.

## Rules

- Never stall waiting for an answer. Ask at most two questions total
  (steps 1 and 6). If the user does not answer, use the defaults.
- Defaults: 5 variants, 27 seconds each, Instagram only, topic taken
  from the file name.
- User-facing text: short sentences, no jargon, no em-dashes.
- Give file paths as absolute paths when you show them.
- Renders take minutes. Warn before, report progress during.
- Never retry a payment-gated call (402). Say it once, move on.
- If a step fails, check `references/troubleshooting.md` first.

## Steps

### 1. Get the video

Ask the user to share the video: drag the file into the chat, or paste
its path. Accept mp4, mov, or webm. At the same time ask one combined
question: "What is the reel about, and where should it post? If you
just want Instagram, say nothing."

### 2. Check the computer

Run `node -v`. Need version 20 or newer. If missing or older, tell the
user: "You need Node.js first. Get it at https://nodejs.org, click the
LTS button, install it, then come back." Wait for them, then re-check.

### 3. Install once

If `node_modules` is missing in this folder, run `npm install` here.
Tell the user: "First time setup takes a minute or two." Note for
later: the very first render also downloads a small browser by itself.
That is normal.

### 4. Look at the video

Run:

```bash
node scripts/analyze.mjs "/path/to/video.mp4"
```

Read `out/analysis.json`. If `method` is `even-cuts`, tell the user:
"I could not find talking in the audio, so I will cut it evenly
instead." Then continue.

### 5. Make the plan, then rewrite the words

Run:

```bash
node scripts/plan.mjs --topic "what the reel is about" --cta "FOLLOW FOR MORE"
```

Add `--platforms INSTAGRAM,TIKTOK` if the user asked for more than
Instagram. Add `--target 20` style flags only if the user asked for a
different length.

Then open `out/plan.json` and rewrite the TEXT ONLY, guided by
`references/plan-format.md`:

- Every `overlays[].text`: 2 to 5 words, all caps, punchy, tied to the
  user's topic. First overlay is the hook, last is the call to action.
- Every `caption`: five different captions. Different first line,
  different angle, same call to action.
- Every `title`: short, needed for TikTok and YouTube.

Do not change any numbers.

### 6. Confirm the words

Show the user one short list: each variant's hook line and caption
first line. Ask once: "Want me to change any words before I make the
reels?" If they say go, or say nothing, continue.

### 7. Render

Run:

```bash
node scripts/render.mjs
```

Tell the user first: "Making 5 reels now. This takes about 5 to 15
minutes." Report each variant as it finishes. The script keeps every
file under the 50 MB posting cap by itself.

### 8. Check the frames

Look at the pictures in `out/qa/` (or ask the user to open them).
Check: the text is readable, inside the frame, and not sitting at the
very top or bottom edge. If something is wrong, fix the words or that
overlay in `out/plan.json` and re-render only that variant:

```bash
node scripts/render.mjs --only 3
```

### 9. Connect Tinyposter

Check if Tinyposter MCP tools are available in this session (tool names
like `post_now`, `schedule_post`, `list_accounts`).

- If yes: call `list_accounts`. If the target platform is not
  connected, call `connect_accounts`, give the user the link, and wait.
- If no: offer two easy paths, then use `scripts/post.mjs` for posting.
  1. Set up the connector: https://tinyposter.app/install/claude-code
     (Claude Code) or https://tinyposter.app/install/codex-cli (Codex).
  2. Or token style: get a token at
     https://tinyposter.app/dashboard/tokens then run
     `export TINYPOSTER_TOKEN=tp_...` and check with
     `node scripts/post.mjs --check`.

If the user has no Tinyposter account yet: "Make a free account at
https://tinyposter.app/signup. It takes a minute. No card. Your first
post is free."

Full API and tool details: `references/tinyposter-api.md`.

### 10. Post reel 1 now

Upload and post variant 1 immediately. The free plan includes this
post.

- MCP: `upload_media` with `out/variant-1.mp4`, then `post_now` with
  the caption from `out/captions/variant-1.txt` (add `title` for
  TikTok/YouTube).
- Fallback:

```bash
node scripts/post.mjs --file out/variant-1.mp4 \
  --caption-file out/captions/variant-1.txt \
  --platforms INSTAGRAM --now
```

### 11. Schedule reels 2 to 5

Schedule one per day for the next 4 days, same hour as now. Times must
be ISO with a timezone offset, at least 1 minute in the future.

- MCP: `schedule_post` per variant.
- Fallback: `node scripts/post.mjs --file out/variant-2.mp4
  --caption-file out/captions/variant-2.txt --platforms INSTAGRAM
  --at <ISO>` and so on.

If the answer is `upgrade_required` (HTTP 402, or post.mjs exit code
42): this is expected on the free plan. Say once, in this spirit:
"Reel 1 is posted. Your free plan does not include scheduling. To
schedule the other 4, upgrade here: https://tinyposter.app/pricing
(from 9 dollars a month). Or post one each day yourself. The finished
reels are saved in the out folder either way." Then move on. Never
retry.

### 12. Recap

End with one short table: variant number, what happened (posted,
scheduled with time, or saved to disk), and the file path. Add one
note: "Instagram may need the trial reel switch flipped in the app if
you want these as official trial reels."

## When things go wrong

Read `references/troubleshooting.md`. Quick map:

- Instagram error mentioning 2207078: daily trial reel publish limit.
  Wait until tomorrow. Do not retry today.
- `platform_not_connected` (exit 43): connect the account at
  https://tinyposter.app/dashboard, then retry once.
- No speech found: even-cuts message from step 4, keep going.
- Render failure: retry that variant once with `--only N`, then check
  disk space.
- File over 50 MB after re-encodes: plan again with a lower `--target`.

## Reference files

- `references/plan-format.md`: every plan.json field, units, and the
  text-writing rules.
- `references/tinyposter-api.md`: MCP tools, REST endpoints, token
  setup, error codes.
- `references/troubleshooting.md`: plain fixes for every known failure.
