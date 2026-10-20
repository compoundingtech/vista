# Third-party notices

## Lucide icon glyph data

`flakes/vista/blocks/src/blocks/kit/icons.tsx` contains inlined glyph data from
Lucide (`lucide-react` 1.55.0). The upstream license, including its Feather-origin
MIT notice, is reproduced verbatim below.

Source: <https://registry.npmjs.org/lucide-react/-/lucide-react-1.55.0.tgz>,
archive member `package/LICENSE`.

- Tarball SHA-256: `d024e6168453b7200cc54d2cf5517935c99919c4969ebeddb0db0698fc007933`
- License member SHA-256: `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## jsonMarkup.js

`flakes/vista/island/vendor/traceview/components/TraceTimelineViewer/SpanDetail/jsonMarkup.js`
is licensed under the MIT License, copyright (c) 2014 Mathias Buus. Its complete
copyright and permission notice is retained at the beginning of that file.

## Grafana Jaeger trace viewer

- Upstream: <https://github.com/grafana/grafana>, revision `v13.1.0`,
  `public/app/features/explore/TraceView/`.
- Vendored path: `flakes/vista/island/vendor/traceview/`.
- License: `AGPL-3.0-only`; Uber-origin Apache-2.0 headers remain intact.
  The MIT `jsonMarkup.js` notice above remains applicable.
- Exact license source: <https://raw.githubusercontent.com/grafana/grafana/v13.1.0/LICENSE>.
  Vendored `LICENSE` SHA-256:
  `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`.
- `dist/island.js` bundles the reachable `TraceTimelineViewer`,
  `model/transform-trace-data`, and `useChildrenState`, `useDetailState`,
  `useViewRange`, and `useHoverIndentGuide` hooks, together with the island's
  React/Grafana metric and flamegraph dependencies. Unreachable Grafana app
  wrappers are not bundled. Local app-glue substitutions are recorded in
  `PROVENANCE.md`.
