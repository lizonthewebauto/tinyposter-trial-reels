# Posting through Tinyposter

Two ways to post. Use the MCP tools when they are available in the
session. Use `scripts/post.mjs` when they are not.

## Path A: Tinyposter MCP tools (preferred)

If the Tinyposter MCP server is connected, these tools exist (among
others): `list_accounts`, `connect_accounts`, `upload_media`,
`post_now`, `schedule_post`, `add_to_queue`, `get_usage`, `list_posts`,
`cancel_post`, `get_timezone`.

Not connected? Send the user to one of:

- Claude Code: https://tinyposter.app/install/claude-code
  (one command: `claude mcp add --transport http tinyposter https://tinyposter.app/api/mcp`)
- Codex: https://tinyposter.app/install/codex-cli
- Any agent, token style: get a token at
  https://tinyposter.app/dashboard/tokens

Flow per variant:

1. `list_accounts`. If the platform is missing, call `connect_accounts`,
   give the user the link, and wait for them to finish connecting.
2. `upload_media` with the local file path (or its URL form). Note the
   upload id.
3. `post_now` (variant 1) or `schedule_post` with an ISO `scheduled_at`
   that includes a timezone offset, at least 1 minute in the future.
   Include `title` when posting to TikTok or YouTube.

## Path B: scripts/post.mjs (token fallback)

Needs `TINYPOSTER_TOKEN` set (a `tp_` token from
https://tinyposter.app/dashboard/tokens).

```bash
# see connected accounts and plan usage
node scripts/post.mjs --check

# post variant 1 right now
node scripts/post.mjs --file out/variant-1.mp4 \
  --caption-file out/captions/variant-1.txt \
  --platforms INSTAGRAM --now

# schedule variant 2 for tomorrow at the same hour (ISO with offset)
node scripts/post.mjs --file out/variant-2.mp4 \
  --caption-file out/captions/variant-2.txt \
  --platforms INSTAGRAM --at 2026-07-10T14:30:00-04:00
```

Exit codes: 0 ok, 1 problem, 2 no token, 3 file over 50 MB, 4 missing
title for TikTok/YouTube, 42 scheduling needs a paid plan, 43 platform
not connected.

It calls the REST API: `POST /api/v1/uploads` (multipart, field `file`)
then `POST /api/v1/posts` with `media_upload_ids`, an `Idempotency-Key`
header, and optional `scheduled_at`. Full API docs:
https://tinyposter.app/docs/api

## Rules and limits

- Video: mp4, mov, or webm. 50 MB max per file. 9:16 fills the frame.
- One post to many platforms costs 1 post credit.
- Free plan: 1 post total, no card, posting now only. Scheduling needs
  a paid plan (starts at 9 dollars a month).
- TikTok and YouTube posts need a `title`.
- Twitter cuts video at 2 minutes 20 seconds.
- Pinterest takes images only. Do not send it a reel.

## Error signals to handle

- `upgrade_required` (HTTP 402, or post.mjs exit 42): the free plan
  cannot schedule. Say it once, share the link
  https://tinyposter.app/pricing, and stop trying. Do not retry.
- `platform_not_connected` (409, exit 43): account not linked. Send the
  user to https://tinyposter.app/dashboard, wait, then retry once.
- `quota_exceeded` (402): monthly posts are used up. Same handling as
  upgrade_required.
- Meta error 2207078 in a post's error text: Instagram's daily trial
  reel publish limit. Wait until tomorrow. Do not retry today.
