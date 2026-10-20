import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Mission graphs, progress lanes and page explanations in @vista/blocks',
  summary:
    "MissionGraph draws a mission's declared steps as lanes × ranks, with gates from an optional overlay; selecting a step or gate reveals its details below the graph. Parallel steps and gates sharing a lane and rank are packed in stable ID order, with lanes growing to keep every node visible and selectable in both orientations. ProgressLanes shows parallel work state with the lane waiting on you in the you tone. Note says what an element means: once a page has a Note, the shell header shows an Explain toggle that starts off, draws every note over the dimmed page, and closes with Escape.",
} satisfies ChangelogEntrySource
