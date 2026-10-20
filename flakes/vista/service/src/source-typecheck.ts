import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { API, DiagnosticCategory, type Diagnostic } from 'typescript/unstable/async'

import { root } from './paths.ts'

/** Check authored files against the runtime's public package types, not repository tsconfigs. */
export const typecheckVistaSource = async (
  evaluationRoot: string,
  authoredRoot: string,
): Promise<readonly string[]> => {
  const configPath = join(evaluationRoot, '.vista-check.tsconfig.json')
  const config = JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: 'ES2024',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      allowJs: true,
      types: ['react', 'vite/client'],
    },
    // The service owns this ambient declaration. It is shipped with the service
    // source, not exposed as @vista/service in the shared app dependency closure.
    files: ['app.tsx', join(root(), 'flakes/vista/service/src/types/esm-sh.d.ts')],
  })
  // The evaluation copy is disposable. A real config keeps dependency reads
  // inside the native compiler instead of routing every file through JS callbacks.
  writeFileSync(configPath, config)
  const api = new API({ cwd: evaluationRoot })
  try {
    const snapshot = await api.updateSnapshot({ openProjects: [configPath] })
    try {
      const project = snapshot.getProject(configPath)
      if (project === undefined) throw new Error('TypeScript did not open the Vista app source')
      const diagnostics: Diagnostic[] = [...(await project.program.getProgramDiagnostics())]
      for (const file of await project.program.getSourceFileNames()) {
        const localPath = relative(evaluationRoot, file)
        if (
          localPath.startsWith(`..${sep}`) ||
          localPath === '..' ||
          localPath.split(sep).includes('node_modules')
        )
          continue
        diagnostics.push(...(await project.program.getSyntacticDiagnostics(file)))
        diagnostics.push(...(await project.program.getSemanticDiagnostics(file)))
      }
      return diagnostics
        .filter((diagnostic) => diagnostic.category === DiagnosticCategory.Error)
        .map((diagnostic) => {
          const messages: string[] = []
          const chain = [diagnostic]
          for (let index = 0; index < chain.length; index++) {
            const entry = chain[index]!
            messages.push(entry.text)
            chain.push(...(entry.messageChain ?? []))
          }
          const lines = messages.join(' ')
          if (diagnostic.fileName === undefined) return `app.tsx: TS${diagnostic.code}: ${lines}`
          const source = readFileSync(diagnostic.fileName, 'utf8')
          const before = source.slice(0, diagnostic.pos)
          const line = before.split('\n').length
          const column = diagnostic.pos - before.lastIndexOf('\n')
          const authoredPath = join(authoredRoot, relative(evaluationRoot, diagnostic.fileName))
          return `${authoredPath}:${line}:${column}: TS${diagnostic.code}: ${lines}`
        })
    } finally {
      await snapshot.dispose()
    }
  } finally {
    await api.close()
    rmSync(configPath, { force: true })
  }
}
