/** A repo's `.sandcastle/config.ts` default export. */
export interface SandcastleConfig {
  image: {
    /** Node major version, e.g. "26": the `node:<v>-bookworm` base image. */
    node: string;
    /** Python version, e.g. "3.12": a python base image, Node copied in. */
    python?: string;
    /** Extra apt packages beyond git, curl and jq. */
    apt?: string[];
    /** Playwright version, as in @playwright/test: Chromium and its libs. */
    playwright?: string;
    /** Raw Dockerfile lines run as root, before the agent user exists. */
    root?: string;
    /** Raw Dockerfile lines run as the agent, after Claude Code. */
    agent?: string;
  };
  /**
   * Commands run in each sandbox once it is ready, and by the merger after a
   * merge that touched one of the `when` files.
   */
  install: { command: string; when: string[] }[];
  /** Issue pipelines at once (default 3: more starve each other). */
  maxParallel?: number;
  /** plan → implement → merge rounds before stopping (default 10). */
  maxIterations?: number;
  /** Model for every agent (default claude-opus-5-5). */
  model?: string;
}

export function runSandcastle(config: SandcastleConfig): Promise<void>;
