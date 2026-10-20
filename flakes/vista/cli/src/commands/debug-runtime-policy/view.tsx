/**
 * `vista debug runtime-policy` view (decision 0063): problems-first (public
 * roots with no backing package or public alias), then the policy counts, the
 * installed-closure roots, the alias map, and the remote-import rules.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Blank, Field, Heading, Item, Problems, type Problem } from '../block.tsx'
import type { RuntimePolicyStateType } from './schema.ts'

/** Supplies the atom carrying the runtime-policy snapshot that the view reads each render. */
export interface RuntimePolicyViewProps {
  readonly stateAtom: Atom.Atom<RuntimePolicyStateType>
}

/**
 * Derives the view's problems by flagging public import roots that have neither a matching
 * installed package nor a public alias, recommending how each root should be resolved.
 */
export const RuntimePolicyView = ({ stateAtom }: RuntimePolicyViewProps): React.ReactElement => {
  const policy = useTuiAtomValue(stateAtom)
  const missingPublicRoots = policy.publicImportRoots.filter(
    (root) =>
      !policy.installed.packageNames.includes(root) &&
      !policy.aliases.some((alias) => alias.public && alias.specifier === root),
  )
  const problems: readonly Problem[] = missingPublicRoots.map((root) => ({
    name: `public root has no package or public alias: ${root}`,
    fix: 'add it to the service dependency closure or runtime-policy aliases',
  }))
  return (
    <Box flexDirection="column">
      <Problems items={problems} />
      <Heading>runtime policy</Heading>
      <Field label="schema" value={`v${policy.schemaVersion}`} />
      <Field label="public" value={`${policy.publicImportRoots.length}`} />
      <Field label="service-owned" value={`${policy.serviceOwnedImportRoots.length}`} />
      <Field label="optimize" value={`${policy.optimizeInclude.length}`} />
      <Field label="css" value={`${policy.cssImports.length}`} />
      <Field label="aliases" value={`${policy.aliases.length}`} />
      <Field label="remote rules" value={`${policy.remoteImports.length}`} />
      <Field label="ssr external" value={`${policy.ssrExternal.length}`} />
      <Field label="dedupe" value={policy.dedupe.join(', ') || 'none'} />
      <Blank />
      <Heading>roots</Heading>
      <Field label="installed packages" value={`${policy.installed.packageNames.length}`} />
      <Field label="workspace dirs" value={`${policy.installed.workspaceClosureDirs.length}`} />
      <Blank />
      <Heading>aliases</Heading>
      {policy.aliases.map((alias) => (
        <Item key={alias.specifier}>{`${alias.specifier} -> ${alias.target}`}</Item>
      ))}
      <Blank />
      <Heading>remote</Heading>
      {policy.remoteImports.map((rule) => (
        <Item key={rule.name}>{`${rule.name}: ${rule.pattern}`}</Item>
      ))}
    </Box>
  )
}
