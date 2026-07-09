# tinyposter-reels

One command sets up the Tinyposter Trial Reels skill for Claude Code or Codex.

Your AI agent turns one video into short reels and posts them for you. This installer puts the skill on your computer and connects it to Tinyposter.

## Quick start

Tell your AI agent to run this. Or run it yourself:

```bash
npx tinyposter-reels@latest --yes
```

Then open Claude Code (or Codex) and say:

> Make trial reels from my video

## What it does

1. Copies the trial-reels skill folder to your computer
2. Connects the Tinyposter MCP so your agent can talk to Tinyposter
3. Offers to pre-download the video renderer (about 500 MB, one time)

## What it touches

Only these spots. Nothing else.

| Spot | What goes there |
| --- | --- |
| `~/.claude/skills/trial-reels/` | The skill for Claude Code |
| `~/.agents/skills/trial-reels/` | The skill for new Codex builds |
| `~/.codex/skills/trial-reels/` | The skill for older Codex builds |
| One MCP entry named `tinyposter` | How your agent reaches Tinyposter |

Updates overwrite the files we ship. Your own renders and settings in those folders stay put.

## Privacy

This tool collects no data. No tracking. No usage pings. It only copies files and runs the setup commands listed above.

## Flags

| Flag | What it does |
| --- | --- |
| `--yes` | Answer yes to every question |
| `--agent <name>` | Pick `claude`, `codex`, or `both` |
| `--no-mcp` | Skip the MCP setup |
| `--no-preinstall` | Skip the renderer download |
| `--uninstall` | Remove the skill folders |
| `--version` | Print the version |
| `--help` | Show help |

## Uninstall

```bash
npx tinyposter-reels --uninstall
```

Then remove the MCP entry:

```bash
claude mcp remove tinyposter
# or
codex mcp remove tinyposter
```

## Requirements

Node.js 20 or newer. Get it at <https://nodejs.org> (pick LTS).

## Docs

Full guide: <https://tinyposter.app/docs/trial-reels>

## License

MIT
