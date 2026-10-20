/**
 * Ambient type for pinned `esm.sh` imports (VST-R65 / decision 0059). An app reaches
 * any dependency not in the exposed `vista-deps` closure through a pinned
 * `https://esm.sh/<pkg>@<version>` URL, which Vite/the browser resolves at serve
 * time — the same opaque, bundler-resolved module class as `*.css`, invisible to
 * tsc's NodeNext resolver. This declaration lets such an import typecheck; the
 * module is `unknown` because esm.sh serves arbitrary packages, so the author
 * narrows the default at the use site.
 *
 * tsc is never the esm.sh gate: the import classifier rejects unpinned/unknown
 * specifiers (`runtime-policy/import-classifier.ts`) and the publish-time render
 * proof catches a broken import — the opacity here is by design, not a hole.
 */
declare module 'https://esm.sh/*' {
  const mod: unknown
  export default mod
}
