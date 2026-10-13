import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { tooWide } from "../comment-width/check.js";

const words = `${"word ".repeat(16)}word`;

describe("comment width", () => {
  test("a comment that wraps past 80 columns, or one line past its width, is found", () => {
    assert.deepEqual(tooWide("a.ts", ["/**", ` * ${words}`, " */"].join("\n"), 120), [
      "2: 87 columns, over 80 for a wrapped comment",
    ]);
    assert.deepEqual(tooWide("a.ts", ["// fits", `// ${words}`].join("\n"), 120), [
      "2: 87 columns, over 80 for a wrapped comment",
    ]);
    assert.deepEqual(tooWide("a.sql", ["-- fits", `-- ${words}`].join("\n"), 120), [
      "2: 87 columns, over 80 for a wrapped comment",
    ]);
    assert.deepEqual(tooWide("a.html", ["<!--", `  ${words}`, "-->"].join("\n"), 120), [
      "2: 86 columns, over 80 for a wrapped comment",
    ]);

    // The same width on one line of its own is in bounds, up to the width given.
    assert.deepEqual(tooWide("a.ts", `/** ${words} */`, 120), []);
    assert.deepEqual(tooWide("a.ts", `// ${words}`, 120), []);
    assert.deepEqual(tooWide("a.html", `<!-- ${words} -->`, 120), []);
    assert.deepEqual(tooWide("a.ts", `// ${words}`, 80), [
      "1: 87 columns, over 80 for a one-line comment",
    ]);
  });

  test("code is not a comment, a comment after code included", () => {
    assert.deepEqual(tooWide("a.ts", `const s = '${"x".repeat(120)}' // ${words}`, 80), []);
    // Outside SQL, -- starts no comment: in CSS it names a custom property.
    const property = `  --sans: ${"'Font', ".repeat(10)}sans-serif;`;
    assert.deepEqual(tooWide("a.css", ["/* fits */", property].join("\n"), 80), []);
  });

  test("columns are characters, not UTF-16 units", () => {
    assert.deepEqual(tooWide("a.ts", `// ${"𝑥".repeat(77)}`, 80), []);
  });

  test("a directive, a JSDoc type and a URL ending the line may run past", () => {
    const allowed = [
      `// oxlint-disable-next-line no-nested-ternary -- ${"reason ".repeat(8)}`,
      `// @ts-expect-error ${"reason ".repeat(12)}`,
      `/** @typedef {{ ${"a: string, ".repeat(8)}}} Wide */`,
      `// See ${"x".repeat(60)} https://example.com/a/long/path/that/crosses/it).`,
    ];
    for (const line of allowed) assert.deepEqual(tooWide("a.ts", line, 80), [], line);
  });

  test("prose after a type or a URL still counts", () => {
    const type = ` * @param {${"A | ".repeat(14)}B} name ${words}`;
    assert.deepEqual(tooWide("a.ts", ["/**", type, " */"].join("\n"), 80).length, 1);
    const pastUrl = `// https://example.com/x ${"word ".repeat(14)}`;
    assert.deepEqual(tooWide("a.ts", pastUrl, 80).length, 1);
  });

  test("the CLI checks the repo it runs in, skipping what it is told to", () => {
    const repo = mkdtempSync(join(tmpdir(), "comment-width-"));
    execFileSync("git", ["init", "--quiet"], { cwd: repo });
    mkdirSync(join(repo, "vendor"));
    mkdirSync(join(repo, ".sandcastle"));
    writeFileSync(join(repo, "vendor/lib.js"), `// ${words}\n// ${words}\n`);
    writeFileSync(join(repo, ".sandcastle/run.ts"), `// ${words}\n// ${words}\n`);
    writeFileSync(join(repo, "ok.ts"), `// ${words}\n`);
    writeFileSync(join(repo, "wide.ts"), `// fits\n// ${words}\n`);
    const cli = join(import.meta.dirname, "../comment-width/cli.js");
    const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8" });

    const failed = run("--one-line", "100", "--skip", "vendor/");
    assert.equal(failed.status, 1);
    assert.equal(failed.stderr, "comment-width: rewrap these comments\nwide.ts:2: 87 columns, over 80 for a wrapped comment\n");

    writeFileSync(join(repo, "wide.ts"), "// fits\n");
    assert.equal(run("--one-line", "100", "--skip", "vendor/").status, 0);
  });
});
