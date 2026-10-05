// Node refuses to strip types from files under node_modules, so the anti-slop
// plugin ships as JavaScript: dist/anti-slop/ is oxlint/anti-slop/ with the
// types stripped and its relative imports renamed from .ts to .js. The output
// is committed; `npm test` fails when it is out of date. An argument builds
// somewhere else instead, which is how the test checks it.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const source = join(root, "oxlint/anti-slop");
const target = process.argv[2] ?? join(root, "dist/anti-slop");

rmSync(target, { recursive: true, force: true });

for (const entry of readdirSync(source, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const from = join(entry.parentPath, entry.name);
  const to = join(target, relative(source, from));
  mkdirSync(dirname(to), { recursive: true });

  if (entry.name.endsWith(".d.ts")) continue;
  if (!entry.name.endsWith(".ts")) {
    writeFileSync(to, readFileSync(from));
    continue;
  }
  const code = stripTypeScriptTypes(readFileSync(from, "utf8"), { mode: "strip" })
    .replace(/(from\s+["']\.{1,2}\/[^"']+)\.ts(["'])/g, "$1.js$2");
  writeFileSync(to.replace(/\.ts$/, ".js"), code);
}
