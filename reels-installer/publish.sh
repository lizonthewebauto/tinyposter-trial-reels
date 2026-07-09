#!/usr/bin/env bash
# publish.sh - safe one-command npm publish for the tinyposter-reels installer.
#
# Usage:
#   cd reels-installer && ./publish.sh
#
# What it does (in order):
#   1. Refuse if Node < 20.
#   2. Refuse if not run from the reels-installer/ dir.
#   3. Bundle the skill: rm -rf ./skill, then copy ../skills/trial-reels -> ./skill
#      excluding node_modules, out, public/source.*, and .remotion.
#      package-lock.json IS included so renderer installs are reproducible.
#   4. Verify `node bin/tinyposter-reels.mjs --version` matches package.json.
#   5. Verify `node bin/tinyposter-reels.mjs --help` exits 0.
#   6. Check if "tinyposter-reels" is already on npm; if so, bump patch version.
#   7. Require `npm whoami` (abort with instructions if logged out).
#   8. Show a dry-run of what will be published.
#   9. Prompt before the real publish.
#  10. Verify the freshly published version is visible on npm.

set -euo pipefail

BOLD=$'\033[1m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

info()    { printf "%s[publish]%s %s\n" "$BOLD" "$RESET" "$1"; }
ok()      { printf "%s[ok]%s %s\n" "$GREEN" "$RESET" "$1"; }
warn()    { printf "%s[warn]%s %s\n" "$YELLOW" "$RESET" "$1"; }
fail()    { printf "%s[fail]%s %s\n" "$RED" "$RESET" "$1" >&2; exit 1; }

# --- 1. Node >= 20 -----------------------------------------------------------
node_major="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [ "$node_major" -lt 20 ]; then
  fail "Node 20+ required (found $(node --version))."
fi
ok "Node $(node --version) (>= 20)"

# --- 2. Run from reels-installer/ --------------------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$(pwd -P)" != "$script_dir" ]; then
  fail "Run this from the reels-installer/ directory:  cd $script_dir && ./publish.sh"
fi
if [ ! -f package.json ] || [ ! -f bin/tinyposter-reels.mjs ]; then
  fail "Missing package.json or bin/tinyposter-reels.mjs - are you in the right dir?"
fi
ok "Working dir: $script_dir"

# --- 3. Bundle the skill into ./skill -----------------------------------------
skill_src="../skills/trial-reels"
if [ ! -d "$skill_src" ]; then
  fail "Skill source not found at $skill_src. Build the trial-reels skill first."
fi
info "Bundling $skill_src -> ./skill (excluding node_modules, out, public/source.*, .remotion)..."
rm -rf ./skill
node -e "
const fs = require('node:fs');
const path = require('node:path');
const src = path.resolve('../skills/trial-reels');
const dest = path.resolve('./skill');
const EXCLUDED_DIRS = new Set(['node_modules', 'out', '.remotion']);
fs.cpSync(src, dest, {
  recursive: true,
  filter: (from) => {
    const rel = path.relative(src, from);
    if (!rel) return true;
    const parts = rel.split(path.sep);
    if (parts.some((part) => EXCLUDED_DIRS.has(part))) return false;
    if (parts[0] === 'public' && parts[1] && parts[1].startsWith('source.')) return false;
    return true;
  },
});
"
if [ ! -f ./skill/SKILL.md ]; then
  fail "./skill/SKILL.md missing after bundling. The skill source looks incomplete."
fi
ok "Skill bundled: $(find ./skill -type f | wc -l | tr -d ' ') files, $(du -sh ./skill | cut -f1)"

# --- 4. CLI version matches package.json --------------------------------------
pkg_version="$(node -p "require('./package.json').version")"
cli_version_line="$(node bin/tinyposter-reels.mjs --version)"
# Output looks like "tinyposter-reels 0.1.0" - take the last token.
cli_version="${cli_version_line##* }"
if [ "$pkg_version" != "$cli_version" ]; then
  fail "Version mismatch: package.json=$pkg_version, CLI reports=$cli_version"
fi
ok "Version $pkg_version (package.json and CLI agree)"

# --- 5. --help exits 0 ---------------------------------------------------------
if ! node bin/tinyposter-reels.mjs --help >/dev/null 2>&1; then
  fail "node bin/tinyposter-reels.mjs --help did not exit 0"
fi
ok "--help exits 0"

# --- 6. Bump patch if name already taken ---------------------------------------
info "Checking npm registry for existing 'tinyposter-reels' package..."
remote_version=""
if remote_output="$(npm view tinyposter-reels version 2>/dev/null)"; then
  remote_version="$(printf "%s" "$remote_output" | tr -d '[:space:]')"
fi

if [ -n "$remote_version" ]; then
  warn "tinyposter-reels@$remote_version already on npm."
  if [ "$remote_version" = "$pkg_version" ] || [ "$(printf '%s\n%s\n' "$remote_version" "$pkg_version" | sort -V | tail -n1)" = "$remote_version" ]; then
    info "Bumping patch version (local $pkg_version <= remote $remote_version)..."
    npm version patch --no-git-tag-version >/dev/null
    pkg_version="$(node -p "require('./package.json').version")"
    ok "Bumped to $pkg_version"
  else
    ok "Local $pkg_version > remote $remote_version - no bump needed."
  fi
else
  ok "Name 'tinyposter-reels' is free on npm (first publish)."
fi

# --- 7. npm whoami --------------------------------------------------------------
if ! whoami_output="$(npm whoami 2>/dev/null)"; then
  cat >&2 <<EOF
${RED}[fail]${RESET} You are not logged in to npm.

  1. Run:    npm login
  2. Finish 2FA in the browser / OTP prompt.
  3. Then re-run:  ./publish.sh
EOF
  exit 1
fi
ok "Logged in as: $whoami_output"

# --- 8. Dry run ------------------------------------------------------------------
info "Dry run - here is what will be published:"
echo "------------------------------------------------------------"
npm publish --access=public --dry-run
echo "------------------------------------------------------------"

# --- 9. Prompt --------------------------------------------------------------------
printf "%sReady to publish tinyposter-reels@%s to npm? (y/n)%s " "$BOLD" "$pkg_version" "$RESET"
read -r ans
case "${ans:-}" in
  y|Y|yes|YES) ;;
  *) warn "Aborted - nothing published."; exit 0 ;;
esac

# --- 10. Publish --------------------------------------------------------------------
info "Publishing..."
npm publish --access=public
ok "Published tinyposter-reels@$pkg_version"

# --- 11. Verify ----------------------------------------------------------------------
info "Verifying on npm (may take a few seconds for the registry to propagate)..."
for i in 1 2 3 4 5; do
  if posted_version="$(npm view tinyposter-reels version 2>/dev/null)"; then
    posted_version="$(printf "%s" "$posted_version" | tr -d '[:space:]')"
    if [ "$posted_version" = "$pkg_version" ]; then
      ok "npm view tinyposter-reels version -> $posted_version"
      break
    fi
  fi
  if [ "$i" -eq 5 ]; then
    warn "Registry has not caught up yet. Re-run 'npm view tinyposter-reels version' in a minute."
  else
    sleep 3
  fi
done

# --- 12. Done --------------------------------------------------------------------------
cat <<EOF

${GREEN}Done.${RESET} tinyposter-reels@${pkg_version} is live on npm.

Users (or their AI agents) can now run:

  npx tinyposter-reels@latest --yes

Package page: https://www.npmjs.com/package/tinyposter-reels
EOF
