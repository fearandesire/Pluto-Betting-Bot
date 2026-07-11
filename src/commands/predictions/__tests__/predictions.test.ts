import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetLeaderboard = vi.fn()
const mockGetActivePredictionsForUser = vi.fn()

vi.mock(
	'../../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js',
	() => ({
		default: vi.fn().mockImplementation(function () {
			return { getLeaderboard: mockGetLeaderboard }
		}),
	}),
)

vi.mock(
	'../../../utils/api/Khronos/prediction/predictionApiWrapper.js',
	() => ({
		default: vi.fn().mockImplementation(function () {
			return {
				getActivePredictionsForUser: mockGetActivePredictionsForUser,
			}
		}),
	}),
)

vi.mock('../../../utils/api/Khronos/props/props-api-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getPropByUuid: vi.fn() }
	}),
}))

vi.mock('../../../utils/common/TeamInfo.js', () => ({
	default: {
		resolveTeamIdentifier: vi.fn().mockResolvedValue({
			away_team: 'AWY',
			home_team: 'HME',
		}),
	},
}))

vi.mock('../../../utils/bot_res/ClientTools.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { resolveMember: vi.fn() }
	}),
}))

vi.mock('@sapphire/discord.js-utilities', () => ({
	PaginatedMessageEmbedFields: vi.fn().mockImplementation(function () {
		return {
			setItems: vi.fn().mockReturnThis(),
			setItemsPerPage: vi.fn().mockReturnThis(),
			make: vi.fn().mockReturnValue({ run: vi.fn() }),
		}
	}),
}))

const { SlashCommandBuilder } = await import('discord.js')
const { UserCommand } = await import('../predictions.js')

function makeInteraction() {
	return {
		guildId: 'guild-1',
		user: { id: 'user-1', username: 'Fenix' },
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: {
			getUser: vi.fn().mockReturnValue(null),
			getString: vi.fn().mockReturnValue(null),
		},
	}
}

describe('/predictions', () => {
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

	it('registers guild-only history, stats, and leaderboard subcommands', () => {
		const registry = {
			registerChatInputCommand: vi.fn(),
		}
		Object.defineProperties(command, {
			name: { configurable: true, value: 'predictions' },
			description: {
				configurable: true,
				value: 'View prediction history, stats, and leaderboard',
			},
		})

		command.registerApplicationCommands(registry as never)

		expect(registry.registerChatInputCommand).toHaveBeenCalledTimes(1)
		const [builder, options] =
			registry.registerChatInputCommand.mock.calls[0]
		const json = builder(new SlashCommandBuilder()).toJSON()

		expect(json.name).toBe('predictions')
		expect(json.contexts).toEqual([0])
		expect(json.options?.map((option) => option.name)).toEqual([
			'history',
			'stats',
			'leaderboard',
		])
		expect(options.idHints).toEqual(['1298280482123026537'])
	})

	it('renders server-calculated stats and pending count', async () => {
		mockGetLeaderboard.mockResolvedValue({
			entries: [
				{
					user_id: 'user-1',
					total_predictions: 12,
					correct_predictions: 9,
					incorrect_predictions: 3,
					success_rate: 75,
				},
			],
			total_users: 1,
		})
		mockGetActivePredictionsForUser.mockResolvedValue([
			{ id: 'pending-1', guild_id: 'guild-1' },
			{ id: 'pending-2', guild_id: 'guild-1' },
		])

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(mockGetLeaderboard).toHaveBeenCalledWith({ guildId: 'guild-1' })
		expect(mockGetActivePredictionsForUser).toHaveBeenCalledWith({
			userId: 'user-1',
		})
		const [{ embeds }] = interaction.editReply.mock.calls.find(
			([payload]) => payload.embeds,
		) as [{ embeds: Array<{ toJSON: () => unknown }> }]
		const embed = embeds[0].toJSON() as {
			title?: string
			description?: string
			fields?: unknown[]
		}
		expect(embed.title).toBe('📊 Prediction Statistics')
		expect(embed.description).toContain('Server stats')
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Total Predictions',
					value: '`12`',
				}),
				expect.objectContaining({ name: 'Win Rate', value: '`75.0%`' }),
				expect.objectContaining({ name: '⏳ Pending', value: '`2`' }),
			]),
		)
	})

	it('returns friendly empty copy when server stats and pending data are empty', async () => {
		mockGetLeaderboard.mockResolvedValue({ entries: [], total_users: 0 })
		mockGetActivePredictionsForUser.mockResolvedValue([])

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: "You haven't made any predictions yet.",
		})
	})

	it('does not count pending predictions from another guild', async () => {
		mockGetLeaderboard.mockResolvedValue({ entries: [], total_users: 0 })
		mockGetActivePredictionsForUser.mockResolvedValue([
			{ id: 'pending-other-guild', guild_id: 'guild-2' },
		])

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: "You haven't made any predictions yet.",
		})
	})
})
