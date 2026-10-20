# Vista App Resource Spec

## Audience

For: other systems

| For | Why it exists for them | Surface | Optimizes for |
| --- | --- | --- | --- |
| Humans | - | `none:not-an-audience` | - |
| Agents | - | `none:not-an-audience` | - |

Owns tools: none

This mini-spec refines the coding-agent
[Resource profile contract](https://github.com/compoundingtech/smalltalk/blob/main/docs/st3/custom-subjects.md)
for durable Vista apps. It builds on [Vista requirements](../requirements.md)
and coding-agent requirements R53-R65.

## Profile

| Field | Contract |
| --- | --- |
| Type tag | `vista-app` |
| URI | `dev.schickling.vista-app://<service-authority>/<encoded-owner>/<local-slug>` |
| Identity | one durable owner-scoped app within one stable logical Vista service authority |
| Resolver owner | Vista |
| Authority | Vista service and tailnet policy; the binding grants none |

The service authority is a stable logical name such as `primary`, not a network
hostname or base URL. `encoded-owner` is the lossless RFC 3986 path-segment encoding
of the exact st v3 managed subject from `$ST_AGENT` for new publications, as defined
by [authoring](../02-medium/01-authoring/spec.md#appsource); decoding
must reproduce that identity byte-for-byte, with no case folding, dot rewriting, or
host inference. `local-slug` is unique only within that owner. Resolution supplies
the current collision-free HTTPS route, latest published version, and safe app
metadata (decision 0077).

## Resolution

`available` means the owner-scoped app has at least one receipt-backed,
inspectable version. `missing` means that owner/local-slug pair has never been
published in that authority, `unreachable` means the Vista service cannot be
contacted, `unauthorized` means inspection is denied, and `unsupported` means the
authority or URI is not understood. `retired` means the App has been explicitly
retired: its identity is never reused, and its mutable `draft` and moving `latest`
routes are hidden. Receipt-backed pinned `vN` versions remain available through
their own routes and Resources; receiptless state never gains a fallback path.

The `/r/<encoded-owner>/<local-slug>/latest` route is a moving navigation pointer
and is not a Resource URI. Publishing and retirement remain Vista-owned operations.
The automatic publish receipt binds the resolved
`vista-source://agent/<encoded-owner>/<local-slug>` URI to this
`vista-app` URI and the resulting immutable `vista-version` URI.
