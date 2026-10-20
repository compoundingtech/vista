import type { MissionOverlay, MissionStep } from '../blocks/kit/MissionGraph.tsx'
import type { ProgressLane } from '../blocks/kit/ProgressLanes.tsx'

const Detail = ({ input, proves }: { readonly input: string; readonly proves: string }) => (
  <>
    <p style={{ margin: '0 0 0.5rem' }}>
      <strong>Starts with</strong> {input}
    </p>
    <p style={{ margin: 0 }}>
      <strong>Must prove</strong> {proves}
    </p>
  </>
)

const sidenote = 'agent/dotfiles/sidenote'
const deployer = 'agent/dotfiles/deployer'
const you = 'human/johannes'

/** The held `dotfiles/sidenote/finish` mission: st step shape plus reader labels and details. */
export const sidenoteSteps: readonly MissionStep[] = [
  {
    id: 'handoff-and-freeze',
    assignedTo: sidenote,
    dependsOn: null,
    label: 'Freeze',
    detail: (
      <Detail
        input="Approved private handoff and the existing dirty mbp2025 branch"
        proves="One writer; every local commit and dirty path preserved; exact source, build and evidence baseline"
      />
    ),
  },
  {
    id: 'coherent-software-slice',
    assignedTo: sidenote,
    dependsOn: { step: 'handoff-and-freeze', state: 'completed' },
    label: 'Software slice',
    detail: (
      <Detail
        input="Frozen source and retained component receipts"
        proves="Exact-source review and one coherent app build, with no hardware claim"
      />
    ),
  },
  {
    id: 'real-recording',
    assignedTo: sidenote,
    dependsOn: { step: 'coherent-software-slice', state: 'completed' },
    label: 'Real speech',
    detail: (
      <Detail
        input="Reviewed build and an approved device lane"
        proves="New physical speech becomes owned originals, a transcript and Markdown"
      />
    ),
  },
  {
    id: 'failure-and-delivery',
    assignedTo: sidenote,
    dependsOn: { step: 'real-recording', state: 'completed' },
    label: 'Failures + Notion',
    detail: (
      <Detail
        input="Fresh recording receipts and the accepted daily-use policy"
        proves="Offline, restart and interrupted-upload failures recover; Notion delivery is independent of capture"
      />
    ),
  },
  {
    id: 'release-and-restore',
    assignedTo: sidenote,
    dependsOn: { step: 'failure-and-delivery', state: 'completed' },
    label: 'Restore + release',
    detail: (
      <Detail
        input="Qualified revisions and the failure matrix"
        proves="Whole restore without source, hourly off-host backup, exact release and rollback"
      />
    ),
  },
  {
    id: 'adopt-production',
    assignedTo: deployer,
    dependsOn: { step: 'release-and-restore', state: 'completed' },
    label: 'Adopt on dev3',
    detail: (
      <Detail
        input="Accepted handoff, approved release, restore and rollback receipts"
        proves="Live revision, health, hourly backup and rollback receipts returned to Sidenote"
      />
    ),
  },
  {
    id: 'daily-acceptance',
    assignedTo: sidenote,
    dependsOn: { step: 'adopt-production', state: 'completed' },
    label: 'Daily proof',
    detail: (
      <Detail
        input="Production receipts and the installed signed app"
        proves="Pendant capacity, an 8-hour processing envelope and your final acceptance"
      />
    ),
  },
]

/** Lane names and the gates the mission runner cannot enforce. */
export const sidenoteOverlay: MissionOverlay = {
  lanes: { [you]: 'You', [sidenote]: 'Sidenote', [deployer]: 'Deployer' },
  gates: [
    {
      id: 'g-handoff',
      lane: you,
      at: 'handoff-and-freeze',
      label: 'Release hold',
      to: 'handoff-and-freeze',
      detail: 'Your handoff and mission approval, one writer, and the exact existing workspace.',
    },
    {
      id: 'g-device',
      lane: you,
      at: 'real-recording',
      label: 'Device + speech',
      to: 'real-recording',
      detail: 'Only the permissions, signed install and physical actions a real recording needs.',
    },
    {
      id: 'g-release',
      lane: you,
      at: 'adopt-production',
      label: 'Release + activation',
      to: 'adopt-production',
    },
    {
      id: 'g-deployer',
      lane: deployer,
      at: 'release-and-restore',
      label: 'Accepts handoff',
      to: 'adopt-production',
      actor: 'agent',
    },
    {
      id: 'g-daily',
      lane: you,
      at: 'daily-acceptance',
      label: 'Daily acceptance',
      from: 'daily-acceptance',
    },
  ],
}

/** Parallel work state from the webfractal end-to-end plan. */
export const webfractalLanes: readonly ProgressLane[] = [
  {
    label: 'st build mission',
    state: 'you',
    detail: 'Draft dotfiles/webfractal/build ready to publish',
  },
  {
    label: 'Upstream smalltalk',
    state: 'doing',
    detail: '#953 → #978 → #982 landing sequentially',
  },
  { label: 'Infra PRs', state: 'doing', detail: 'dotfiles #4302, #4305 once check:quick is green' },
  {
    label: 'Drive foundation (U2)',
    state: 'todo',
    detail: 'D18 terminal input and message composer',
  },
  { label: 'Serving', state: 'done', detail: 'Vite dev server on dev3 with an SSH tunnel' },
]
