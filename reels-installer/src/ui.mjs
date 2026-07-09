// Tiny terminal helpers, same conventions as the main tinyposter CLI.
// No deps. Honors NO_COLOR and non-TTY stdout.
import readline from "node:readline";

const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const color = {
  bold: c("1"),
  dim: c("2"),
  red: c("31"),
  green: c("32"),
  yellow: c("33"),
  blue: c("34"),
  magenta: c("35"),
  cyan: c("36"),
};

export function info(msg) {
  process.stdout.write(`${msg}\n`);
}
export function ok(msg) {
  process.stdout.write(`${color.green("✓")} ${msg}\n`);
}
export function warn(msg) {
  process.stdout.write(`${color.yellow("!")} ${msg}\n`);
}
export function fail(msg) {
  process.stderr.write(`${color.red("✗")} ${msg}\n`);
}

export function banner(version, { uninstall = false } = {}) {
  info(`${color.bold("tinyposter-reels")} ${color.dim(`v${version}`)}`);
  info("");
  if (uninstall) {
    info("Removing the Tinyposter Trial Reels skill from this computer.");
  } else {
    info("This installer will:");
    info("  1. Install the trial-reels skill folder for your AI agent");
    info("  2. Connect the Tinyposter MCP so your agent can talk to Tinyposter");
    info("  3. Offer to pre-download the video renderer (about 500 MB, one time)");
  }
  info("");
  info("This tool collects no data.");
  info(`Docs: ${color.cyan("https://tinyposter.app/docs/trial-reels")}`);
  info("");
}

// Yes/no prompt. Enter (or a closed/piped stdin) means the default answer,
// so an agent that forgets --yes never hangs forever.
export async function confirm(question, { defaultYes = true } = {}) {
  const suffix = defaultYes ? "(Y/n)" : "(y/N)";
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(value);
    };
    rl.on("close", () => finish(defaultYes));
    rl.question(`${question} ${suffix} `, (answer) => {
      const a = answer.trim().toLowerCase();
      finish(a === "" ? defaultYes : a === "y" || a === "yes");
    });
  });
}
