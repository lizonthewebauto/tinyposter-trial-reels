# Tinyposter Trial Reels

Give your AI helper one video. It makes 5 versions that look different.
Then it posts them through [Tinyposter](https://tinyposter.app) so you
can see which one wins.

Works with Claude Code and Codex.

## Install

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

Or run the installer yourself:

```bash
npx tinyposter-reels@latest
```

Then say to your agent: **Make trial reels from my video.**

## What is in this repo

- `skills/trial-reels/` - the skill itself. The agent playbook
  (SKILL.md), a small Remotion project that renders the 5 variants, and
  the scripts that analyze, plan, render, and post.
- `reels-installer/` - the `tinyposter-reels` npm package. It copies the
  skill into your agent's skills folder and connects the Tinyposter MCP.

This is a read-along mirror of the skill that ships in the
[tinyposter-reels npm package](https://www.npmjs.com/package/tinyposter-reels).

## Links

- How it works: https://tinyposter.app/reels
- Docs: https://tinyposter.app/docs/trial-reels
- Tinyposter: https://tinyposter.app

## Notes

- You need Node 20+, and Claude Code (paid Claude plan) or Codex.
- The renderer is [Remotion](https://remotion.dev). It is free for
  people and teams of 3 or fewer. Bigger companies need a
  [Remotion license](https://remotion.dev/license).

## License

MIT for the code in this repo. See [LICENSE](LICENSE).
