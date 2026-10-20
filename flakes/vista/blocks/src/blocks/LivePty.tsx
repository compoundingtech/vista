'use client'

import * as React from 'react'

import { useActorSource, useCommand } from '../data-command.tsx'
import {
  availableValue,
  bind,
  BindingFailureDiagnostic,
  bindingFailureMessage,
  useBindingContext,
} from '../data-query.tsx'
import { type AttachLease, pty } from '../provider-contracts.ts'

const LivePtyView = React.lazy(() =>
  import('./LivePtyView.tsx').then((module) => ({ default: module.LivePtyView })),
)

/**
 * Props for the live terminal block, keyed by a required session id with an optional semantic node
 * id and pixel height.
 */
export interface LivePtyProps {
  readonly sessionId: string
  readonly id?: string
  readonly height?: number
}

/**
 * Owns the currently active attach lease, activating or revoking it, and routes each input through
 * the active lease so dispatches are ordered while failures surface via the caller's handler.
 */
export interface LivePtyLeaseAuthority {
  readonly active: () => AttachLease | undefined
  readonly activate: (lease: AttachLease) => void
  readonly revoke: () => AttachLease | undefined
  readonly enqueue: (
    input: string,
    dispatch: (lease: AttachLease, input: string) => Promise<unknown>,
    onFailure: (cause: unknown) => void,
  ) => Promise<void> | undefined
}

/** Owns the local attach capability and orders input within each active lease. */
export const makeLivePtyLeaseAuthority = (): LivePtyLeaseAuthority => {
  let activeLease: AttachLease | undefined
  let queue: { leaseId: string; tail: Promise<void> } | undefined

  const revoke = (): AttachLease | undefined => {
    const revokedLease = activeLease
    activeLease = undefined
    queue = undefined
    return revokedLease
  }

  return {
    active: () => activeLease,
    activate: (lease) => {
      activeLease = lease
      queue = { leaseId: lease.leaseId, tail: Promise.resolve() }
    },
    revoke,
    enqueue: (input, dispatch, onFailure) => {
      const lease = activeLease
      if (lease === undefined) return undefined
      const activeQueue =
        queue?.leaseId === lease.leaseId
          ? queue
          : { leaseId: lease.leaseId, tail: Promise.resolve() }
      queue = activeQueue
      const pending = activeQueue.tail.then(async () => {
        if (activeLease?.leaseId !== lease.leaseId) return
        try {
          await dispatch(lease, input)
        } catch (cause) {
          if (activeLease?.leaseId !== lease.leaseId) return
          revoke()
          onFailure(cause)
        }
      })
      activeQueue.tail = pending
      return pending
    },
  }
}

/** Revokes local authority before invoking the remote release command. */
export const releaseLivePtyLease = async (
  authority: LivePtyLeaseAuthority,
  onRevoked: () => void,
  release: (lease: AttachLease) => Promise<unknown>,
): Promise<void> => {
  const lease = authority.revoke()
  if (lease === undefined) return
  onRevoked()
  await release(lease)
}

/** Snapshot-first terminal viewport with input gated by a trusted actor source. */
export const LivePty = ({ sessionId, id, height = 420 }: LivePtyProps): React.ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        pty.ops.screen,
        { sessionId },
        { mode: 'subscription', effectfulCapture: 'acknowledged' },
      ),
    [sessionId],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  const actorSource = useActorSource()
  const attach = useCommand(pty.ops.attach)
  const send = useCommand(pty.ops.send)
  const release = useCommand(pty.ops.release)
  const [lease, setLease] = React.useState<AttachLease | undefined>(undefined)
  const [commandError, setCommandError] = React.useState<string | undefined>(undefined)
  const [pending, setPending] = React.useState(false)
  const authorityRef = React.useRef<LivePtyLeaseAuthority | undefined>(undefined)
  if (authorityRef.current === undefined) authorityRef.current = makeLivePtyLeaseAuthority()
  const authority = authorityRef.current

  const toggleAttach = React.useCallback(async () => {
    if (actorSource === 'none') return
    setPending(true)
    setCommandError(undefined)
    try {
      const activeLease = authority.active()
      if (activeLease === undefined) {
        const attachedLease = await attach({ sessionId })
        authority.activate(attachedLease)
        setLease(attachedLease)
      } else {
        await releaseLivePtyLease(
          authority,
          () => setLease(undefined),
          (releasedLease) => release({ sessionId, leaseId: releasedLease.leaseId }),
        )
      }
    } catch (cause) {
      setCommandError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPending(false)
    }
  }, [actorSource, attach, authority, release, sessionId])

  const sendInput = React.useCallback(
    (input: string): void => {
      void authority.enqueue(
        input,
        (activeLease, queuedInput) =>
          send({ sessionId, leaseId: activeLease.leaseId, input: queuedInput }),
        (cause) => {
          setCommandError(cause instanceof Error ? cause.message : String(cause))
          setLease(undefined)
        },
      )
    },
    [authority, send, sessionId],
  )

  if (extracting) return undefined
  const resolved = availableValue(result)
  if (resolved === undefined) {
    if (result._tag !== 'Failure') return <p role="status">Loading PTY {sessionId}…</p>
    return (
      <>
        <p role="alert">{bindingFailureMessage(result)}</p>
        <BindingFailureDiagnostic result={result} />
      </>
    )
  }
  const liveError = result._tag === 'Failure' ? bindingFailureMessage(result) : undefined
  const viewError = commandError ?? liveError
  return (
    <React.Suspense fallback={<p role="status">Loading terminal renderer…</p>}>
      <LivePtyView
        id={id ?? semanticId}
        actorSource={actorSource}
        sessionId={sessionId}
        state={resolved.value}
        provenance={resolved._tag}
        attached={lease !== undefined}
        pending={pending}
        height={height}
        {...(viewError === undefined ? {} : { error: viewError })}
        onToggleAttach={toggleAttach}
        onData={sendInput}
      />
      {result._tag === 'Failure' ? <BindingFailureDiagnostic result={result} /> : undefined}
    </React.Suspense>
  )
}
