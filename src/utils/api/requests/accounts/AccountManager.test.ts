import { beforeEach, describe, expect, it, vi } from 'vitest'

const { success, handleError } = vi.hoisted(() => ({
	success: vi.fn(async (_interaction, title, description) => ({
		title,
		description,
	})),
	handleError: vi.fn(),
}))
vi.mock('../../Khronos/KhronosInstances.js', () => ({ KH_API_CONFIG: {} }))
vi.mock('../../../dev/index.js', () => ({
	isMockEnabled: () => false,
	MockBackend: {},
}))
vi.mock('../../../../lib/PlutoConfig.js', () => ({ supportMessage: 'support' }))
vi.mock('../../../common/errors/global.js', () => ({ ErrorEmbeds: {} }))
vi.mock('../../common/handleNewUser.js', () => ({ handleNewUser: vi.fn() }))
vi.mock('../../../embeds/template/success-template.js', () => ({
	default: { sv1: success },
}))
vi.mock('../../Khronos/error-handling/ApiErrorHandler.js', () => ({
	ApiErrorHandler: class {
		handle = handleError
	},
}))
vi.mock('../../patreon/Patreon-Facade.js', () => ({ default: {} }))

import { AccountManager } from './AccountManager.js'

function fixture(targetId = 'target') {
	const getProfile = vi.fn().mockResolvedValue({
		userid: targetId,
		balance: 125,
		level: 2,
		tier: 'bronze',
		isNewUser: false,
	})
	const members = {
		cache: new Map(),
		fetch: vi.fn().mockRejectedValue(new Error('Unknown member')),
	}
	const users = {
		fetch: vi.fn().mockRejectedValue(new Error('Unavailable user')),
	}
	const interaction = {
		guild: { members },
		client: { users },
		user: { id: 'invoker', username: 'Invoker' },
		editReply: vi.fn(),
	}
	return {
		manager: new AccountManager({ getProfile } as never),
		interaction,
		members,
		users,
	}
}
describe('profiles without privileged member cache', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})
	it('displays account data with an ID fallback when both member and user lookups fail', async () => {
		const { manager, interaction, members } = fixture()
		await manager.fetchProfile(interaction as never, 'target')
		expect(members.fetch).toHaveBeenCalledWith('target')
		expect(success.mock.calls[0][1]).toBe("target's Profile")
		expect(interaction.editReply).toHaveBeenCalled()
		expect(handleError).not.toHaveBeenCalled()
	})
	it('uses the invoking user without a second REST request when their member is missing', async () => {
		const { manager, interaction, users } = fixture('invoker')
		await manager.fetchProfile(interaction as never, 'invoker')
		expect(success.mock.calls[0][1]).toBe("Invoker's Profile")
		expect(users.fetch).not.toHaveBeenCalled()
	})
	it('preserves guild display names when the single-member lookup succeeds', async () => {
		const { manager, interaction, members, users } = fixture()
		members.fetch.mockResolvedValue({
			displayName: 'Guild nickname',
			user: { username: 'Target' },
		})
		await manager.fetchProfile(interaction as never, 'target')
		expect(success.mock.calls[0][1]).toBe("Guild nickname's Profile")
		expect(users.fetch).not.toHaveBeenCalled()
	})
})
