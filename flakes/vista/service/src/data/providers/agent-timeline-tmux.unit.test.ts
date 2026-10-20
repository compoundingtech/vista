import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { matchTmuxAgents } from './agent-timeline-tmux.ts'

const running = (
  name: string,
  ttys: ReadonlyArray<string>,
  tags: Readonly<Record<string, string>> | null,
) => ({ name, status: 'running', tags, clients: ttys.map((tty) => ({ tty })) })

const match = (panes: string, entries: ReadonlyArray<unknown>) =>
  Effect.runPromise(matchTmuxAgents(panes, JSON.stringify(entries)))

describe('matchTmuxAgents', () => {
  it('resolves a pane only through exactly one running PTY with a harness session tag', async () => {
    const resolution = await match(
      ['%1\t/dev/pts/1', '%2\t/dev/pts/2', '%3\t/dev/pts/3', '%4\t/dev/pts/4', ''].join('\n'),
      [
        running('agent', ['/dev/pts/1'], {
          'agent.harness.session.id': 'session-1',
          'agent.actor.path': 'dev3.misc',
        }),
        // Two running PTYs claim the same tty: ambiguous, so the pane is skipped.
        running('twin-a', ['/dev/pts/2'], { 'agent.harness.session.id': 'session-2' }),
        running('twin-b', ['/dev/pts/2'], { 'agent.harness.session.id': 'session-3' }),
        // A shell PTY without agent tags.
        running('shell', ['/dev/pts/3'], null),
        {
          ...running('gone', ['/dev/pts/4'], { 'agent.harness.session.id': 'session-4' }),
          status: 'exited',
        },
      ],
    )
    expect(resolution).toEqual({
      panes: 4,
      agents: [
        {
          paneId: '%1',
          tty: '/dev/pts/1',
          ptyName: 'agent',
          actorPath: 'dev3.misc',
          harnessSessionId: 'session-1',
        },
      ],
    })
  })

  it('reports a harness session once when several panes attach to the same PTY', async () => {
    const resolution = await match('%1\t/dev/pts/1\n%2\t/dev/pts/2\n', [
      running('agent', ['/dev/pts/1', '/dev/pts/2'], { 'agent.harness.session.id': 'session-1' }),
    ])
    expect(resolution.agents.map(({ paneId }) => paneId)).toEqual(['%1'])
  })

  it('treats a running entry without a clients key as an unsupported pty', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        matchTmuxAgents('%1\t/dev/pts/1\n', JSON.stringify([{ name: 'old', status: 'running' }])),
      ),
    )
    expect(error.reason).toBe('unsupported')
  })

  it('rejects unparseable pty output as a resolve failure', async () => {
    const error = await Effect.runPromise(Effect.flip(matchTmuxAgents('', 'not json')))
    expect(error.reason).toBe('resolve')
  })
})
