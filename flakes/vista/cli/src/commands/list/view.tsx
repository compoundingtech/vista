import type { AppRow } from '@vista/service/control'
/**
 * `vista list` view (decision 0063 / AGT.CLI-R68): the CLI mirror of the app
 * index. Active apps first; retired shown distinctly at the bottom with a
 * `retired` status marker; a trailing summary gives the counts.
 *
 * Layout: each row is a single `<Text>` line of inline `<Text>` cells (the
 * tui-react string renderer lays `<Text>` siblings out horizontally; nested
 * `<Box>` would stack). Column alignment is plain `.padEnd` on the cell's *text*
 * — never the old ANSI-aware `padEndVisible`, because colour is `<Text>`'s job
 * now (no escape codes live in the strings, so visible width == string length).
 * Symbol/colour selection follows the resolved output mode via `useSymbols` /
 * `<Text>`, so `ci-plain`/`log` degrade to ASCII automatically.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, Text, useSymbols, useTuiAtomValue } from '@overeng/tui-react'

import type { ListStateType } from './schema.ts'

const SLUG_MIN = 6
const SLUG_MAX = 32
const VER_W = 6
const STATUS_W = 28
const TEMPLATE_W = 22

/** Props for the ListView component. */
export interface ListViewProps {
  readonly stateAtom: Atom.Atom<ListStateType>
}

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : s.slice(0, max - 1) + '…'

const pad = (s: string, width: number): string => s.padEnd(width)

/** Most-recently-updated first (rows lacking a timestamp sort last). */
const byUpdated = (a: AppRow, b: AppRow): number => (b.updated ?? '').localeCompare(a.updated ?? '')

const fmtUpdated = (iso: string | undefined): string => {
  if (iso === undefined) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * The status cell: retired/draft/settled markers, or the coloured counts, padded
 * to `STATUS_W`. Returns both the rendered node and the plain (visible) length so
 * the row can right-pad the remainder to keep columns aligned.
 */
const statusCell = (row: AppRow, sepChar: string): { node: React.ReactNode; len: number } => {
  if (row.retired) return { node: <Text color="yellow">retired</Text>, len: 'retired'.length }
  // A never-published app (no version) is `draft`, not `settled` — only a
  // published app with zero open/awaiting decisions is genuinely settled.
  if (row.latest === null) return { node: <Text dim>draft</Text>, len: 'draft'.length }
  const s = row.status
  if (s === undefined) return { node: <Text dim>settled</Text>, len: 'settled'.length }
  const segs: { text: string; color: 'green' | 'yellow' }[] = []
  if (s.locked > 0) segs.push({ text: `${s.locked} locked`, color: 'green' })
  if (s.open > 0) segs.push({ text: `${s.open} open`, color: 'yellow' })
  if (s.awaiting > 0) segs.push({ text: `${s.awaiting} awaiting`, color: 'yellow' })
  if (segs.length === 0) return { node: <Text dim>settled</Text>, len: 'settled'.length }
  const sep = ` ${sepChar} `
  const len = segs.map((seg) => seg.text).join(sep).length
  const node = segs.map((seg, i) => (
    <React.Fragment key={seg.text}>
      {i > 0 ? <Text dim>{sep}</Text> : null}
      <Text color={seg.color}>{seg.text}</Text>
    </React.Fragment>
  ))
  return { node, len }
}

const Row = ({
  row,
  slugW,
  sepChar,
}: {
  row: AppRow
  slugW: number
  sepChar: string
}): React.ReactElement => {
  const status = statusCell(row, sepChar)
  const statusFill = Math.max(0, STATUS_W - status.len)
  return (
    <Text>
      {'  '}
      <Text bold>{pad(truncate(row.slug, slugW), slugW)}</Text>
      {'  '}
      {row.latest !== null ? (
        <Text>{pad(`v${row.latest}`, VER_W)}</Text>
      ) : (
        <Text dim>{pad('—', VER_W)}</Text>
      )}
      {'  '}
      {status.node}
      {' '.repeat(statusFill)}
      {'  '}
      <Text dim>{pad(row.template ?? '—', TEMPLATE_W)}</Text>
      {'  '}
      <Text dim>{fmtUpdated(row.updated)}</Text>
    </Text>
  )
}

/** Renders the grouped app list with counts and status markers. */
export const ListView = ({ stateAtom }: ListViewProps): React.ReactElement => {
  const rows = useTuiAtomValue(stateAtom)
  const symbols = useSymbols()
  const dot = symbols.status.dot

  if (rows.length === 0) {
    return <Text dim>{'no apps yet — publish one with `vista publish <slug>`'}</Text>
  }

  const active = rows.filter((r) => !r.retired).toSorted(byUpdated)
  const retired = rows.filter((r) => r.retired).toSorted(byUpdated)
  const slugW = Math.min(SLUG_MAX, Math.max(SLUG_MIN, ...rows.map((r) => r.slug.length)))

  return (
    <Box flexDirection="column">
      <Text dim>
        {'  '}
        {pad('APP', slugW)}
        {'  '}
        {pad('LATEST', VER_W)}
        {'  '}
        {pad('STATUS', STATUS_W)}
        {'  '}
        {pad('TEMPLATE', TEMPLATE_W)}
        {'  UPDATED'}
      </Text>
      {active.map((r) => (
        <Row key={r.slug} row={r} slugW={slugW} sepChar={dot} />
      ))}
      {retired.length > 0 ? (
        <Box flexDirection="column">
          <Text>{''}</Text>
          <Text dim>
            {`  retired (${retired.length}) — durable links preserved, surfaces return 410`}
          </Text>
          {retired.map((r) => (
            <Row key={r.slug} row={r} slugW={slugW} sepChar={dot} />
          ))}
        </Box>
      ) : null}
      <Text>{''}</Text>
      <Text dim>
        {`${rows.length} app${rows.length === 1 ? '' : 's'} ${dot} ${active.length} active ${dot} ${retired.length} retired`}
      </Text>
    </Box>
  )
}
