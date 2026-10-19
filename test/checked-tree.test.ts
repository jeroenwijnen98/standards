// checked-tree hands the check no GIT_*. Git exports GIT_DIR and GIT_INDEX_FILE
// to its hooks, and a test running git in a scratch repo under them acted on
// the real repo instead: it left the config bare and put seed commits on main.
// Exercised in a scratch repo, so the stamp lands there.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const checkedTree = join(import.meta.dirname, "..", "hooks", "checked-tree");

for (const mode of ["run", "hook"]) {
  test(`checked-tree ${mode} runs the check without the hook's GIT_*`, () => {
    const dir = mkdtempSync(join(tmpdir(), "standards-checked-tree-"));
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    );
    try {
      execFileSync("git", ["init", "-q", dir], { env });
      const seen = join(dir, ".git", "seen-env");
      execFileSync(checkedTree, [mode, "sh", "-c", `env > '${seen}'`], {
        cwd: dir,
        env: { ...env, GIT_DIR: join(dir, ".git"), GIT_INDEX_FILE: join(dir, ".git", "index") },
      });
      const leaked = readFileSync(seen, "utf8")
        .split("\n")
        .filter((line) => line.startsWith("GIT_"));
      assert.deepEqual(leaked, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
