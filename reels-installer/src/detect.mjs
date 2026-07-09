// Figures out which coding agents live on this machine. A working binary on
// PATH or the agent's home directory counts; either one means the skill has
// somewhere to go.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function commandWorks(cmd) {
  try {
    const res = spawnSync(cmd, ["--version"], {
      stdio: "ignore",
      timeout: 15000,
      // Windows resolves claude.cmd / codex.cmd through the shell; spawning
      // a .cmd directly without it throws EINVAL on Node 20+.
      shell: process.platform === "win32",
    });
    return !res.error && res.status === 0;
  } catch {
    return false;
  }
}

export function detectAgents() {
  const home = os.homedir();
  return {
    claude: commandWorks("claude") || fs.existsSync(path.join(home, ".claude")),
    codex: commandWorks("codex") || fs.existsSync(path.join(home, ".codex")),
  };
}
