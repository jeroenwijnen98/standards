# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
<!-- shared: reinstall -->
4. Then run the full checks under FEEDBACK LOOPS once.
5. If a check fails, fix the issues before proceeding to the next branch

Each `git merge` makes its own merge commit (after resolving a conflict, `git commit --no-edit`
makes it), so once the last branch is merged there is nothing left to commit.

# FEEDBACK LOOPS

<!-- project: Checks -->

<!-- shared: check rules -->

# CLOSE ISSUES

For each branch that was merged, close its issue using the following command:

`gh issue close <ID> --comment "Completed by Sandcastle"`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
