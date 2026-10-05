import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = join(import.meta.dirname, "..");
const bin = (name: string) => join(root, "node_modules/.bin", name);

test("the base oxlint config reports every rule it enables", () => {
  const fixture = join(root, "test/fixtures/lint");
  const run = spawnSync(bin("oxlint"), ["--format", "json"], { cwd: fixture, encoding: "utf8" });
  const reported = new Set(
    JSON.parse(run.stdout).diagnostics.map((d: { code: string }) => d.code),
  );
  for (const code of [
    "eslint(no-nested-ternary)",
    "eslint(no-unused-vars)",
    "oxc(no-accumulating-spread)",
    "anti-slop(no-reduce-accumulator-copy)",
    "anti-slop(no-chained-type-assertions)",
    "anti-slop(no-widen-then-assert)",
  ]) {
    assert.ok(reported.has(code), `${code} not reported; got ${[...reported].join(", ")}`);
  }
});

test("the base tsconfig rejects syntax Node cannot strip", () => {
  const run = spawnSync(bin("tsc"), ["-p", join(root, "test/fixtures/erasable")], {
    encoding: "utf8",
  });
  assert.match(run.stdout, /violations\.ts\(2,\d+\).*TS1294/);
  assert.match(run.stdout, /violations\.ts\(5,\d+\).*TS1484/);
});

test("dist/anti-slop is the current build of oxlint/anti-slop", () => {
  const fresh = mkdtempSync(join(tmpdir(), "standards-build-"));
  execFileSync(process.execPath, [join(root, "scripts/build.ts"), fresh], { stdio: "ignore" });
  const committed = join(root, "dist/anti-slop");
  const files = (dir: string) =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(dir.length))
      .sort();
  assert.deepEqual(files(committed), files(fresh), "run `npm run build`");
  for (const file of files(fresh)) {
    assert.equal(
      readFileSync(join(committed, file), "utf8"),
      readFileSync(join(fresh, file), "utf8"),
      `${file} is stale; run \`npm run build\``,
    );
  }
});
