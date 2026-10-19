#!/usr/bin/env node
// Keeps a repo's generated Sandcastle files in step with its
// .sandcastle/config.ts and this version of the standards. Run it from the
// repo root.
//
//   sandcastle-setup sync           write .sandcastle/Dockerfile and
//                                   .env.example, add missing .gitignore lines
//   sandcastle-setup check          exit 1 when a generated file is stale
//   sandcastle-setup prompts <dir>  write the composed prompts to <dir>, to
//                                   read or diff them without a run

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENV_EXAMPLE, IGNORED, loadConfig, renderDockerfile, staleFiles, writePrompts } from "./compose.js";

const repo = process.cwd();
const dir = join(repo, ".sandcastle");
const [command, arg] = process.argv.slice(2);

if (command === "sync") {
  const config = await loadConfig(repo);
  writeFileSync(join(dir, "Dockerfile"), renderDockerfile(config));
  writeFileSync(join(dir, ".env.example"), ENV_EXAMPLE);
  const gitignore = join(dir, ".gitignore");
  const lines = existsSync(gitignore) ? readFileSync(gitignore, "utf8").split("\n").filter(Boolean) : [];
  const missing = IGNORED.filter((line) => !lines.includes(line));
  if (missing.length > 0) writeFileSync(gitignore, [...lines, ...missing, ""].join("\n"));
  const stale = await staleFiles(repo);
  if (stale.length > 0) throw new Error(`still stale after sync: ${stale.join(", ")}`);
  console.log("synced .sandcastle/");
} else if (command === "check") {
  const stale = await staleFiles(repo);
  if (stale.length > 0) {
    console.error(`stale: .sandcastle/${stale.join(", ")}; run \`npx sandcastle-setup sync\``);
    process.exit(1);
  }
} else if (command === "prompts" && arg) {
  const paths = writePrompts(repo, await loadConfig(repo), arg);
  console.log(Object.values(paths).join("\n"));
} else {
  console.error("usage: sandcastle-setup sync | check | prompts <dir>");
  process.exit(2);
}
