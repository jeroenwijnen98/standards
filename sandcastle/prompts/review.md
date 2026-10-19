# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the code use `GLOSSARY.md`'s terms, not the synonyms it says to avoid?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?
<!-- project: Review -->

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Follow `CODING_STANDARDS.md` if the repo has one, and `CLAUDE.md`.

6. **Preserve functionality**: a refinement changes how the code does something, never what it does. Changing behaviour is for bugs only, and only as **BUGS** below says.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. While refining, run only the tests you touch. Once done, run the full checks under FEEDBACK LOOPS a single time.
3. Commit describing the refinements

If the code is already clean and well-structured, do nothing.

# BUGS

This branch implements issue #{{TASK_ID}}. For every bug you find, ask: can you write a test that goes red on it without deciding what the right behaviour is? Then route it:

- **A defect in lines this branch added**: fix it here. Write the failing test first, then the fix, and commit it separately with a message starting `Fix:`.
- **A defect anywhere else**, already on `{{TARGET_BRANCH}}` before this branch: open an issue for it labelled `ready-for-agent`. Write it like the issues it sits beside: what is wrong, where (`file:line`), how it shows, the fix, and the test that pins it. Mention `#{{TASK_ID}}` in it.
- **A judgement call**, where the right behaviour depends on what the issue's author intended and the issue doesn't say: open an issue labelled `ready-for-human` that names the choice and the options, and mention `#{{TASK_ID}}` in it.

Create issues with `gh issue create --label <label> --title "..." --body-file -` and a heredoc. Name each issue you opened in your final message.

# FEEDBACK LOOPS

<!-- project: Checks -->

<!-- shared: check rules -->

Once complete, output <promise>COMPLETE</promise>.
