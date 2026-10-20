import { describe, expect, it } from 'vitest'

import {
  DEBUG_COMMANDS,
  DEBUGGABLE_CONTROL_RPC_TAGS,
  controlRpcTags,
  debugDescriptorRpcTags,
} from '../src/debug.ts'

describe('Vista debug command descriptors', () => {
  it('map the agent-debug surface to existing control RPC procedures', () => {
    expect(DEBUG_COMMANDS.map((descriptor) => descriptor.command)).toEqual([
      'service',
      'paths',
      'app',
      'publish-plan',
      'runtime-policy',
      'import',
    ])

    expect(debugDescriptorRpcTags()).toEqual([...DEBUGGABLE_CONTROL_RPC_TAGS].sort())
    expect(controlRpcTags()).toEqual(expect.arrayContaining(Array.from(debugDescriptorRpcTags())))
  })

  it('keeps command names and descriptions explicit instead of leaking raw RPC tags', () => {
    const commandNames = DEBUG_COMMANDS.map((descriptor) => descriptor.command)
    expect(new Set(commandNames).size).toBe(commandNames.length)

    for (const descriptor of DEBUG_COMMANDS) {
      expect(descriptor.description.length).toBeGreaterThan(0)
      expect(descriptor.command).not.toContain('.')
    }
  })
})
