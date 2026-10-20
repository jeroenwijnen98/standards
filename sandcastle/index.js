// The Sandcastle loop every repo runs: plan → implement + review → merge,
// repeated until no unblocked issue is left. A repo's .sandcastle/main.mts is
// `await runSandcastle(config)`; what differs per repo lives in config.ts and
// project.md (see compose.js).
//
//   Plan:      an agent reads the ready-for-agent issues, builds a dependency
//              graph and outputs a <plan> of the unblocked ones, each with a
//              deterministic branch name.
//   Implement: per issue, a sandbox on that branch. The implementer runs
//              (up to 100 iterations); if it committed, or the branch still
//              holds unmerged commits from an earlier run, a reviewer runs in
//              the same sandbox. maxParallel issues at a time.
//   Merge:     one agent merges every such branch into the current branch
//              and closes the issues.

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { z } from "zod";
import { staleFiles, withDefaults, writePrompts } from "./compose.js";
import { commitsAhead } from "./git.js";

const planSchema = z.object({
  issues: z.array(z.object({ id: z.string(), title: z.string(), branch: z.string() })),
});

// A one-iteration agent can end its turn before it is done: a command that
// outlives the Bash timeout moves to the background, the agent says it will be
// notified, and the session ends with its work uncommitted. Resume the session
// once to let it finish. One that still does not signal completion is listed
// at the end, and the run exits 1 so sandcastle-night reports it.
const RESUME_PROMPT =
  "Your turn ended before you output the completion signal, which stopped any " +
  "command still running in the background. Check `git status` and `git log`, " +
  "finish the remaining steps with every command in the foreground, then " +
  "output the completion signal.";

/**
 * Promise.allSettled over `items`, with at most `limit` running at a time.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<PromiseSettledResult<R>[]>}
 */
async function settleInPool(items, limit, fn) {
  /** @type {PromiseSettledResult<R>[]} */
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/** @param {import("./index.d.ts").SandcastleConfig} input */
export async function runSandcastle(input) {
  const repo = process.cwd();
  const config = withDefaults(input);
  const prompts = writePrompts(repo, config);
  const agent = () => sandcastle.claudeCode(config.model);

  const stale = await staleFiles(repo);
  if (stale.length > 0) {
    console.warn(`! .sandcastle/${stale.join(", ")} out of date: run \`npx sandcastle-setup sync\``);
  }

  // Install the repo's dependencies in each sandbox, so the checks the agents
  // run have what they need. Not --quiet: an install that fails here is
  // otherwise invisible, and the agent meets it later as an import error it
  // did not cause. The planner only reads issues, so it goes without.
  const hooks = {
    sandbox: {
      onSandboxReady: config.install.map(({ command }) => ({ command, timeoutMs: 300_000 })),
    },
  };

  /** @type {string[]} */
  const incomplete = [];
  /**
   * @template {{ completionSignal?: string, commits: { sha: string }[], resume?: (prompt: string) => Promise<any> }} R
   * @param {R} result
   * @param {string} label
   * @returns {Promise<R>}
   */
  const finished = async (result, label) => {
    let done = result;
    if (done.completionSignal === undefined && done.resume) {
      console.warn(`  ! ${label} stopped without completing; resuming it once`);
      const more = await done.resume(RESUME_PROMPT);
      done = { ...more, commits: [...done.commits, ...more.commits] };
    }
    if (done.completionSignal === undefined) incomplete.push(label);
    return done;
  };

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    console.log(`\n=== Iteration ${iteration}/${config.maxIterations} ===\n`);

    const plan = await sandcastle.run({
      sandbox: docker(),
      name: "planner",
      // Structured output requires maxIterations: 1.
      maxIterations: 1,
      agent: agent(),
      promptFile: prompts.plan,
      output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
    });

    const issues = plan.output.issues;
    if (issues.length === 0) {
      console.log("No unblocked issues to work on. Exiting.");
      break;
    }
    console.log(`Planning complete. ${issues.length} issue(s) to work in parallel:`);
    for (const issue of issues) console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);

    // The implementer and reviewer of one issue share a sandbox. Like
    // Promise.allSettled, one failing pipeline doesn't cancel the others.
    const settled = await settleInPool(issues, config.maxParallel, async (issue) => {
      const sandbox = await sandcastle.createSandbox({ branch: issue.branch, sandbox: docker(), hooks });
      try {
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: agent(),
          promptFile: prompts.implement,
          promptArgs: { TASK_ID: issue.id, ISSUE_TITLE: issue.title, BRANCH: issue.branch },
        });
        // A branch can hold finished work from an earlier run whose merge never
        // happened (a spend limit, a crash). The implementer then finds nothing
        // to do and commits nothing; without this the branch is skipped every
        // run while its issue stays open.
        const stranded = implement.commits.length === 0 && commitsAhead(repo, issue.branch) > 0;
        if (implement.commits.length === 0 && !stranded) return implement;
        if (stranded) console.log(`  ${issue.id}: ${issue.branch} has unmerged commits from an earlier run`);

        const review = await finished(
          await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: agent(),
            promptFile: prompts.review,
            promptArgs: { TASK_ID: issue.id, BRANCH: issue.branch },
          }),
          `${issue.id} reviewer`,
        );
        // Each sandbox.run() returns only its own commits.
        return { ...review, commits: [...implement.commits, ...review.commits], stranded };
      } finally {
        await sandbox.close();
      }
    });

    for (const [i, outcome] of settled.entries()) {
      if (outcome.status === "rejected") {
        console.error(`  ✗ ${issues[i].id} (${issues[i].branch}) failed: ${outcome.reason}`);
      }
    }

    const completed = issues.filter((_, i) => {
      const outcome = settled[i];
      return outcome.status === "fulfilled" && (outcome.value.commits.length > 0 || outcome.value.stranded);
    });
    console.log(`\nExecution complete. ${completed.length} branch(es) with commits:`);
    for (const issue of completed) console.log(`  ${issue.branch}`);
    if (completed.length === 0) {
      console.log("No commits produced. Nothing to merge.");
      continue;
    }

    // merge-to-head, not the bind-mount default of head: in head the container
    // works in the host checkout, and its install would swap the host's
    // node_modules for Linux binaries.
    await finished(
      await sandcastle.run({
        sandbox: docker(),
        name: "merger",
        branchStrategy: { type: "merge-to-head" },
        hooks,
        maxIterations: 1,
        agent: agent(),
        promptFile: prompts.merge,
        promptArgs: {
          BRANCHES: completed.map((i) => `- ${i.branch}`).join("\n"),
          ISSUES: completed.map((i) => `- ${i.id}: ${i.title}`).join("\n"),
        },
      }),
      "merger",
    );
    console.log("\nBranches merged.");
  }

  console.log("\nAll done.");
  if (incomplete.length > 0) {
    console.error(`\n✗ Stopped without completing: ${incomplete.join(", ")}`);
    process.exitCode = 1;
  }
}
