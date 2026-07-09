// Entry point for the `tinyposter-reels` command. Hand-rolled argv parser to
// keep dependencies at zero, same pattern as the main tinyposter CLI.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { detectAgents } from "./detect.mjs";
import {
  resolveSkillSource,
  targetsFor,
  installSkillTo,
  uninstallAll,
  claudeSkillDir,
  codexSkillDirs,
} from "./install-skill.mjs";
import { wireClaude, wireCodex, mcpMentionsTinyposter } from "./mcp.mjs";
import { color, info, ok, warn, fail, confirm, banner } from "./ui.mjs";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const VERSION = readVersion();

function readVersion() {
  // Read from package.json so the version printed, the .version files, and
  // publish.sh's auto patch bump can never drift apart.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const HELP = `${color.bold("tinyposter-reels")} ${color.dim(`v${VERSION}`)}

Installs the Tinyposter Trial Reels skill for Claude Code and Codex.

${color.bold("Usage:")}
  npx tinyposter-reels@latest [options]

${color.bold("Options:")}
  ${color.green("--yes")}             Answer yes to every prompt (good for AI agents)
  ${color.green("--agent <name>")}    claude, codex, or both (default: auto-detect)
  ${color.green("--no-mcp")}          Skip connecting the Tinyposter MCP
  ${color.green("--no-preinstall")}   Skip the video renderer download
  ${color.green("--uninstall")}       Remove the installed skill folders
  ${color.green("--version")}         Print the version
  ${color.green("--help")}            Show this help

${color.bold("Docs:")} ${color.cyan("https://tinyposter.app/docs/trial-reels")}
`;

// Flags that never take a value, so `--yes something` cannot swallow
// `something` as the flag's value.
const BOOLEAN_FLAGS = new Set(["yes", "no-mcp", "no-preinstall", "uninstall", "version", "help"]);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const name = a.slice(2);
        const next = argv[i + 1];
        if (BOOLEAN_FLAGS.has(name) || !next || next.startsWith("--")) {
          flags[name] = true;
        } else {
          flags[name] = next;
          i++;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function resolveAgents(flags) {
  if (flags.agent != null) {
    const v = String(flags.agent).toLowerCase();
    if (v === "claude") return { claude: true, codex: false, how: "picked with --agent" };
    if (v === "codex") return { claude: false, codex: true, how: "picked with --agent" };
    if (v === "both") return { claude: true, codex: true, how: "picked with --agent" };
    fail(`--agent must be claude, codex, or both (got "${flags.agent}").`);
    process.exit(1);
  }
  const found = detectAgents();
  if (!found.claude && !found.codex) {
    fail(
      "Install Claude Code first: https://claude.com/claude-code " +
        "(or Codex: https://developers.openai.com/codex). Then run this again."
    );
    process.exit(1);
  }
  return { ...found, how: "auto-detected" };
}

async function maybePreinstallRenderer(agents, flags) {
  if (flags["no-preinstall"]) {
    info(color.dim("Skipping the renderer download (--no-preinstall)."));
    return;
  }
  const dir = agents.claude ? claudeSkillDir() : codexSkillDirs()[0];
  const question = "Download the video renderer now? It is about 500 MB and only happens once.";
  let wantsIt = true;
  if (flags.yes) {
    info(`${question} ${color.dim("(Y/n) y  [--yes]")}`);
  } else {
    wantsIt = await confirm(question);
  }
  if (!wantsIt) {
    info("Okay. The renderer will download the first time you use the skill.");
    return;
  }
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    warn("Could not find the renderer's package.json. Setup will finish the first time you use the skill.");
    return;
  }
  info(`Downloading the renderer into ${color.dim(dir)} (this can take a few minutes)...`);
  const isWin = process.platform === "win32";
  let failed = false;
  try {
    const res = spawnSync(isWin ? "npm.cmd" : "npm", ["install"], {
      cwd: dir,
      stdio: "inherit",
      shell: isWin,
    });
    failed = !!res.error || res.status !== 0;
  } catch {
    failed = true;
  }
  if (failed) warn("Setup will finish the first time you use the skill.");
  else ok("Renderer ready.");
}

function checkLine(label, skillOk, mcpState) {
  const parts = [skillOk ? "skill installed" : "skill NOT installed"];
  if (mcpState === "skipped") parts.push("MCP setup skipped (--no-mcp)");
  else if (mcpState === true) parts.push("Tinyposter connected");
  else if (mcpState === false) parts.push("Tinyposter not connected yet (see the fix above)");
  else parts.push("could not check the MCP list");
  const line = `${label}: ${parts.join(", ")}`;
  if (!skillOk) fail(line);
  else if (mcpState === true || mcpState === "skipped") ok(line);
  else warn(line);
}

function verifySetup(agents, { skipMcp }) {
  info("");
  info(color.bold("Check:"));
  if (agents.claude) {
    const skillOk = fs.existsSync(path.join(claudeSkillDir(), ".version"));
    checkLine("Claude Code", skillOk, skipMcp ? "skipped" : mcpMentionsTinyposter("claude"));
  }
  if (agents.codex) {
    const skillOk = codexSkillDirs().some((dir) => fs.existsSync(path.join(dir, ".version")));
    checkLine("Codex", skillOk, skipMcp ? "skipped" : mcpMentionsTinyposter("codex"));
  }
}

function printNextSteps() {
  info("");
  info(color.bold("Next steps:"));
  info(`  1) Make your free account (1 minute, no card): ${color.cyan("https://tinyposter.app/signup?source=trial-reels")}`);
  info(`  2) Open Claude Code (or Codex) and say: ${color.bold("Make trial reels from my video")}`);
  info("  3) The first time, your browser will ask you to allow Tinyposter. Click Allow.");
  info("");
}

function runUninstall() {
  const removed = uninstallAll();
  if (!removed.length) {
    info("Nothing to remove. No trial-reels skill folders found.");
  } else {
    for (const dir of removed) ok(`Removed ${dir}`);
  }
  info("");
  info("To remove the MCP entry too, run one of these:");
  info(`  ${color.cyan("claude mcp remove tinyposter")}`);
  info(`  ${color.cyan("codex mcp remove tinyposter")}`);
}

export async function run(argv) {
  if (argv[0] === "help" || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  if (argv[0] === "version" || argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`tinyposter-reels ${VERSION}\n`);
    return;
  }

  const { flags } = parseArgs(argv);
  banner(VERSION, { uninstall: !!flags.uninstall });

  const major = Number(process.versions.node.split(".")[0]);
  if (!(major >= 20)) {
    fail("You need Node 20 or newer. Get it at https://nodejs.org (pick LTS). Then run this again.");
    process.exit(1);
  }

  if (flags.uninstall) return runUninstall();

  const agents = resolveAgents(flags);
  const names = [agents.claude ? "Claude Code" : null, agents.codex ? "Codex" : null]
    .filter(Boolean)
    .join(" and ");
  info(`Setting up for: ${color.bold(names)} ${color.dim(`(${agents.how})`)}`);
  info("");

  // 1. Copy the skill folder(s).
  const source = resolveSkillSource(PACKAGE_DIR); // throws a clear message if missing
  const installed = [];
  for (const target of targetsFor(agents)) {
    try {
      installSkillTo(source, target.dir, VERSION);
      installed.push(target.dir);
      ok(`${target.label}: skill installed at ${color.dim(target.dir)}`);
    } catch (e) {
      fail(`${target.label}: FAILED to copy the skill to ${target.dir}`);
      info(color.dim(`  (${e && e.message ? e.message : e})`));
    }
  }
  if (!installed.length) {
    fail("No skill folder could be installed. Nothing else to do.");
    process.exit(1);
  }
  info("");

  // 2. Pre-download the video renderer (optional).
  await maybePreinstallRenderer(agents, flags);
  info("");

  // 3. Wire the MCP.
  if (flags["no-mcp"]) {
    info(color.dim("Skipping MCP setup (--no-mcp)."));
  } else {
    if (agents.claude) wireClaude();
    if (agents.codex) wireCodex();
  }

  // 4. Verify and hand off.
  verifySetup(agents, { skipMcp: !!flags["no-mcp"] });
  printNextSteps();
}
