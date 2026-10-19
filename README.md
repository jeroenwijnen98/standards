# standards

The lint and type-check rules shared by the TypeScript repos in `~/Developer`.
A repo installs a tagged version as a dev dependency, extends the shared base
and adds its own rules on top. A rule added here reaches a repo when it bumps
the tag.

```
npm i -D github:jeroenwijnen98/standards#v0.4.1
```

## What's here

| Path | What |
|---|---|
| `oxlint/base.js` | Base oxlint config: rules plus the anti-slop plugin. `ignorePatterns` is a separate export, because `extends` does not carry it. |
| `oxlint/anti-slop/` | Vendored [anti-slop](https://github.com/dmmulroy/anti-slop) source, see `UPSTREAM.md`. |
| `dist/anti-slop/` | The same plugin with its types stripped (`npm run build`). Node won't strip types under `node_modules`, so this is what repos load. Committed; `npm test` fails when stale. |
| `comment-width/` | The `comment-width` command: comments that wrap stay within 80 columns, a one-line comment within a width the repo picks. oxlint has no comments-only max-len. |
| `flake-check/` | The `flake-check` command: the real waits (`setTimeout` with a delay) and real-clock readings (`Date.now()`, `performance.now()`, `new Date()`) a branch adds to its tests. The Sandcastle reviewer runs it; it reads only added lines, so the repos' existing waits don't block anything. |
| `hooks/checked-tree` | The `checked-tree` command: stamps the tree a full check passed on, so the pre-commit hook skips re-running it there. Hands the check no `GIT_*`. |
| `tsconfig/base.json` | strict, noEmit, and the flags for Node's type stripping: `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`. |
| `tsconfig/node.json` | base + `nodenext`, for a server or script Node runs directly. |
| `tsconfig/bundler.json` | base + `bundler` resolution and the DOM, for an esbuild-built browser app. |
| `.github/workflows/node-test.yml` | Reusable CI job: `npm ci`, `npm test`. |
| `sandcastle/` | The Sandcastle loop every repo runs (plan → implement + review → merge), its prompt templates, and the `sandcastle-setup` command that writes a repo's Dockerfile. See below. |

## Using it in a repo

`oxlint.config.ts` (a `.oxlintrc.json` can't import a package):

```ts
import { defineConfig } from "oxlint";
import base, { ignorePatterns } from "@jeroenwijnen98/standards/oxlint";

export default defineConfig({
  extends: [base],
  ignorePatterns: [...ignorePatterns, "src/data/**"],
  rules: {
    // Rules for this repo only. A base rule turned off here says why.
  },
});
```

The repo also needs `oxlint` and `@oxlint/plugins` as dev dependencies, at the
versions in this `package.json`'s `peerDependencies`.

`package.json`'s lint script runs `comment-width` beside oxlint. It checks the
TS, JS, CSS, HTML, SQL and tsconfig files git knows about, skipping the
`ignorePatterns` folders:

```json
"lint": "oxlint --deny-warnings && comment-width --one-line 100 --skip test/fixtures/"
```

`--one-line` defaults to 80; `--skip` takes a folder not written here.

The pre-commit hook and the test script go through `checked-tree`:

```sh
# .githooks/pre-commit
cd "$(git rev-parse --show-toplevel)" || exit 1
exec node_modules/.bin/checked-tree hook npm test --silent
```

```json
"test": "checked-tree run npm run --silent check"
```

`tsconfig.json`:

```jsonc
{
  "extends": "@jeroenwijnen98/standards/tsconfig/node.json",
  "include": ["server.ts", "src", "test"]
}
```

Every `node --test` script passes `--test-timeout=300000`, so a test that
leaks a server or timer fails after 5 minutes instead of hanging the run.
`npm run status` lists the scripts that don't.

`.github/workflows/test.yml`, pinned to a commit (GitHub's advice; a tag can move):

```yaml
on: [push, pull_request]
jobs:
  test:
    uses: jeroenwijnen98/standards/.github/workflows/node-test.yml@<commit>
```

## Sandcastle

A repo's `.sandcastle/` holds three hand-written files; everything else comes
from here, so a fix to the loop or a prompt reaches every repo on its next bump.

| File | What |
|---|---|
| `main.mts` | `await runSandcastle(config)`. The nightly run finds repos by this file. |
| `config.ts` | The image (Node version, Python, apt packages, Playwright, raw Dockerfile lines) and the install commands, typed by `SandcastleConfig`. |
| `project.md` | What only this repo's prompts say, as `## ` sections: `Context`, `Execution`, `Checks` (required), `Review`, `Host only`. |

```ts
// .sandcastle/main.mts
import { runSandcastle } from "@jeroenwijnen98/standards/sandcastle";
import config from "./config.ts";

await runSandcastle(config);
```

```ts
// .sandcastle/config.ts
import type { SandcastleConfig } from "@jeroenwijnen98/standards/sandcastle";

export default {
  image: { node: "26" },
  install: [{ command: "npm ci --no-audit --no-fund", when: ["package.json", "package-lock.json"] }],
} satisfies SandcastleConfig;
```

The repo needs `@ai-hero/sandcastle` and `zod` as dependencies, and
`"sandcastle": "npx tsx .sandcastle/main.mts"` in its scripts. A CommonJS repo also
needs `.sandcastle/package.json` with `{"type": "module"}`, or the runner gets
`{ default: config }`.

`npx sandcastle-setup sync` writes `Dockerfile` and `.env.example` from
`config.ts` and adds missing `.gitignore` lines; commit them, since
`sandcastle docker build-image` and the nightly run read them from disk. Run it
after changing `config.ts` and after bumping this package. `sandcastle-setup
check` exits 1 when they are stale, the runner warns, and `npm run status` lists
it. `sandcastle-setup prompts <dir>` writes the composed prompts to read them;
each run also leaves them in `.sandcastle/logs/prompts/`.

The `sandcastle-setup` skill in claude-setup (which drives this command) sets a repo up, or moves an old
copied setup onto this one.

## Changing a rule

1. Change it here, `npm test`, commit, tag the next version (`git tag v0.2.0`), push with tags.
2. Bump one repo (`npm i -D github:jeroenwijnen98/standards#v0.3.0`), fix what breaks, then the rest.
3. `npm run status` lists the version each repo in `~/Developer` is on, and any `node --test` script missing `--test-timeout`.

A rule belongs here when every repo should have it. A rule for one repo, or one
stack, stays in that repo's config.

## Updating anti-slop

Run the `install-anti-slop` skill against `oxlint/anti-slop/` in this repo, then
`npm run build`.

After cloning: `npm install && npm run hooks` (pre-commit runs `npm test`).
