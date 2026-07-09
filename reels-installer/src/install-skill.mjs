// Copies the trial-reels skill into the agent skill folders.
// Overwrites files we ship; never deletes files we did not ship, so user
// renders and state survive upgrades. Uninstall removes the whole folders.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const SKILL_NAME = "trial-reels";

// Never copy these out of the source skill: heavy install artifacts, render
// output, Remotion cache, and any user source video sitting in the folder.
const EXCLUDED_DIRS = new Set(["node_modules", "out", ".remotion"]);

export function claudeSkillDir() {
  return path.join(os.homedir(), ".claude", "skills", SKILL_NAME);
}

// New Codex builds read ~/.agents/skills, older ones read ~/.codex/skills.
// Install to both so the skill shows up either way.
export function codexSkillDirs() {
  return [
    path.join(os.homedir(), ".agents", "skills", SKILL_NAME),
    path.join(os.homedir(), ".codex", "skills", SKILL_NAME),
  ];
}

export function targetsFor(agents) {
  const targets = [];
  if (agents.claude) targets.push({ label: "Claude Code", dir: claudeSkillDir() });
  if (agents.codex) {
    const [agentsDir, codexDir] = codexSkillDirs();
    targets.push({ label: "Codex", dir: agentsDir });
    targets.push({ label: "Codex (older builds)", dir: codexDir });
  }
  return targets;
}

function isNonEmptyDir(dir) {
  try {
    return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

// The published package ships the skill at ./skill. When running straight
// from the repo before publish, fall back to ../skills/trial-reels.
export function resolveSkillSource(packageDir) {
  const bundled = path.join(packageDir, "skill");
  if (isNonEmptyDir(bundled)) return bundled;
  const repoSkill = path.resolve(packageDir, "..", "skills", SKILL_NAME);
  if (isNonEmptyDir(repoSkill)) return repoSkill;
  throw new Error(
    "Could not find the trial-reels skill files. " +
      `Looked in ${bundled} and ${repoSkill}. The package may be broken. ` +
      "Try again with: npx tinyposter-reels@latest " +
      "(if it keeps failing, email support@tinyposter.app)."
  );
}

function shouldCopy(sourceRoot, src) {
  const rel = path.relative(sourceRoot, src);
  if (!rel) return true; // the source root itself
  const parts = rel.split(path.sep);
  if (parts.some((part) => EXCLUDED_DIRS.has(part))) return false;
  // public/source.* is the user's own uploaded video; never copy it around.
  if (parts[0] === "public" && parts[1] && parts[1].startsWith("source.")) return false;
  return true;
}

export function installSkillTo(sourceDir, targetDir, version) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true, // overwrite files we ship, leave everything else alone
    filter: (src) => shouldCopy(sourceDir, src),
  });
  fs.writeFileSync(path.join(targetDir, ".version"), `${version}\n`);
  return targetDir;
}

export function uninstallAll() {
  const removed = [];
  for (const dir of [claudeSkillDir(), ...codexSkillDirs()]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(dir);
    }
  }
  return removed;
}
