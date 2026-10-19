import type { SandcastleConfig } from "@jeroenwijnen98/standards/sandcastle";

export default {
  image: { node: "26", python: "3.12", apt: ["sqlite3"], playwright: "1.63.0", agent: "ENV FIXTURE=1" },
  install: [
    { command: "pip install --user -r requirements.txt", when: ["requirements.txt"] },
    { command: "npm ci --no-audit --no-fund", when: ["package-lock.json"] },
  ],
} satisfies SandcastleConfig;
