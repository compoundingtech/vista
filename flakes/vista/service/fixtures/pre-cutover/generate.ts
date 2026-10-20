// Regenerate against the provenance.json revision, never the current publisher.
// Usage: bun generate.ts <pinned-worktree> <output-directory>
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.argv[2]!)
const output = resolve(process.argv[3]!)
const load = (name: string) =>
  // oxlint-disable-next-line import/no-dynamic-require -- load the pinned archived publisher, never the current checkout.
  import(pathToFileURL(join(root, 'flakes/vista/service/src', name)).href)
// The archived publisher links this dependency tree into its static build.
// Receipt provenance alone cannot detect a current-checkout AppShell leak.
const serviceRoot = join(root, 'flakes/vista/service')
if (
  Bun.resolveSync('@vista/blocks/shell', serviceRoot) !==
  join(root, 'flakes/vista/blocks/src/shell.ts')
) {
  throw new Error('Retained publisher must resolve the archived @vista/blocks/shell')
}
process.env.VISTA_ROOT = root
process.env.VISTA_APPS = join(output, 'apps')
process.env.VISTA_CACHE = join(output, 'cache')
process.env.VISTA_SOURCES = join(output, 'sources')
mkdirSync(output, { recursive: true })
const { resolveVistaBuildInfo } = await load('build-info.ts')
const { VISTA_CHANGELOG_PATH_ENV } = await load('changelog-companion.ts')
const companion = join(output, 'vista-changelog.json')
writeFileSync(
  companion,
  JSON.stringify({
    schemaVersion: 1,
    product: 'vista',
    build: { machineVersion: resolveVistaBuildInfo().machineVersion },
    entries: [],
  }),
)
process.env[VISTA_CHANGELOG_PATH_ENV] = companion
const { appSourcePath } = await load('paths.ts')
const owner = 'agent/retained/fixture'
const source = appSourcePath(process.env.VISTA_SOURCES, owner, 'retained-shell')
mkdirSync(source, { recursive: true })
writeFileSync(
  join(source, 'app.tsx'),
  `import { AppRoot } from '@vista/blocks'
export default function RetainedApp() { return <AppRoot title="Retained pre-cutover shell" template="architecture-review" scope="test" /> }
`,
)
const { startService } = await load('server.ts')
const { freePort } = await load('test-support.ts')
const started = await startService(await freePort())
try {
  const { publish } = await load('publish.ts')
  await publish(
    {
      owner,
      slug: 'retained-shell',
      author: 'fixture',
      changeSummary: 'Pre-cutover owner-route regression fixture',
    },
    started.state.providers,
  )
} finally {
  await started.close()
}
