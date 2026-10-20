/**
 * Hierarchy lens exploration (`/sk-explore-variants`). Flip the frame's Combined / Side by
 * side switch alongside the pickers; in side by side, hover or select a node to highlight
 * its counterpart. The sample is a finance workspace migration: a receipt moves from Inbox
 * into Archive/2024, a scanner-batch PDF splits into three receipt pages (sharing the
 * batch attachment), a bundle page splits into three study pages, plus an untouched
 * Templates subtree and a database node.
 *
 * - M moves: M1 ghost at the old location + node at the new one, M2 only the node at its
 *   new location plus an `old path → new path` list, M3 both. Current default: M3.
 * - U unchanged subtrees: U1 collapsed with an `N unchanged inside` count, U2 expanded but
 *   dimmed. Current default: U1.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import {
  TreeDiff,
  type TreeMovePresentation,
  type TreeUnchangedPresentation,
} from '../../../blocks/diff/TreeDiff.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'
import { captured, proposed, treeAfter, treeBefore } from '../_documentFixtures.tsx'

type MoveId = 'M1' | 'M2' | 'M3'
type UnchangedId = 'U1' | 'U2'

const moveVariants: readonly Variant<MoveId>[] = [
  {
    id: 'M1',
    description:
      'Ghost row at the old location plus the node at its new one; chips jump between them.',
  },
  {
    id: 'M2',
    description:
      'No ghosts: the node sits at its new location; a `old path → new path` list sits below.',
  },
  { id: 'M3', description: 'Ghost and node in the tree plus the path list below.' },
]
const unchangedVariants: readonly Variant<UnchangedId>[] = [
  {
    id: 'U1',
    description: 'Subtrees without changes start collapsed with an `N unchanged inside` count.',
  },
  {
    id: 'U2',
    description: 'Everything expanded; unchanged subtrees dimmed so changes still stand out.',
  },
]

const moves: Readonly<Record<MoveId, TreeMovePresentation>> = {
  M1: 'ghost',
  M2: 'list',
  M3: 'both',
}
const unchanged: Readonly<Record<UnchangedId, TreeUnchangedPresentation>> = {
  U1: 'collapsed',
  U2: 'dimmed',
}

const TreeExploration = () => {
  const [moveId, setMoveId] = React.useState<MoveId>('M3')
  const [unchangedId, setUnchangedId] = React.useState<UnchangedId>('U1')
  return (
    <div>
      <VariantPanel>
        <VariantPicker label="Moves" variants={moveVariants} value={moveId} onChange={setMoveId} />
        <VariantPicker
          label="Unchanged"
          variants={unchangedVariants}
          value={unchangedId}
          onChange={setUnchangedId}
        />
      </VariantPanel>
      <TreeDiff
        title="Workspace hierarchy · finance migration"
        before={treeBefore}
        after={treeAfter}
        beforeSide={captured}
        afterSide={proposed}
        moves={moves[moveId]}
        unchanged={unchanged[unchangedId]}
      />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/TreeDiff',
  component: TreeExploration,
} satisfies Meta
export default meta

/** Pick M/U variants above the live hierarchy lens. */
export const Exploration: StoryObj = { render: () => <TreeExploration /> }
