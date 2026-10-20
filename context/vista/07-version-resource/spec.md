# Vista Version Resource Spec

## Audience

For: other systems

| For | Why it exists for them | Surface | Optimizes for |
| --- | --- | --- | --- |
| Humans | - | `none:not-an-audience` | - |
| Agents | - | `none:not-an-audience` | - |

Owns tools: none

This mini-spec refines the coding-agent
[Resource profile contract](https://github.com/compoundingtech/smalltalk/blob/main/docs/st3/custom-subjects.md)
for immutable Vista versions. It builds on [Vista requirements](../requirements.md)
and coding-agent requirements R53-R65.

## Profile

| Field | Contract |
| --- | --- |
| Type tag | `vista-version` |
| URI | `dev.schickling.vista-version://<service-authority>/<encoded-owner>/<local-slug>/<version>` |
| Identity | one immutable published version within one Vista app |
| Resolver owner | Vista |
| Authority | Vista service and tailnet policy; the binding grants none |

`version` is the canonical immutable Vista version id such as `v3`. The service
authority is a stable logical name, not a hostname or base URL. `encoded-owner`
losslessly encodes the exact st v3 managed subject from `$ST_AGENT` for new publications,
as defined by [authoring](../02-medium/01-authoring/spec.md#appsource), as one
RFC 3986 path segment, without normalization; `local-slug` is owner-local.
Resolution supplies the collision-free canonical HTTPS route and safe version
metadata. The automatic publish receipt binds the source URI, app URI, and this
immutable version URI (decision 0077).

## Resolution

`available` means the immutable version's publication receipt validates against
the service-owned root outside its mutable version directory and its content is
inspectable. A missing or invalid receipt withholds content with HTTP 409; it does
not select Vite or the draft. `missing`, `unreachable`, `unauthorized`, and
`unsupported` retain the shared meanings. App retirement hides only the App's
mutable `draft` and moving `latest` surfaces; it does not retire, delete, or hide
a receipt-backed pinned immutable static version.

`latest` is never accepted as a version identity. Published content and its
Resource URI remain immutable.
