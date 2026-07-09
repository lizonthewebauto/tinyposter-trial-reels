// Wires the Tinyposter MCP into Claude Code and Codex. Every spawn is
// wrapped: a broken agent CLI downgrades to a printed hint, never a crash.
import { spawnSync } from "node:child_process";
import { color, info, ok, warn, fail } from "./ui.mjs";

const MCP_URL = "https://tinyposter.app/api/mcp";

function runCli(cmd, args, { timeout = 60000, inherit = false } = {}) {
  const isWin = process.platform === "win32";
  try {
    const res = spawnSync(cmd, args, {
      encoding: "utf8",
      timeout,
      shell: isWin,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    if (res.error) return { ok: false, out: "", detail: res.error.message };
    const out = `${res.stdout || ""}\n${res.stderr || ""}`;
    const lastLine = (res.stderr || res.stdout || "").trim().split("\n").pop() || "";
    return { ok: res.status === 0, out, detail: lastLine };
  } catch (e) {
    return { ok: false, out: "", detail: e && e.message ? e.message : String(e) };
  }
}

// true = listed, false = not listed, null = could not check.
export function mcpMentionsTinyposter(cmd) {
  const res = runCli(cmd, ["mcp", "list"]);
  if (!res.ok) return null;
  return /tinyposter/i.test(res.out);
}

export function wireClaude() {
  info("Connecting Tinyposter to Claude Code...");
  const list = runCli("claude", ["mcp", "list"]);
  if (list.ok && /tinyposter/i.test(list.out)) {
    ok("Claude Code: Tinyposter is already connected.");
    return true;
  }
  if (!list.ok) {
    warn("Claude Code: could not read the MCP list. Trying to add Tinyposter anyway.");
  }
  const add = runCli("claude", ["mcp", "add", "--transport", "http", "tinyposter", MCP_URL]);
  if (add.ok) {
    ok("Claude Code: Tinyposter MCP added.");
    return true;
  }
  fail("Claude Code: FAILED to add the Tinyposter MCP.");
  info("  Fix: copy this into your terminal and press enter:");
  info(`  ${color.cyan(`claude mcp add --transport http tinyposter ${MCP_URL}`)}`);
  if (add.detail) info(color.dim(`  (${add.detail})`));
  return false;
}

export function wireCodex() {
  info("Connecting Tinyposter to Codex...");
  const list = runCli("codex", ["mcp", "list"]);
  if (list.ok && /tinyposter/i.test(list.out)) {
    ok("Codex: Tinyposter is already connected.");
    return true;
  }
  if (!list.ok) {
    // This Codex build has no `mcp` subcommand. Hand over the config block.
    warn("Codex: this Codex build does not support `codex mcp` commands.");
    printCodexManualSetup();
    return false;
  }
  const add = runCli("codex", ["mcp", "add", "tinyposter", "--url", MCP_URL]);
  if (!add.ok) {
    fail("Codex: FAILED to add the Tinyposter MCP.");
    if (add.detail) info(color.dim(`  (${add.detail})`));
    printCodexManualSetup();
    return false;
  }
  ok("Codex: Tinyposter MCP added.");
  info("Codex: opening your browser to log in to Tinyposter. Click Allow.");
  const login = runCli("codex", ["mcp", "login", "tinyposter"], { inherit: true, timeout: 180000 });
  if (login.ok) {
    ok("Codex: logged in to Tinyposter.");
  } else {
    warn(`Codex: login did not finish. Run it later: ${color.cyan("codex mcp login tinyposter")}`);
  }
  return true;
}

// Config block kept in sync with the "codex-cli" surface in
// lib/install-recommendations.ts.
function printCodexManualSetup() {
  info("");
  info(`Manual setup: open ${color.bold("~/.codex/config.toml")} in your editor (create the file if it does not exist). Paste this whole block at the bottom. Save. Quit and reopen Codex.`);
  info("");
  info(color.cyan(`[mcp_servers.tinyposter]
url = "https://tinyposter.app/api/mcp"
http_headers = { Authorization = "Bearer tp_PASTE_YOUR_TOKEN_HERE" }`));
  info("");
  info(`Get a token at ${color.cyan("https://tinyposter.app/dashboard/tokens")}`);
  info("");
}
