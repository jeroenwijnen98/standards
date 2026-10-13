#!/usr/bin/env node
// Checks the comment width of every source file git knows about in the
// current directory, new ones not yet committed included. A repo runs it in
// its lint script, next to oxlint, which has no comments-only max-len.
//
// Usage: comment-width [--one-line <columns>] [--skip <path prefix>]...
//   --one-line  the width of a comment on one line of its own (default 80)
//   --skip      a folder not written here, such as vendored code or fixtures
// The folders in the oxlint base's ignorePatterns are always skipped.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ignorePatterns } from "../oxlint/base.js";
import { SOURCE, tooWide, WRAPPED } from "./check.js";

const { values } = parseArgs({
  options: {
    "one-line": { type: "string", default: String(WRAPPED) },
    skip: { type: "string", multiple: true, default: [] },
  },
});
const oneLine = Number(values["one-line"]);
const skipped = [...ignorePatterns.map((glob) => glob.replace(/\*\*$/, "")), ...values.skip];

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => SOURCE.test(file) && !skipped.some((prefix) => file.startsWith(prefix)))
  // Deleted but not yet staged: listed, yet nothing left to read.
  .filter((file) => existsSync(file));

const offenders = files.flatMap((file) =>
  tooWide(file, readFileSync(file, "utf8"), oneLine).map((hit) => `${file}:${hit}`),
);
if (offenders.length > 0) {
  console.error(`comment-width: rewrap these comments\n${offenders.join("\n")}`);
  process.exit(1);
}
