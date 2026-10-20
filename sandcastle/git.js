import { spawnSync } from "node:child_process";

/**
 * Commits on `branch` that the host's current branch lacks, by patch rather
 * than ancestry (a cherry-picked commit is not counted), merges left out; 0
 * when the branch does not exist.
 * @param {string} repo
 * @param {string} branch
 */
export function commitsAhead(repo, branch) {
  const range = `HEAD...refs/heads/${branch}`;
  const args = ["rev-list", "--count", "--no-merges", "--cherry-pick", "--right-only", range];
  const out = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  return out.status === 0 ? Number(out.stdout.trim()) : 0;
}
