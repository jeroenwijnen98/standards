#!/usr/bin/env node
// Lints the test lines a branch adds with the flake plugin: real waits and
// readings of the real clock, the shapes most flaky tests here shared. The
// Sandcastle reviewer runs it; it reads only added lines, so the tests that
// already wait for real don't drown out the one a branch just wrote.
//
// Usage: flake-check <base>
//   <base>  the branch the work started from; the diff runs from its merge base
//           to the working tree
// A real wait that no fake clock can reach (a child process, a browser) keeps
// a disable comment with its reason after `--`:
//   // oxlint-disable-next-line flake/no-sleep -- wrangler is a child process

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const TEST = /(^|\/)(test|tests|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const SOURCE = /\.[cm]?[jt]sx?$/;
const DISABLE = /[oe][xs]lint-disable\S*\s[^\n]*flake\//;

const base = process.argv[2];
if (!base) {
  console.error("usage: flake-check <base>");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const mergeBase = git("merge-base", base, "HEAD").trim();

/** @type {Map<string, Map<number, string>>} file → added line number → text */
const added = new Map();
let file = null;
let line = 0;
for (const row of git("diff", "-U0", "--no-color", "--no-ext-diff", mergeBase).split("\n")) {
  if (row.startsWith("+++ ")) {
    const path = row.slice(4).replace(/^b\//, "");
    file = TEST.test(path) && SOURCE.test(path) && existsSync(path) ? path : null;
    if (file) added.set(file, new Map());
  } else if (row.startsWith("@@")) {
    line = Number(/\+(\d+)/.exec(row)[1]);
  } else if (file && row.startsWith("+")) {
    added.get(file).set(line++, row.slice(1));
  }
}
if (added.size === 0) process.exit(0);

const oxlint = join(createRequire(import.meta.url).resolve("oxlint/package.json"), "../bin/oxlint");
const run = spawnSync(
  oxlint,
  ["-c", join(import.meta.dirname, "oxlint.config.js"), "--disable-nested-config", "--format", "json", ...added.keys()],
  { encoding: "utf8" },
);
const hits = JSON.parse(run.stdout)
  .diagnostics.filter((d) => d.code.startsWith("flake("))
  .map((d) => ({ file: d.filename, line: d.labels[0].span.line, why: `${d.code} ${d.message}` }))
  .filter((hit) => added.get(hit.file)?.has(hit.line));

for (const [path, lines] of added) {
  for (const [number, text] of lines) {
    if (DISABLE.test(text) && !text.includes(" -- ")) {
      hits.push({ file: path, line: number, why: "a flake disable names its reason after `--`" });
    }
  }
}

if (hits.length > 0) {
  console.log(hits.map((hit) => `${hit.file}:${hit.line}: ${hit.why}`).join("\n"));
  process.exit(1);
}
