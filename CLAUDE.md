# standards

Shared oxlint and tsconfig bases for the TypeScript repos in `~/Developer`. See README.md for layout and the release flow.

- Edit anti-slop in `oxlint/anti-slop/`, never in `dist/`; run `npm run build` after, and commit both.
- Every rule in `oxlint/base.js` has a violation in `test/fixtures/lint/violations.ts` that `npm test` asserts on. Add one with the rule.
- A change here reaches no repo until it is tagged and the repo bumps its dependency. Breaking changes (a new error-level rule) get a minor version bump while below 1.0.
