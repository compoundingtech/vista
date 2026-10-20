import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Ship the taste kit and icons in @vista/blocks',
  summary:
    "Pages now open with ContextHeader (what, why now, your ask, optional verdict), ask with ChoiceCards (radio cards or, with multiple, checkbox cards and a sticky copyable pick dock), and show causes with RankedFindings, where a finding is proven only when it names proof and otherwise renders as a dashed hypothesis with its next experiment. TimeTrack chooses its axis from the duration spread without an author setting. Comparison, InspectRow, Mark and a curated Lucide Icon set complete the kit, so authors stop copying page CSS. lucide-react imports are now rejected with guidance to import Icon from @vista/blocks instead of loading a second React from esm.sh. The shell ask counter is derived from the page's asks and hidden when there are none, rail ticks grow for open asks, and the section label follows scrolling without lag. AskBlock, Settled, StatusLine and OptionsGrid stay exported for published apps.",
} satisfies ChangelogEntrySource
