# Trial Reels skill

Give your AI helper one video. It makes 5 versions that look different.
Then it posts them through Tinyposter so you can see which one wins.

Works with Claude Code and Codex.

## What you need

- A free Tinyposter account: https://tinyposter.app/signup
  (one minute, no card, your first post is free)
- Node.js 20 or newer: https://nodejs.org (click the LTS button)
- Claude Code or Codex

## Easy install

Paste this into Claude Code or Codex:

```
Set up the Tinyposter Trial Reels skill for me.

1. Check Node: run "node --version". I need version 20 or newer. If it is
   missing or old, help me install it from https://nodejs.org (pick LTS),
   then keep going.
2. Run: npx tinyposter-reels@latest --yes
3. If anything fails, read the error, fix it, and run step 2 again.
4. Check the "tinyposter" MCP server is connected. In Claude Code, check
   /mcp. In Codex, run "codex mcp list" and "codex mcp login tinyposter"
   if it needs a login.
5. Tell me it worked, then ask me for the video I want to turn into
   trial reels.

Help docs: https://tinyposter.app/docs/trial-reels
```

That is the whole install. To update later, paste the same message
again.

## How to use it

Say this to your AI helper:

> Make trial reels from my video.

Then give it the video file. It will:

1. Find the talking parts.
2. Plan 5 versions: flipped, trimmed, re-timed, new text on screen.
3. Show you the words. You can change them.
4. Make the 5 reels (about 5 to 15 minutes).
5. Post reel 1 for free and offer to schedule the rest.

Everything it makes lands in the `out` folder: the reels, the captions,
and check pictures.

## Good to know

- Reels come out vertical, 1080 by 1920, under 50 MB.
- The first render downloads a small browser one time. Give it a few
  minutes.
- Speeding up makes voices a tiny bit higher. That is normal here.
- The free Tinyposter plan posts 1 reel. Scheduling all 5 needs a paid
  plan, from 9 dollars a month: https://tinyposter.app/pricing
- The video maker inside this skill is Remotion. It is free for people
  and teams of 3 or fewer. Bigger companies need a Remotion license:
  https://remotion.dev/license

## By hand (no installer)

Copy this folder to `~/.claude/skills/trial-reels` (Claude Code) or
`~/.agents/skills/trial-reels` (Codex). Then run `npm install` inside
it once.

## Remove it

Tell your AI helper: run `npx tinyposter-reels --uninstall`.
