// Comment width, enforced instead of remembered.
//
// Rewrapping comments was the Sandcastle reviewer's most common commit in
// every repo, and each repo grew its own copy of a test to stop it. The repos
// agree on the measurement: comments that wrap sit at 80 columns (95th
// percentile 80 wherever it was measured), while a comment on one line of its
// own has nothing to wrap against and runs longer. So a comment that spans
// lines wraps at 80, and a one-line comment fits in a width the repo picks.
// A comment after code is the code's width, not a comment's.
//
// What cannot be wrapped may run past the limit: a tool directive, a JSDoc
// tag holding only its type and name, and a URL that crosses the limit and
// ends the line. Prose after any of them still counts.
//
// Plain JavaScript: Node won't strip types under node_modules.

/** The width a comment that runs over more than one line wraps at. */
export const WRAPPED = 80;

/** The files that hold comments a repo writes itself. */
export const SOURCE = /(\.(ts|mts|cts|js|mjs|cjs|css|html|sql)|tsconfig[\w.-]*\.json)$/;

/** The comments that run to an end mark: `/* *\/` and `<!-- -->`. */
const BLOCKS = [
  { open: "/*", close: "*/" },
  { open: "<!--", close: "-->" },
];
/** The comments that run to the end of the line: SQL's, and elsewhere `//`. */
const SQL_LINE = /^--/;
const SLASHES = /^\/\//;

/** A comment that tells a tool what to do, which has to stay on its line. */
const DIRECTIVE = /^\s*(\/\/|\/\*\*?|\*)\s*(oxlint-|eslint-|@ts-expect-error|@ts-ignore)/;

/** The start of a JSDoc tag with a type, up to the type's opening brace. */
const TYPED_TAG = /^\s*(\/\*\*|\*)\s*@(\w+)\s*\{/;
/** A name after the type: `name`, `[name]` or `[name=default]`. */
const TAG_NAME = /^\s*(\[[^\]]*\]|[\w$.]+)/;

/** A URL that ends the line, but for closing marks. */
const URL_TAIL = /https?:\/\/\S*?[\s)\]>.,;:'"`]*(\*\/|-->)?\s*$/;

/** @typedef {"wrapped" | "one-line" | null} CommentKind */

/**
 * Columns as an editor counts them: a character outside the BMP (an emoji,
 * say) is one, not its UTF-16 length.
 * @param {string} text
 */
const columns = (text) => Array.from(text).length;

/**
 * Each comment line in `text` too wide, as `line: why`, 1-based. `path` picks
 * the line-comment mark: `--` in SQL, `//` everywhere else.
 * @param {string} path
 * @param {string} text
 * @param {number} oneLine The width of a comment on one line of its own.
 * @returns {string[]}
 */
export function tooWide(path, text, oneLine) {
  const lines = text.split("\n");
  const kinds = commentKinds(lines, path.endsWith(".sql") ? SQL_LINE : SLASHES);
  /** @type {string[]} */
  const complaints = [];
  lines.forEach((line, i) => {
    const kind = kinds[i];
    if (kind === null) return;
    const limit = kind === "wrapped" ? WRAPPED : oneLine;
    if (columns(line) <= limit || unwrappable(line, limit)) return;
    complaints.push(`${i + 1}: ${columns(line)} columns, over ${limit} for a ${kind} comment`);
  });
  return complaints;
}

/**
 * For each line, whether it is part of a comment that wraps, a comment on one
 * line of its own, or neither. A block comment wraps when it spans lines; line
 * comments wrap when two or more follow one another.
 * @param {string[]} lines
 * @param {RegExp} lineMark
 * @returns {CommentKind[]}
 */
function commentKinds(lines, lineMark) {
  /** @type {CommentKind[]} */
  const kinds = lines.map(() => null);
  /** @param {number} i */
  const lineComment = (i) => lineMark.test(lines[i]?.trimStart() ?? "");
  /** @type {string | null} */
  let closing = null;
  lines.forEach((line, i) => {
    const trimmed = line.trimStart();
    if (closing !== null) {
      kinds[i] = "wrapped";
      if (line.includes(closing)) closing = null;
      return;
    }
    const block = BLOCKS.find(({ open }) => trimmed.startsWith(open));
    if (block !== undefined) {
      if (trimmed.includes(block.close, block.open.length)) {
        kinds[i] = "one-line";
      } else {
        kinds[i] = "wrapped";
        closing = block.close;
      }
    } else if (lineComment(i)) {
      kinds[i] = lineComment(i - 1) || lineComment(i + 1) ? "wrapped" : "one-line";
    }
  });
  return kinds;
}

/**
 * @param {string} line
 * @param {number} limit
 */
function unwrappable(line, limit) {
  if (DIRECTIVE.test(line) || onlyTypeAndName(line)) return true;
  const url = URL_TAIL.exec(line);
  return url !== null && columns(line.slice(0, url.index)) <= limit;
}

/**
 * Whether the line is a JSDoc tag with nothing but its type and, for a tag
 * that names something, the name: `@param {Type} name`, `@returns {Type}`.
 * @param {string} line
 */
function onlyTypeAndName(line) {
  const tag = TYPED_TAG.exec(line);
  if (tag === null) return false;
  let depth = 1;
  let i = tag[0].length;
  for (; i < line.length && depth > 0; i++) {
    if (line[i] === "{") depth++;
    else if (line[i] === "}") depth--;
  }
  if (depth > 0) return false;
  let rest = line.slice(i);
  if (!["returns", "return", "type", "satisfies"].includes(tag[2])) rest = rest.replace(TAG_NAME, "");
  return rest.replace(/\*\/\s*$/, "").trim() === "";
}
