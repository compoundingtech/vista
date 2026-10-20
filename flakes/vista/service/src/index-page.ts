/**
 * The app index (decision 0028, Q6=A). Server-rendered HTML listing every
 * app — slug, latest version, the status line (N locked · M open · K awaiting
 * sign-off), template, and last-updated — each linking to its `latest`. Retired
 * apps are shown distinctly (durable links survive, decision 0004).
 *
 * Plain HTML (no client JS): the index is a directory, not a app surface, and
 * stays cheap to render from the disk-rebuilt registry (SVC-R18). A richer gallery
 * (search/filter) is a deferred enhancement (decision 0028).
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { encodeRouteOwner } from './control.ts'
import { latestMeta, versionDir, type AppState, type StatusCounts } from './registry.ts'

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

const statusLine = (s: StatusCounts | undefined): string => {
  if (!s) return '<span class="muted">—</span>'
  const parts: string[] = []
  if (s.locked) parts.push(`${s.locked} locked`)
  if (s.open) parts.push(`${s.open} open`)
  if (s.awaiting) parts.push(`${s.awaiting} awaiting sign-off`)
  return parts.length ? esc(parts.join(' · ')) : '<span class="muted">settled</span>'
}

const fmtDate = (iso: string | undefined): string => {
  if (!iso) return '<span class="muted">—</span>'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '<span class="muted">—</span>'
    : esc(d.toISOString().slice(0, 16).replace('T', ' '))
}

const row = (st: AppState): string => {
  const meta = latestMeta(st)
  const slug = esc(st.slug)
  const ver = st.latest !== null ? `v${st.latest}` : '—'
  const title = meta?.title ? esc(meta.title) : slug
  const template = meta?.template ? esc(meta.template) : '<span class="muted">—</span>'
  const identity = `${encodeRouteOwner(st.owner)}/${slug}`
  const href = st.latest !== null ? `/r/${identity}/latest` : '#'
  const cls = st.retired ? ' class="retired"' : ''
  const badge = st.retired ? ' <span class="badge">retired</span>' : ''
  const thumbnail =
    st.latest !== null &&
    existsSync(join(versionDir(st.owner, st.slug, st.latest), 'thumbnail.png'))
      ? `<img class="thumbnail" src="/r/${identity}/v${st.latest}/_thumbnail.png" width="128" height="80" loading="lazy" alt="" />`
      : '<span class="thumbnail thumbnail-placeholder" role="img" aria-label="No preview available">No preview</span>'
  return `<tr${cls}>
    <td><div class="app-cell">${thumbnail}<div><a href="${href}">${title}</a>${badge}<div class="slug">${slug}</div></div></div></td>
    <td>${esc(ver)}</td>
    <td>${template}</td>
    <td>${statusLine(meta?.status)}</td>
    <td>${fmtDate(meta?.timestamp)}</td>
  </tr>`
}

/**
 * Renders the index page HTML listing every app sorted active-before-retired and then by most
 * recent update timestamp, substituting an empty-state row when no apps are published.
 */
