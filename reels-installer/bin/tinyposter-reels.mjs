#!/usr/bin/env node
import { run } from "../src/index.mjs";

run(process.argv.slice(2)).catch((err) => {
  // Top-level safety net. Steps handle their own errors with nicer
  // messages; this is the "something exploded" path.
  const msg = err && err.message ? err.message : String(err);
  process.stderr.write(`tinyposter-reels: ${msg}\n`);
  process.exit(1);
});
