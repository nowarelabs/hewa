/**
 * Placeholder substitution.
 *
 * Templates use double-underscore tokens in file contents *and* in file and
 * directory names. Every token is a valid JavaScript identifier, so a
 * template still parses as TypeScript even though it is not valid on its own.
 */

/**
 * @param {string} value
 * @returns {string}
 */
function pascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * @param {string} value
 * @returns {string}
 */
function screamingSnakeCase(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

/**
 * @param {string} value
 * @returns {string}
 */
function titleCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Build the token table for one instance.
 *
 * @param {{ name: string, title: string, description: string, port: number }} instance
 * @returns {Record<string, string>}
 */
export function tokensFor(instance) {
  const { name, title, description, port } = instance;
  const className = pascalCase(name);
  return {
    __NAME__: name,
    __CLASS__: className,
    __PACKAGE__: `@hewa/${name}`,
    __TITLE__: title,
    __DESCRIPTION__: description,
    __PORT__: String(port),
    __ENV_PREFIX__: screamingSnakeCase(name),
    // Human-readable sentence form, for prose in a template.
    __TITLE_LOWER__: titleCase(name).toLowerCase(),
  };
}

/**
 * @param {string} contents
 * @param {Record<string, string>} tokens
 * @returns {string}
 */
export function substitute(contents, tokens) {
  // Lazy, so the shortest closing `__` wins. A template may run a token
  // straight into more identifier characters — `__ENV_PREFIX___PORT` is the
  // token `__ENV_PREFIX__` followed by `_PORT` — and a greedy match would
  // swallow that suffix and silently leave the placeholder unresolved.
  return contents.replace(/__[A-Z][A-Z0-9_]*?__/g, (token) => tokens[token] ?? token);
}

/**
 * @param {string} value
 * @param {Record<string, string>} tokens
 * @returns {string}
 */
export function substituteName(value, tokens) {
  return substitute(value, tokens);
}
