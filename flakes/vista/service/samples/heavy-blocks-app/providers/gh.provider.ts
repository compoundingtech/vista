import { GhCommandFixture } from '@vista/data/providers/gh.fixture'
import { makeGhProvider } from '@vista/data/providers/gh.provider'

// The heavy-block render proof captures recorded GitHub data, never a live account.
export default makeGhProvider(GhCommandFixture)
