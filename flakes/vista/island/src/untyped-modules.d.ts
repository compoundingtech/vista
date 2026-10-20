// Runtime dependencies of the vendored trace view that ship no declarations.
// Upstream Grafana types them via @types packages that are not part of this
// island's closure; the vendored call sites only need them as untyped imports.
declare module 'memoize-one'
declare module 'tinycolor2'
declare module '*/jsonMarkup'
