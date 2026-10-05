# anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b (2026-09-10). Verified by diffing `src/` at that commit against this directory.
- Installed via the `install-anti-slop` skill (`scripts/install.mjs`) into grocer and stronger on 2026-10-04; moved here unchanged from stronger on 2026-10-06, so the repos share one copy.
- Paths: generic plugin `oxlint/anti-slop/index.ts`, shipped as `dist/anti-slop/index.js` (`npm run build`) and registered by `oxlint/base.js`. Effect plugin `effect/index.ts` copied but not registered (no repo depends on `effect`).
- Deviations: upstream `*.test.ts` files not copied (skill bundle omits them). No rule source changes. The base config enables only the 4 core rules (accumulating-spread, reduce-accumulator-copy, chained-type-assertions, widen-then-assert); the other 15 generic rules are vendored but off by choice.
