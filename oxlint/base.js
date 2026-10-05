// The base every TypeScript repo extends from its own oxlint.config.ts.
//
// `extends` carries rules and plugins but not ignorePatterns, so those are a
// separate export the repo spreads into its own list.

export const ignorePatterns = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  ".sandcastle/**",
  ".playwright-mcp/**",
];

export default {
  jsPlugins: [
    { name: "anti-slop", specifier: new URL("../dist/anti-slop/index.js", import.meta.url).pathname },
  ],
  rules: {
    "no-nested-ternary": "error",
    "no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    "oxc/no-accumulating-spread": "error",
    "anti-slop/no-reduce-accumulator-copy": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-widen-then-assert": "error",
  },
};
