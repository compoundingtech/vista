import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { NodeServices } from '@effect/platform-node'
import * as Vitest from '@effect/vitest'
import { Effect, FileSystem } from 'effect'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
import { expect } from 'vitest'

import { buildNativeApp } from './native-build.ts'

Vitest.describe('native AppSource build', () => {
  Vitest.it.live('shares the host hook dispatcher and emits app-owned CSS', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const source = yield* fs.makeTempDirectoryScoped({ prefix: 'vista-native-runtime-' })
      yield* fs.writeFileString(join(source, 'app.css'), '.native-proof { color: rgb(1, 2, 3); }')
      yield* fs.writeFileString(
        join(source, 'app.tsx'),
        'import { useState } from "react"; import { jsx } from "react/jsx-runtime"; import "./app.css"; export default function App() { const [value] = useState(42); return jsx("p", { children: `host dispatcher: ${value}` }); }',
      )
      const output = yield* Effect.promise(() =>
        buildNativeApp({ appSource: source, outDir: join(source, 'output') }),
      )
      const module: {
        readonly createVistaApp: (runtime: {
          readonly react: typeof React
          readonly 'react/jsx-runtime': typeof jsxRuntime
          readonly '@vista/blocks': object
        }) => React.ComponentType
      } = yield* Effect.promise(() => import(pathToFileURL(output.modulePath).href))
      const App = module.createVistaApp({
        react: React,
        'react/jsx-runtime': jsxRuntime,
        '@vista/blocks': {},
      })
      expect(renderToStaticMarkup(React.createElement(App))).toBe('<p>host dispatcher: 42</p>')
      expect(output.stylePath).toBe(join(source, 'output', 'app.css'))
      expect(yield* fs.readFileString(join(source, 'output', 'app.css'))).toContain('.native-proof')
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  Vitest.it.live('rejects package namespaces outside the host runtime contract', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const source = yield* fs.makeTempDirectoryScoped({ prefix: 'vista-native-import-' })
      yield* fs.writeFileString(
        join(source, 'app.tsx'),
        'import ReactDOM from "react-dom"; export default ReactDOM;',
      )
      yield* Effect.promise(() =>
        expect(
          buildNativeApp({ appSource: source, outDir: join(source, 'output') }),
        ).rejects.toMatchObject({ _tag: 'Vista.NativeAppBuildFailed' }),
      )
      expect(yield* fs.exists(join(source, 'output', 'app.mjs'))).toBe(false)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
