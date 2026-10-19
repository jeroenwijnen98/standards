// The config `flake-check` lints with: the flake plugin alone.
export default {
  jsPlugins: [{ name: "flake", specifier: new URL("./plugin.js", import.meta.url).pathname }],
  rules: { "flake/no-sleep": "error", "flake/no-wall-clock": "error" },
};
