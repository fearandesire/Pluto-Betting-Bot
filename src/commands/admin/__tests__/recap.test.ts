import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetSettings = vi.fn()
const mockPost = vi.fn()

vi.mock('../../../utils/api/Khronos/recap/recap-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getSettings: mockGetSettings }
	}),
}))

vi.mock('../../../utils/recap/recap-post-service.js', () => ({
	RECAP_POST_TYPES: ['weekly', 'monthly'],
	RECAP_POST_SPORTS: ['nfl', 'nba'],
	RecapPostService: vi.fn().mockImplementation(function () {
		return { post: mockPost }
	}),
	explicitChannelResolver: {},
}))

const { SlashCommandBuilder } = await import('discord.js')
const { UserCommand } = await import('../recap.js')

function makeInteraction(overrides: Record<string, unknown> = {}) {
	const values: Record<string, string | null> = {
		type: 'weekly',
		sport: null,
	}
	return {
		guildId: 'guild-1',
		channelId: 'interaction-channel',
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: {
			getString: vi.fn((name: string) => values[name] ?? null),
		},
		...overrides,
	}
}

describe('/recap post', () => {
	let command: InstanceType<typeof UserCommand>

	beforeEach(() => {
		vi.clearAllMocks()
		command = Object.create(UserCommand.prototype) as InstanceType<
			typeof UserCommand
		>
		Object.defineProperty(command, 'container', {
			configurable: true,
			value: { logger: { error: vi.fn(), warn: vi.fn() } },
		})
	})

	it('registers a guild-only post subcommand with type and sport', () => {
		const registry = { registerChatInputCommand: vi.fn() }
		Object.defineProperties(command, {
			name: { configurable: true, value: 'recap' },
			description: {
				configurable: true,
				value: 'Post a guild recap now',
			},
		})

		command.registerApplicationCommands(registry as never)

		const [builder] = registry.registerChatInputCommand.mock.calls[0]
		const json = builder(new SlashCommandBuilder()).toJSON()
		expect(json.name).toBe('recap')
		expect(json.contexts).toEqual([0])
		expect(json.default_member_permissions).toBe('32')
		const post = json.options?.[0] as {
			name: string
			options?: Array<{
				name: string
				required?: boolean
				choices?: Array<{ value: string }>
			}>
		}
		expect(post.name).toBe('post')
		expect(post.options?.map((option) => option.name)).toEqual([
			'type',
			'sport',
		])
		expect(
			post.options?.find((option) => option.name === 'type')?.choices,
		).toEqual([
			{ name: 'WEEKLY', value: 'weekly' },
			{ name: 'MONTHLY', value: 'monthly' },
		])
	})

	it('prefers the saved settings channel and reports the post', async () => {
		mockGetSettings.mockResolvedValue([
			{ guild_id: 'guild-1', channel_id: 'settings-channel' },
		])
		mockPost.mockResolvedValue({
			channel_id: 'settings-channel',
			message_id: 'message-1',
		})
		const interaction = makeInteraction()

		await command.handlePost(interaction as never)

		expect(mockPost).toHaveBeenCalledWith({
			guildId: 'guild-1',
			channelId: 'settings-channel',
			type: 'weekly',
			sport: 'nfl',
		})
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: 'Posted the weekly NFL recap in <#settings-channel>.',
		})
	})

	it('falls back to the invoking channel when no settings row exists', async () => {
		mockGetSettings.mockResolvedValue([])
		mockPost.mockResolvedValue({
			channel_id: 'interaction-channel',
			message_id: 'message-1',
		})

		await command.handlePost(makeInteraction() as never)

		expect(mockPost).toHaveBeenCalledWith(
			expect.objectContaining({ channelId: 'interaction-channel' }),
		)
	})

	it('reports a delivery failure instead of throwing', async () => {
		mockGetSettings.mockResolvedValue([])
		mockPost.mockRejectedValue(new Error('Discord is down'))
		const interaction = makeInteraction()

		await command.handlePost(interaction as never)

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: 'Discord is down',
		})
	})

	it('refuses a DM', async () => {
		const interaction = makeInteraction({ guildId: null })

		await command.handlePost(interaction as never)

		expect(mockPost).not.toHaveBeenCalled()
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: 'This command can only be used in a guild.',
		})
	})
})
