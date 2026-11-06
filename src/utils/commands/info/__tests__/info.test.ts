import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ env: { PROFILE_ENABLED: false } }))

vi.mock('../../../../lib/startup/env.js', () => ({ default: mocks.env }))
vi.mock('@pluto-config', () => ({
	helpfooter: vi.fn(async () => 'footer'),
}))
vi.mock('../../../api/patreon/interfaces.js', () => ({ patreonUrl: 'x' }))

const { default: PlutoInfo } = await import('../info.js')

describe('commandsInfo', () => {
	beforeEach(() => {
		mocks.env.PROFILE_ENABLED = false
	})

	it('lists /profile only while the command is enabled', async () => {
		expect((await PlutoInfo.commandsInfo()).description).not.toContain(
			'/profile',
		)
		mocks.env.PROFILE_ENABLED = true
		expect((await PlutoInfo.commandsInfo()).description).toContain(
			'**`/profile`**',
		)
	})
})
