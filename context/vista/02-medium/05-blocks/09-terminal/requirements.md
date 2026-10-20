# Terminal Block — Requirements

The terminal block family realizes the LivePty read and command contracts as a
read-only-first viewport with an explicit bounded attach experience. It builds on
the [block-library requirements](../requirements.md), the
[data-source requirements](../../03-data-sources/requirements.md), and this
node's [spec.md](./spec.md). IDs are path-scoped (`MED.BLK.TERM-*`).

## Requirements

- **MED.BLK.TERM-R86 LivePty realization:** The library must provide a typed
  `LivePty` Block that renders only bounded current `ScreenState`, starts in
  read-only viewing mode, and makes explicit attachment the sole path to a
  bounded writer lease. Its props must declare the fixed session resource that
  publication records under MED.DATA-R85. The Block must expose lease,
  connection, degraded, denial, and revocation state accessibly; gate input and
  resize on the active lease; preserve keyboard escape from the terminal; and
  provide Storybook coverage for read-only, attaching, attached, denied,
  revoked, disconnected, and reconnecting states. It must not expose raw PTY
  bytes, scrollback, generic command dispatch, App/document mutation, or any
  resource not declared by the AppVersion.
  `refines: MED.DATA-R84, MED.DATA-R85`

## Acceptance

A published `LivePty` paints its captured bounded viewport before subscribing,
remains read-only until the viewer explicitly attaches, communicates command
and transport state without relying on color, and returns focus safely. Only an
active bounded lease enables input or resize. An undeclared session cannot be
viewed, and neither the Block nor its props expose a generic Provider or command
surface. Storybook exercises every state named by MED.BLK.TERM-R86.
