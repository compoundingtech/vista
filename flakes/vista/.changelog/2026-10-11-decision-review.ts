import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Decision reviews with shared cards and summaries',
  summary:
    'DecisionCard pairs a situation and typed visual with options that each require a cost, a recommendation, reasons, risk and collapsed evidence. DecisionOverview derives its rows from the same card definitions. AnnotatedImage keeps labels outside the image and opens local assets through an accessible expand icon on the image; CiChart shows intervals with precision tied to their width and a compact legend. Imported local images also work in production Storybook builds without allowing remote image URLs. Local check and publication preflight now typecheck app source against the runtime blocks surface, including the existing opaque declaration for supported pinned esm.sh imports, without owner identity or a running service. No model calls or new linter are involved.',
} satisfies ChangelogEntrySource