export const renderIndex = (apps: Map<string, AppState>): string => {
  const all = [...apps.values()].toSorted((a, b) => {
    // Active first, then retired; within each, most-recently-updated first.
    if (a.retired !== b.retired) return a.retired ? 1 : -1
    const ta = latestMeta(a)?.timestamp ?? ''
    const tb = latestMeta(b)?.timestamp ?? ''
    return tb.localeCompare(ta)
  })
  const rows = all.length
    ? all.map(row).join('\n')
    : `<tr><td colspan="5" class="muted">No apps yet. Publish one with <code>vista publish &lt;slug&gt; -m "…"</code>.</td></tr>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="/favicon.ico" type="image/svg+xml" />
<title>Vista — apps</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; max-width: 60rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
  .sub { color: color-mix(in oklab, currentColor 55%, transparent); margin: 0 0 1.5rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid color-mix(in oklab, currentColor 12%, transparent); vertical-align: top; }
  th { font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: color-mix(in oklab, currentColor 55%, transparent); }
  a { color: inherit; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
  .app-cell { display: flex; align-items: flex-start; gap: 0.75rem; }
  .thumbnail { display: block; width: 128px; height: 80px; aspect-ratio: 8 / 5; flex: none; box-sizing: border-box; object-fit: cover; border: 1px solid color-mix(in oklab, currentColor 18%, transparent); border-radius: 0.25rem; background: color-mix(in oklab, currentColor 5%, transparent); }
  .thumbnail-placeholder { display: grid; place-items: center; font-size: 0.75rem; color: color-mix(in oklab, currentColor 55%, transparent); }
  .slug { font: 12px ui-monospace, monospace; color: color-mix(in oklab, currentColor 50%, transparent); margin-top: 0.15rem; }
  .muted { color: color-mix(in oklab, currentColor 45%, transparent); }
  .retired { opacity: 0.55; }
  .retired a { text-decoration: line-through; }
  .badge { font-size: 0.7rem; font-weight: 600; padding: 0.05rem 0.4rem; border-radius: 0.5rem; background: color-mix(in oklab, currentColor 12%, transparent); }
  code { font: 12px ui-monospace, monospace; }
</style>
</head>
<body>
  <h1>Vista</h1>
  <p class="sub">Render-only visual apps. ${all.length} app${all.length === 1 ? '' : 's'}.</p>
  <table>
    <thead><tr><th>App</th><th>Latest</th><th>Template</th><th>Status</th><th>Updated</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`
}

/** A service-owned tombstone: never render bytes from an unverifiable publication. */
export const renderPublicationFailure = ({
  owner,
  slug,
  version,
  failure,
}: {
  readonly owner: string
  readonly slug: string
  readonly version: number
  readonly failure: 'receiptless' | 'untrusted'
}): string => {
  const reason =
    failure === 'receiptless'
      ? 'The publication receipt for this version is missing. Vista cannot verify which files belong to the published version.'
      : 'Vista could not verify this version against its trusted publication record. Its receipt or files may be missing, changed, or in an unsupported format.'
  const latest = `/r/${encodeRouteOwner(owner)}/${slug}/latest/`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="/favicon.ico" type="image/svg+xml" />
<title>Publication unavailable — ${esc(slug)} v${version} — Vista</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 0; padding: clamp(1rem, 5vw, 3rem); }
  main { max-width: 42rem; margin: 3vh auto; }
  header { border-bottom: 1px solid color-mix(in oklab, currentColor 20%, transparent); padding-bottom: 1rem; }
  .status { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  h1 { font-size: clamp(1.5rem, 4vw, 2rem); line-height: 1.25; }
  h2 { font-size: 1.1rem; margin-top: 1.5rem; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 0.3rem 1rem; }
  dt { font-weight: 600; }
  dd { margin: 0; overflow-wrap: anywhere; }
  code { font: 0.85em ui-monospace, monospace; }
  nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2rem; }
  a { color: inherit; text-underline-offset: 0.2em; }
  a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }
</style>
</head>
<body>
<main>
  <header>
    <p class="status">Vista · publication blocked · HTTP 409</p>
    <h1>This published version is unavailable</h1>
    <p>Publication trust verification failed. Vista has withheld this version rather than show content it cannot verify.</p>
  </header>
  <dl>
    <dt>App</dt><dd><code>${esc(slug)}</code></dd>
    <dt>Version</dt><dd><code>v${version}</code></dd>
    <dt>Owner</dt><dd><code>${esc(owner)}</code></dd>
  </dl>
  <section aria-labelledby="why">
    <h2 id="why">Why this happened</h2>
    <p>${reason}</p>
    <p>This is a publication problem, not something you need to fix in your browser. This request has not changed the saved publication.</p>
  </section>
  <section aria-labelledby="next">
    <h2 id="next">What you can do</h2>
    <p>Ask the owner to republish this app from its source and share the new version link. The owner can also ask the Vista operator to investigate the publication record.</p>
    <p>You can check the latest published version or return to the app index. Opening latest may show a different version; this pinned link will not silently switch versions.</p>
  </section>
  <nav aria-label="Recovery">
    <a href="${esc(latest)}">Check latest version</a>
    <a href="/r">Back to app index</a>
  </nav>
</main>
</body>
</html>`
}
