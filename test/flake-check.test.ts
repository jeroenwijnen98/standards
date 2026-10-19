import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const cli = join(import.meta.dirname, "../flake-check/cli.js");

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "flake-check-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir });
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  mkdirSync(join(dir, "test"));
  return { dir, git };
}

const flakeCheck = (dir: string) => spawnSync(process.execPath, [cli, "main"], { cwd: dir, encoding: "utf8" });

test("flake-check reports the real waits and clock readings a branch adds to its tests", () => {
  const { dir, git } = repo();
  // A wait already on main is not this branch's to answer for.
  writeFileSync(join(dir, "test/old.test.ts"), "setTimeout(() => {}, 20)\n");
  writeFileSync(join(dir, "src.ts"), "export {}\n");
  git("add", "-A");
  git("commit", "--quiet", "-m", "main");
  git("switch", "--quiet", "-c", "work");

  writeFileSync(
    join(dir, "test/old.test.ts"),
    [
      "setTimeout(() => {}, 20)",
      "import { mock } from 'node:test'",
      "import { setTimeout as sleep } from 'node:timers/promises'",
      "await sleep(100)",
      "setTimeout(resolve)",
      "setTimeout(() => {}, 0)",
      "mock.timers.setTimeout(() => {}, 100)",
      "const started = performance.now()",
      "new Date(0)",
      "// oxlint-disable-next-line flake/no-sleep -- wrangler is a child process",
      "setTimeout(() => {}, 50)",
      "// oxlint-disable-next-line flake/no-wall-clock",
      "Date.now()",
      "",
    ].join("\n"),
  );
  // Outside the tests, a timer is the code's own business.
  writeFileSync(join(dir, "src.ts"), "setTimeout(() => {}, 20)\n");

  const run = flakeCheck(dir);
  assert.equal(run.status, 1, run.stderr);
  const [sleep, clock, reasonless, ...rest] = run.stdout.trim().split("\n");
  assert.match(sleep, /^test\/old\.test\.ts:4: flake\(no-sleep\) /);
  assert.match(clock, /^test\/old\.test\.ts:8: flake\(no-wall-clock\) /);
  assert.equal(reasonless, "test/old.test.ts:12: a flake disable names its reason after `--`");
  assert.deepEqual(rest, []);
});

test("flake-check passes a branch whose tests wait on nothing real", () => {
  const { dir, git } = repo();
  writeFileSync(join(dir, "test/a.test.ts"), "export {}\n");
  git("add", "-A");
  git("commit", "--quiet", "-m", "main");
  writeFileSync(join(dir, "test/a.test.ts"), "await Promise.resolve()\n");
  assert.equal(flakeCheck(dir).status, 0);
});
