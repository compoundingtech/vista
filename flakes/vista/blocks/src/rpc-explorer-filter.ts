import type {
  ExplorerEvent,
  InspectorSnapshotFrame,
  InspectorWatchFrame,
} from '@overeng/effect-rpc-explorer'

const eventConnectionId = (event: ExplorerEvent): string =>
  event._tag === 'ConnectionFault' ? event.connectionId : event.request.connectionId

/** The app-scoped projection of the inspector's revision-consistent frames. */
interface AppFrameFilter {
  readonly snapshot: (frame: InspectorSnapshotFrame) => InspectorSnapshotFrame
  readonly watch: (frame: InspectorWatchFrame) => InspectorWatchFrame
}

/** Keep every route's revision sequence intact while projecting only this App's traffic. */
export const makeAppFrameFilter = (appIdentity: string): AppFrameFilter => {
  const appPrefix = `${appIdentity}:`
  const visibleEvents = new Set<number>()
  const belongsToApp = (connectionId: string): boolean =>
    connectionId === appIdentity || connectionId.startsWith(appPrefix)

  const snapshot = (frame: InspectorSnapshotFrame): InspectorSnapshotFrame => {
    const events = frame.events.filter((event) => belongsToApp(eventConnectionId(event)))
    visibleEvents.clear()
    for (const event of events) visibleEvents.add(event.eventId)
    return {
      ...frame,
      active: frame.active.filter((record) => belongsToApp(record.key.connectionId)),
      completed: frame.completed.filter((record) => belongsToApp(record.key.connectionId)),
      events,
    }
  }

  const watch = (frame: InspectorWatchFrame): InspectorWatchFrame => {
    if (frame._tag === 'Snapshot') return snapshot(frame)
    if (frame._tag === 'Reset') {
      visibleEvents.clear()
      return frame
    }
    return {
      ...frame,
      operations: frame.operations.filter((operation) => {
        switch (operation._tag) {
          case 'UpsertRecord':
            return belongsToApp(operation.record.key.connectionId)
          case 'RemoveRecord':
            return belongsToApp(operation.key.connectionId)
          case 'AppendEvent': {
            if (!belongsToApp(eventConnectionId(operation.event))) return false
            visibleEvents.add(operation.event.eventId)
            return true
          }
          case 'RemoveEvent':
            return visibleEvents.delete(operation.eventId)
          case 'CountersChanged':
            return true
        }
      }),
    }
  }
  return { snapshot, watch }
}
