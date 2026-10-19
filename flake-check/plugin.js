// The `flake` oxlint plugin: the two shapes most of the flaky tests in these
// repos had in common, a real wait and a reading of the real clock. Only
// `flake-check` enables it, on the test lines a branch adds; see cli.js.

import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

const TIMERS = new Set(["setTimeout", "setInterval"]);
const PROMISE_TIMERS = new Set(["node:timers/promises", "timers/promises"]);

/** @param {import("@oxlint/plugins").ESTree.Node} node */
const calleeName = (node) => {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && node.property.type === "Identifier") return node.property.name;
  return null;
};

/** `mock.timers.setTimeout` and `t.mock.timers…` run on a fake clock. */
const onFakeClock = (callee) =>
  callee.type === "MemberExpression" && calleeName(callee.object) === "timers";

/**
 * The delay a timer call waits: `setTimeout(fn, ms)`, or `setTimeout(ms)` from
 * `node:timers/promises`. `setTimeout(resolve)` waits no time at all.
 */
const delayOf = (args) => {
  const [first, second] = args;
  if (first === undefined) return null;
  const callback = ["ArrowFunctionExpression", "FunctionExpression", "Identifier", "MemberExpression"];
  if (callback.includes(first.type)) return second ?? null;
  return first;
};

const isZero = (node) => node.type === "Literal" && node.value === 0;

const noSleep = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow real waits in tests." },
    messages: {
      sleep:
        "A real wait races the work it waits for once the machine is busy. Use `mock.timers`, or await the event, response or state change itself.",
    },
  },
  createOnce(context) {
    // Local names of `setTimeout` from `node:timers/promises`, such as `sleep`.
    let promised = new Set();
    return {
      before() {
        promised = new Set();
      },
      ImportDeclaration(node) {
        if (!PROMISE_TIMERS.has(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && TIMERS.has(specifier.imported.name)) {
            promised.add(specifier.local.name);
          }
        }
      },
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (node.callee.type === "Identifier" && promised.has(name)) {
          const [delay] = node.arguments;
          if (delay !== undefined && !isZero(delay)) context.report({ node, messageId: "sleep" });
          return;
        }
        if (!TIMERS.has(name) || onFakeClock(node.callee)) return;
        const delay = delayOf(node.arguments);
        if (delay !== null && !isZero(delay)) context.report({ node, messageId: "sleep" });
      },
    };
  },
});

const noWallClock = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow reading the real clock in tests." },
    messages: {
      clock:
        "The real clock makes a test depend on load, the time of day and the time zone. Inject a clock, or use `mock.timers` with `apis: ['Date']`; measure speed by counting work, not milliseconds.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
        const owner = calleeName(callee.object);
        const method = callee.property.name;
        if ((owner === "performance" || owner === "Date") && method === "now") {
          context.report({ node, messageId: "clock" });
        }
        if (owner === "hrtime" || (owner === "process" && method === "hrtime")) {
          context.report({ node, messageId: "clock" });
        }
      },
      NewExpression(node) {
        if (calleeName(node.callee) === "Date" && node.arguments.length === 0) {
          context.report({ node, messageId: "clock" });
        }
      },
    };
  },
});

export default eslintCompatPlugin({
  meta: { name: "flake" },
  rules: { "no-sleep": noSleep, "no-wall-clock": noWallClock },
});
