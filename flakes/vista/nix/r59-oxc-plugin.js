/**
 * Vista R59 oxlint plugin: no module-scope browser globals in review modules.
 *
 * Decision 0054 / requirement R59 (context/vista/03-authoring/requirements.md): a
 * review module must not touch a browser global (`document`, `window`, …) at
 * MODULE SCOPE; such access must live inside a component or effect so the
 * publish-time projection (R57) can evaluate the review under node without a
 * growing DOM shim, and the review's eager graph stays node-safe.
 *
 * The check is scope-aware: a reference to a browser global fires only when it has
 * NO enclosing function/component/effect ancestor. The exact same access nested
 * inside a component render or an effect body is allowed — that is R59's own
 * prescribed remedy ("move it into a component or effect"), so a scope-blind rule
 * (e.g. `no-restricted-globals`) would over-ban and contradict R59.
 *
 * Hosted here (under `flakes/vista/nix/`, which the repo's main `.oxlintrc.json`
 * ignores) and loaded via `jsPlugins` from the dedicated `r59-oxlint.json` config
 * whose ruleset has NO `overeng/*` rule, so the `oxlint-with-plugins` wrapper
 * passes `jsPlugins` through instead of clobbering it with the overeng plugin
 * path. Wired into `check:all` via the `check:vista-r59` devenv task.
 *
 * oxlint's `no-restricted-syntax` selector engine is a no-op in the pinned oxlint
 * (verified: even a universal selector never fires), so a custom rule is the only
 * way to get scope-aware enforcement here.
 *
 * NOTE: `any`-shaped nodes because the oxlint JS-plugin API has no TS defs yet
 * (same caveat as `@overeng/oxc-config`).
 */

// Browser-only globals. `globalThis` is deliberately EXCLUDED: it is a universal
// (node-safe) global, not browser-only, so flagging it would be a false positive.
const BROWSER_GLOBALS = new Set([
  'document',
  'window',
  'navigator',
  'localStorage',
  'sessionStorage',
  'location',
  'history',
])

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

/** True if `node` has any enclosing function/component/effect ancestor. */
const hasEnclosingFunction = (node) => {
  let p = node.parent
  while (p !== undefined && p !== null) {
    if (FUNCTION_TYPES.has(p.type)) return true
    p = p.parent
  }
  return false
}

/**
 * True if `node` is a bare identifier REFERENCE to a browser global (`document`),
 * not a same-named property (`foo.document`), object key, binding, or import.
 */
const isBrowserGlobalRef = (node) => {
  if (node.type !== 'Identifier') return false
  if (BROWSER_GLOBALS.has(node.name) === false) return false
  const p = node.parent
  if (p === undefined || p === null) return false
  // `x.document` — the identifier is the (non-computed) property, not a global ref.
  if (p.type === 'MemberExpression' && p.property === node && p.computed === false) return false
  // `{ document: … }` — object-literal key.
  if (p.type === 'Property' && p.key === node && p.computed === false) return false
  // `const document = …` — a local binding that shadows the global.
  if (p.type === 'VariableDeclarator' && p.id === node) return false
  // `(document) => …` — a parameter binding that shadows the global.
  if (FUNCTION_TYPES.has(p.type) && Array.isArray(p.params) && p.params.includes(node)) return false
  // Import bindings.
  if (p.type === 'ImportSpecifier' || p.type === 'ImportDefaultSpecifier') return false
  return true
}

/** ESLint-shaped oxlint rule: flag module-scope browser-global reads. */
const noModuleScopeBrowserGlobalsRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow module-scope access to browser globals in Vista review modules (R59)',
      recommended: false,
    },
    messages: {
      moduleScope:
        "Browser global '{{name}}' accessed at module scope in a review module; move it into a component or effect (Vista R59, decision 0054).",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Identifier(node) {
        if (isBrowserGlobalRef(node) === false) return
        if (hasEnclosingFunction(node) === true) return
        context.report({ node, messageId: 'moduleScope', data: { name: node.name } })
      },
    }
  },
}

const plugin = {
  meta: { name: 'vista', version: '0.1.0' },
  rules: { 'no-module-scope-browser-globals': noModuleScopeBrowserGlobalsRule },
}

export default plugin
