import { ChannelType } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetGuildById } = vi.hoisted(() => ({
	mockGetGuildById: vi.fn(),
}))

vi.mock('@pluto-khronos/api-client', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@pluto-khronos/api-client')>()
	return {
		...actual,
		GuildsApi: class {
			getGuildById = mockGetGuildById
		},
	}
})

vi.mock('../../KhronosInstances.js', () => ({ KH_API_CONFIG: {} }))
vi.mock('../../../../dev/index.js', () => ({
	isMockEnabled: () => false,
	MockBackend: class {},
}))

const { container } = await import('@sapphire/framework')
const { default: GuildWrapper } = await import('../guild-wrapper.js')
const { default: AppLog } = await import('../../../../logging/AppLog.js')
const { LogType } = await import('../../../../logging/AppLog.interface.js')

const GUILD_ID = '555171631539028000'
const LOG_CHANNEL_ID = '1100000000000000001'

function guildWith(
	config: Array<{ setting_type: string; setting_value: string }>,
) {
	return { guild_id: GUILD_ID, config } as never
}

const LOG_THEN_FALSE = [
	{ setting_type: 'LOGS_CHAN', setting_value: LOG_CHANNEL_ID },
	{ setting_type: 'LOGS_ENABLED', setting_value: 'false' },
]

const LOG_THEN_TRUE = [
	{ setting_type: 'LOGS_CHAN', setting_value: LOG_CHANNEL_ID },
	{ setting_type: 'LOGS_ENABLED', setting_value: 'true' },
]

const LOG_ONLY = [{ setting_type: 'LOGS_CHAN', setting_value: LOG_CHANNEL_ID }]

describe('log channel sender honours LOGS_ENABLED', () => {
	const send = vi.fn(async () => ({ id: 'message-1' }))
	const fetchChannel = vi.fn()
	const channel = {
		id: LOG_CHANNEL_ID,
		type: ChannelType.GuildText,
		send,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		fetchChannel.mockResolvedValue(channel)
		;(container as { client: unknown }).client = {
			channels: { fetch: fetchChannel },
			user: null,
		}
	})

	it('does not fetch or send when LOGS_ENABLED is false', async () => {
		mockGetGuildById.mockResolvedValue(guildWith(LOG_THEN_FALSE))

		const result = await new GuildWrapper().sendToLogChannel(GUILD_ID, {
			content: 'test',
		})

		expect(result).toBeNull()
		expect(fetchChannel).not.toHaveBeenCalled()
		expect(send).not.toHaveBeenCalled()
	})

	it.each([
		{ label: 'absent', config: LOG_ONLY },
		{ label: 'true', config: LOG_THEN_TRUE },
	])('posts when LOGS_ENABLED is $label', async ({ config }) => {
		mockGetGuildById.mockResolvedValue(guildWith(config))

		const result = await new GuildWrapper().sendToLogChannel(GUILD_ID, {
			content: 'test',
		})

		expect(result).toEqual({ id: 'message-1' })
		expect(send).toHaveBeenCalledTimes(1)
	})

	it('AppLog skips the log channel when LOGS_ENABLED is false', async () => {
		mockGetGuildById.mockResolvedValue(guildWith(LOG_THEN_FALSE))

		await AppLog.log({
			guildId: GUILD_ID,
			description: 'test log',
			type: LogType.Info,
		})

		expect(fetchChannel).not.toHaveBeenCalled()
		expect(send).not.toHaveBeenCalled()
	})
})
