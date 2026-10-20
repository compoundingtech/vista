/**
 * Audits converted StyleX components for two distinct collision shapes.
 *
 * SHAPE 1 — one property object writes a property under both `:hover` and
 * `:focus-visible`. `@stylexjs/shared@0.19.0` spells the hyphenated
 * pseudo-classes camelCase in its priority table but looks them up by literal
 * CSS text, so `':focus-visible'` takes the unknown-pseudo fallback of 40
 * against `':hover'` at 130. Hover then wins, which is the inverse of what
 * Tailwind shipped.
 *
 * SHAPE 2 — two *different* style objects that are applied to the same element
 * both write one property, one of them under a pseudo-class. These never share
 * an object, so a source grep for co-located keys cannot see them, and they
 * still compete as atomic rules.
 *
 * The unit of comparison is the LEAF PROPERTY, not the style key. Comparing
 * style keys aggregates a hover background with a focus outline into one
 * apparent collision and manufactures false positives at roughly the rate it
 * hides real ones.
 *
 * This is a static approximation and says so: it resolves `stylex.create`
 * blocks and `styled(...)` / `stylex.props(...)` call sites by parsing, and it
 * cannot follow a style chosen through an arbitrary runtime expression. It is
 * the cheap first pass. The authoritative check is the emitted stylesheet,
 * because that is the artefact that ships.
 *
 * Exits 1 if any real collision is found. Refuses to report a clean result if
 * it parsed nothing — "no exposure" and "I did not look" must not print the
 * same way.
 *
 * Usage: node scripts/audit-stylex-collisions.mjs [srcDir]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'src/components'

/** Every `.ts`/`.tsx` file below `dir`. */
const walk = (dir) => {
  const out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (path.endsWith('.tsx') || path.endsWith('.ts')) out.push(path)
  }
  return out
}

