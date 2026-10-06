# standards

Shared oxlint and tsconfig bases for the TypeScript repos in `~/Developer`. See README.md for layout and the release flow.

- Edit anti-slop in `oxlint/anti-slop/`, never in `dist/`; run `npm run build` after, and commit both.
- Every rule in `oxlint/base.js` has a violation in `test/fixtures/lint/violations.ts` that `npm test` asserts on. Add one with the rule.
- A change here reaches no repo until it is tagged and the repo bumps its dependency. Breaking changes (a new error-level rule) get a minor version bump while below 1.0.

## Agent skills

### Issue tracker

GitHub Issues on jeroenwijnen98/standards, via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
