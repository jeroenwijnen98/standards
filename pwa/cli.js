#!/usr/bin/env node
// pwa-check <origin>: what the deployed app answers someone not logged in.
// Run after `wrangler deploy`; exits 1 when Access guards more than `/pair`,
// or less.
import { checkLive } from "./live.js";

const origin = process.argv[2]?.replace(/\/$/, "");
if (origin === undefined || !/^https?:\/\//.test(origin)) {
  console.error("usage: pwa-check <origin>, e.g. pwa-check https://grocer.example.workers.dev");
  process.exit(2);
}

const results = await checkLive(origin);
for (const { path, ok, found, why } of results) {
  console.log(`${ok ? "ok  " : "FAIL"} ${path}: ${found}${ok ? "" : ` (expected: ${why})`}`);
}
if (results.some((result) => !result.ok)) {
  console.error("\nAccess must guard `/pair` only. See the Cloudflare PWA section of the standards README.");
  process.exit(1);
}