/** Index of the brace matching the one at `open`. */
const matchBrace = (text, open) => {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

const CONDITION = /^(:|@|\[)/

/**
 * Parse one `stylex.create({...})` body into
 * `{ styleKey: { leafProperty: [conditions...] } }`.
 *
 * Handles both spellings the codebase uses: a nested object per property
 * (`color: { default: a, ':hover': b }`) and a nested object per condition
 * (`':hover': { color: b }`).
 */
const parseCreate = (body) => {
  const keys = {}
  // Top-level entries of the create object.
  const entryRe = /(?:^|\n)\s{2}(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*:\s*\{/g
  let m
  while ((m = entryRe.exec(body)) !== null) {
    const styleKey = m[1] ?? m[2] ?? m[3]
    const open = body.indexOf('{', m.index + m[0].length - 1)
    const close = matchBrace(body, open)
    if (close === -1) continue
    const inner = body.slice(open + 1, close)
    const props = {}

    // Second-level entries.
    const propRe =
      /(?:^|\n)\s+(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*:\s*([\s\S]*?)(?=(?:\n\s+(?:'[^']+'|"[^"]+"|[A-Za-z0-9_$]+)\s*:)|$)/g
    let p
    while ((p = propRe.exec(inner)) !== null) {
      const name = p[1] ?? p[2] ?? p[3]
      const value = p[4]
      if (CONDITION.test(name)) {
        // condition-first: ':hover': { color: x }
        for (const q of value.matchAll(/([A-Za-z0-9_$]+)\s*:/g)) {
          const leaf = q[1]
          props[leaf] = props[leaf] ?? []
          props[leaf].push(name)
        }
      } else if (value.trimStart().startsWith('{')) {
        // property-first: color: { default: a, ':hover': b }
        props[name] = props[name] ?? []
        for (const q of value.matchAll(/(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*:/g)) {
          const cond = q[1] ?? q[2] ?? q[3]
          props[name].push(cond === 'default' ? 'default' : cond)
        }
      } else {
        props[name] = props[name] ?? []
        props[name].push('default')
      }
    }
    keys[styleKey] = props
  }
  return keys
}

/** `styles.x` / `styles['x']` references inside one `styled(...)` call. */
const callSiteKeys = (args) => {
  const keys = []
  for (const m of args.matchAll(/styles\.([A-Za-z0-9_$]+)|styles\[\s*'([^']+)'\s*\]/g)) {
    keys.push(m[1] ?? m[2])
  }
  return keys
}

let filesParsed = 0
let createBlocks = 0
let callSites = 0
const shape1 = []
const shape2 = []

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8')
  if (text.includes('stylex.create') === false) continue
  filesParsed += 1

  const createAt = text.indexOf('stylex.create(')
  const open = text.indexOf('{', createAt)
  const close = matchBrace(text, open)
  if (close === -1) continue
  createBlocks += 1
  const styles = parseCreate(text.slice(open, close + 1))

  // SHAPE 1 — within one style key, one leaf property under both.
  for (const [styleKey, props] of Object.entries(styles)) {
    for (const [leaf, conds] of Object.entries(props)) {
      const hasHover = conds.some((c) => c === ':hover')
      const hasFocus = conds.some((c) => c === ':focus-visible' || c === ':focus-within')
      const hasCompound = conds.some((c) => c.includes(':hover:focus'))
      if (hasHover && hasFocus && hasCompound === false) {
        shape1.push({ file, styleKey, leaf, conds })
      }
    }
  }

  // SHAPE 2 — two keys co-applied at one call site both write one leaf,
  // where at least one write is conditioned.
  for (const m of text.matchAll(/(?:styled|stylex\.props)\(([\s\S]*?)\)\s*\}/g)) {
    const keys = callSiteKeys(m[1])
    if (keys.length < 2) continue
    callSites += 1
    const byLeaf = new Map()
    for (const key of keys) {
      for (const [leaf, conds] of Object.entries(styles[key] ?? {})) {
        const entry = byLeaf.get(leaf) ?? []
        entry.push({ key, conds })
        byLeaf.set(leaf, entry)
      }
    }
    for (const [leaf, writers] of byLeaf) {
      if (writers.length < 2) continue
      const conditioned = writers.filter((w) =>
        w.conds.some((c) => c !== 'default' && CONDITION.test(c)),
      )
      // Competition only matters when a pseudo-class is involved; two plain
      // `default` writers are ordinary last-wins and are usually intentional.
      if (conditioned.length === 0) continue
      shape2.push({ file, leaf, writers: writers.map((w) => `${w.key}[${w.conds.join(',')}]`) })
    }
  }
}

// Liveness first. A report that cannot distinguish "nothing found" from
// "nothing looked at" is the defect this whole audit exists to catch.
console.log(
  `LIVENESS: parsed ${filesParsed} file(s), ${createBlocks} stylex.create block(s), ${callSites} multi-style call site(s).`,
)
if (filesParsed === 0 || createBlocks === 0) {
  console.log('Nothing to audit — no converted components found. This is NOT a pass.')
  process.exit(2)
}

if (shape1.length === 0)
  console.log('\nSHAPE 1 (one object, hover + focus on one leaf property): none.')
for (const hit of shape1) {
  console.log(`\nSHAPE 1  ${hit.file}`)
  console.log(`  ${hit.styleKey}.${hit.leaf} written under ${hit.conds.join(' and ')}`)
  console.log(`  fix: add a compound key restating the focus value, e.g. "':hover:focus-visible'".`)
  console.log(
    `  A compound sums its parts, so it exceeds either component whatever the table says.`,
  )
}

if (shape2.length === 0) console.log('SHAPE 2 (two co-applied objects, one leaf property): none.')
for (const hit of shape2) {
  console.log(`\nSHAPE 2  ${hit.file}`)
  console.log(`  leaf '${hit.leaf}' written by: ${hit.writers.join('  ')}`)
  console.log(`  check the winner is the intended one; put the loser on 'default' so it`)
  console.log(`  carries the lowest priority by construction rather than by table order.`)
}

console.log(`\nThis is a static approximation. The authoritative check is the emitted stylesheet.`)
process.exit(shape1.length > 0 ? 1 : 0)
