# standards

The lint and type-check rules shared by the TypeScript repos in `~/Developer`.
A repo installs a tagged version as a dev dependency, extends the shared base
and adds its own rules on top. A rule added here reaches a repo when it bumps
the tag.

```
npm i -D github:jeroenwijnen98/standards#v0.1.0
```

## What's here

| Path | What |
|---|---|
| `oxlint/base.js` | Base oxlint config: rules plus the anti-slop plugin. `ignorePatterns` is a separate export, because `extends` does not carry it. |
| `oxlint/anti-slop/` | Vendored [anti-slop](https://github.com/dmmulroy/anti-slop) source, see `UPSTREAM.md`. |
| `dist/anti-slop/` | The same plugin with its types stripped (`npm run build`). Node won't strip types under `node_modules`, so this is what repos load. Committed; `npm test` fails when stale. |
| `tsconfig/base.json` | strict, noEmit, and the flags for Node's type stripping: `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`. |
| `tsconfig/node.json` | base + `nodenext`, for a server or script Node runs directly. |
| `tsconfig/bundler.json` | base + `bundler` resolution and the DOM, for an esbuild-built browser app. |
| `.github/workflows/node-test.yml` | Reusable CI job: `npm ci`, `npm test`. |

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

## Changing a rule

1. Change it here, `npm test`, commit, tag the next version (`git tag v0.2.0`), push with tags.
2. Bump one repo (`npm i -D github:jeroenwijnen98/standards#v0.2.0`), fix what breaks, then the rest.
3. `npm run status` lists the version each repo in `~/Developer` is on, and any `node --test` script missing `--test-timeout`.

A rule belongs here when every repo should have it. A rule for one repo, or one
stack, stays in that repo's config.

## Updating anti-slop

Run the `install-anti-slop` skill against `oxlint/anti-slop/` in this repo, then
`npm run build`.

After cloning: `npm install && npm run hooks` (pre-commit runs `npm test`).
