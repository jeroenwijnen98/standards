import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { composePrompt, loadConfig, parseProject, renderDockerfile } from "../sandcastle/compose.js";

const root = join(import.meta.dirname, "..");
const cli = join(root, "sandcastle/cli.js");

// A copy of the fixture repo, so sync can write into it.
function fixture() {
  const repo = mkdtempSync(join(tmpdir(), "standards-sandcastle-"));
  cpSync(join(root, "test/fixtures/sandcastle"), repo, { recursive: true });
  return repo;
}

const setup = (repo: string, ...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8" });

test("sync writes the generated files, and check passes until one drifts", () => {
  const repo = fixture();
  assert.equal(setup(repo, "check").status, 1, "check before sync");
  assert.equal(setup(repo, "sync").status, 0);
  assert.equal(setup(repo, "check").status, 0);

  writeFileSync(join(repo, ".sandcastle/Dockerfile"), "FROM scratch\n");
  const stale = setup(repo, "check");
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /Dockerfile/);
});

test("the Dockerfile builds on Python with Node copied in when image.python is set", async () => {
  const dockerfile = renderDockerfile(await loadConfig(fixture()));
  assert.match(dockerfile, /^FROM node:26-bookworm-slim AS node$/m);
  assert.match(dockerfile, /^FROM python:3\.12-bookworm$/m);
  assert.match(dockerfile, /^  sqlite3 \\$/m);
  assert.match(dockerfile, /^ARG PLAYWRIGHT_VERSION=1\.63\.0$/m);
  assert.ok(dockerfile.indexOf("ENV FIXTURE=1") > dockerfile.indexOf("claude.ai/install.sh"));
});

test("the prompts carry the project's sections, check rules and reinstall step", async () => {
  const repo = fixture();
  const config = await loadConfig(repo);
  const project = parseProject(readFileSync(join(repo, ".sandcastle/project.md"), "utf8"));

  const implement = composePrompt("implement", config, project);
  assert.match(implement, /Never call the live API\./);
  assert.match(implement, /`npm test` must pass\./);
  assert.match(implement, /never start a test run while another/);
  assert.match(implement, /titled `Flaky: <test name>`/);
  assert.doesNotMatch(implement, /<!--/);

  const review = composePrompt("review", config, project);
  assert.match(review, /^ {3}- Does every API call go through/m);
  assert.match(review, /npx flake-check \{\{TARGET_BRANCH\}\}/);
  const merge = composePrompt("merge", config, project);
  assert.match(merge, /touched `requirements.txt`, run `pip install --user -r requirements.txt`/);
  assert.match(merge, /touched `package-lock.json`, run `npm ci/);
});

test("project.md must have Checks and no unknown section", () => {
  assert.throws(() => parseProject("## Context\n\nx\n"), /Checks section is required/);
  assert.throws(() => parseProject("## Checks\n\nx\n\n## Contxt\n\ny\n"), /unknown section "## Contxt"/);
});
