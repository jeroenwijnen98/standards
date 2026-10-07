// Which version of the standards each repo in ~/Developer is on: the ref its
// package.json asks for and the commit its lockfile resolved, next to the
// newest tag here, and any `node --test` script without --test-timeout (a
// test that leaks a handle then hangs the run instead of failing).
// Usage: npm run status
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const name = "@jeroenwijnen98/standards";
const developer = join(homedir(), "Developer");
const root = join(import.meta.dirname, "..");

const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const latest = git("describe", "--tags", "--abbrev=0");
console.log(`latest: ${latest} (${git("rev-parse", "--short", `${latest}^{commit}`)})\n`);

for (const repo of readdirSync(developer).sort()) {
  const manifest = join(developer, repo, "package.json");
  if (!existsSync(manifest)) continue;
  const { dependencies = {}, devDependencies = {}, scripts = {} } = JSON.parse(readFileSync(manifest, "utf8"));
  const untimed = Object.entries(scripts as Record<string, string>)
    .filter(([, cmd]) => cmd.includes("node --test") && !cmd.includes("--watch") && !cmd.includes("--test-timeout"))
    .map(([script]) => script);
  const warning = untimed.length > 0 ? `  no --test-timeout: ${untimed.join(", ")}` : "";
  const spec: string | undefined = devDependencies[name] ?? dependencies[name];
  if (spec === undefined) {
    console.log(`${repo.padEnd(20)} -${warning}`);
    continue;
  }
  const lockfile = join(developer, repo, "package-lock.json");
  const resolved: string = existsSync(lockfile)
    ? (JSON.parse(readFileSync(lockfile, "utf8")).packages?.[`node_modules/${name}`]?.resolved ?? "")
    : "";
  const commit = resolved.split("#")[1]?.slice(0, 7) ?? "not installed";
  console.log(`${repo.padEnd(20)} ${spec.split("#")[1] ?? spec}  ${commit}${warning}`);
}
