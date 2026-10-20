/**
 * Synthetic image fixtures for the image-family stories. All pixels are drawn by the
 * browser from inline SVG; no real documents or binary assets.
 */
import type { DiffSide } from '../../blocks/diff/contract.ts'
import type { ImageSource } from '../../blocks/diff/ImageDiff.tsx'
import type { PageImage } from '../../blocks/diff/PageSetDiff.tsx'

/** Observed side: what the archive actually holds at capture 12. */
export const before: DiffSide = {
  label: 'Before · capture 12',
  basis: 'observed',
  provenance: 'Synthetic archive snapshot',
}
/** Projected side: the migration preview the proposal promises. */
export const after: DiffSide = {
  label: 'After · proposal 13',
  basis: 'projected',
  provenance: 'Synthetic migration preview',
}

const svg = (markup: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`

/** Parametrised invoice sheet; amount, line item and canvas size are story knobs. */
export const invoice = (
  amount: string,
  line = 'Vector review',
  width = 600,
  height = 780,
): ImageSource => ({
  src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#fff"/>
    <rect x="46" y="44" width="508" height="5" fill="#0e7490"/>
    <text x="46" y="94" font-family="Arial" font-size="32" font-weight="bold" fill="#1f2937">NORTH DOCK STUDIO</text>
    <text x="46" y="128" font-family="Arial" font-size="14" fill="#64748b">Invoice · SAMPLE / 0042</text>
    <line x1="46" y1="170" x2="554" y2="170" stroke="#cbd5e1"/>
    <text x="46" y="222" font-family="Arial" font-size="16" fill="#334155">Service</text>
    <text x="426" y="222" font-family="Arial" font-size="16" fill="#334155">Amount</text>
    <text x="46" y="270" font-family="Arial" font-size="20" fill="#0f172a">${line}</text>
    <text x="426" y="270" font-family="Arial" font-size="20" fill="#0f172a">$${amount}</text>
    <line x1="46" y1="298" x2="554" y2="298" stroke="#cbd5e1"/>
    <text x="46" y="355" font-family="Arial" font-size="16" fill="#64748b">Total due</text>
    <text x="426" y="355" font-family="Arial" font-size="20" font-weight="bold" fill="#0f172a">$${amount}</text>
    <text x="46" y="704" font-family="Arial" font-size="12" fill="#94a3b8">Synthetic fixture · no customer data</text>
  </svg>`),
  alt: `Synthetic invoice for $${amount}`,
})

/** Archive scan carrying a rotated date stamp, so the two captures are told apart at a glance. */
export const scan = (stamp: string, color = '#475569'): ImageSource => ({
  src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="0 0 600 780">
    <rect width="600" height="780" fill="#f5f3eb"/>
    <rect x="30" y="38" width="540" height="704" fill="none" stroke="#d6d3c8" stroke-width="3"/>
    <text x="60" y="100" font-family="Georgia" font-size="26" fill="#374151">ARCHIVE TRANSCRIPT</text>
    <text x="60" y="150" font-family="Georgia" font-size="15" fill="#475569">Dock inspection · synthetic scan</text>
    <path d="M60 188h475M60 236h475M60 284h475M60 332h475M60 380h475M60 428h475M60 476h475M60 524h475M60 572h475" stroke="#c4c5c2" stroke-width="2"/>
    <path d="M62 182l180 -7m-180 55l435 2m-435 48l310 -9m-310 61l436 -8m-436 55l360 -2" stroke="#64748b" stroke-opacity=".35" stroke-width="3"/>
    <g transform="translate(335 590) rotate(-14)">
      <rect x="0" y="0" width="190" height="72" rx="4" fill="none" stroke="${color}" stroke-width="5"/>
      <text x="20" y="47" font-family="Arial" font-size="24" font-weight="bold" fill="${color}">${stamp}</text>
    </g>
  </svg>`),
  alt: `Synthetic archive scan with ${stamp} stamp`,
})

/** Technical floor plan, the image family's stand-in for diagrams and figures. */
export const blueprint: ImageSource = {
  src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="0 0 600 780">
    <rect width="600" height="780" fill="#e0f2fe"/><rect x="48" y="55" width="504" height="650" fill="none" stroke="#0369a1" stroke-width="4"/>
    <path d="M90 140h420v390H90zM210 140v390M210 365h300M90 530l420 -390" fill="none" stroke="#0284c7" stroke-width="3"/>
    <text x="90" y="610" font-family="Arial" font-size="26" fill="#075985">EAST PIER / PLAN A</text>
    <text x="90" y="652" font-family="Arial" font-size="14" fill="#075985">Diagram · synthetic fixture</text>
  </svg>`),
  alt: 'Synthetic pier floor plan',
}

/** Landscape capture of a portrait page, for exercising orientation handling. */
export const rotated: ImageSource = {
  src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="600" viewBox="0 0 780 600">
    <rect width="780" height="600" fill="#f5f3eb"/>
    <g transform="translate(780 0) rotate(90)">
      <rect x="30" y="38" width="540" height="704" fill="none" stroke="#d6d3c8" stroke-width="3"/>
      <text x="60" y="100" font-family="Georgia" font-size="26" fill="#374151">ARCHIVE TRANSCRIPT</text>
      <text x="60" y="150" font-family="Georgia" font-size="15" fill="#475569">Dock inspection · rotated capture</text>
      <path d="M60 188h475M60 236h475M60 284h475M60 332h475M60 380h475M60 428h475" stroke="#c4c5c2" stroke-width="2"/>
    </g>
  </svg>`),
  alt: 'Synthetic page rotated into landscape orientation',
}

/**
 * One page of a synthetic report. `edit` changes a paragraph; `comment` adds an inline XML
 * comment, which changes the bytes (and the URL) without changing the render.
 */
export const reportPage = (
  page: number,
  { edit, comment }: { readonly edit?: string; readonly comment?: string } = {},
): ImageSource => ({
  src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="0 0 600 780">${comment === undefined ? '' : `<!-- ${comment} -->`}
    <rect width="600" height="780" fill="#fff"/>
    <text x="52" y="84" font-family="Arial" font-size="22" font-weight="bold" fill="#111827">Harbor survey · section ${page}</text>
    <path d="M52 128h496M52 160h496M52 192h420M52 256h496M52 288h496M52 320h360" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
    <text x="52" y="392" font-family="Arial" font-size="16" fill="#1f2937">${edit ?? `Finding ${page}.1: berth depth within tolerance.`}</text>
    <path d="M52 440h496M52 472h496M52 504h300" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
    <text x="300" y="740" font-family="Arial" font-size="12" fill="#6b7280" text-anchor="middle">${page}</text>
  </svg>`),
  alt: `Synthetic report page ${page}`,
})

const hashed = (image: ImageSource, contentHash: string, label: string): PageImage => ({
  ...image,
  contentHash,
  label,
})

/** Six-page report: the before export rendered every page, the after export only the first three. */
export const reportBefore: readonly PageImage[] = [1, 2, 3, 4, 5, 6].map((page) =>
  hashed(reportPage(page), `sha256:report-p${page}-v1`, `Section ${page}`),
)

/** Three-page report with the tail missing: one real edit plus one comment-only re-export. */
export const reportAfterPartial: readonly PageImage[] = [
  hashed(reportPage(1), 'sha256:report-p1-v1', 'Section 1'),
  hashed(
    reportPage(2, { edit: 'Finding 2.1: berth depth 0.4 m below tolerance.' }),
    'sha256:report-p2-v2',
    'Section 2',
  ),
  hashed(reportPage(3, { comment: 're-exported' }), 'sha256:report-p3-v2', 'Section 3'),
]

/** Eight-page report where only a few pages change: realistic for the page-set layout exploration. */
export const longBefore: readonly PageImage[] = [1, 2, 3, 4, 5, 6, 7, 8].map((page) =>
  hashed(reportPage(page), `sha256:long-p${page}-v1`, `Section ${page}`),
)

/** Eight-page report with changes scattered across pages 3, 5 and 7 rather than in one run. */
export const longAfter: readonly PageImage[] = longBefore.map((page, index) =>
  index === 2
    ? hashed(
        reportPage(3, { edit: 'Finding 3.1: berth depth 0.4 m below tolerance.' }),
        'sha256:long-p3-v2',
        'Section 3',
      )
    : index === 4
      ? hashed(reportPage(5, { comment: 're-exported' }), 'sha256:long-p5-v2', 'Section 5')
      : index === 6
        ? hashed(
            reportPage(7, { edit: 'Finding 7.1: fender replaced; see attachment B.' }),
            'sha256:long-p7-v2',
            'Section 7',
          )
        : page,
)
