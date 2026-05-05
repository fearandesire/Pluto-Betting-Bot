import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
} from 'discord.js'
import { DEV_IDS } from '../../lib/configs/constants.js'
import env from '../../lib/startup/env.js'
import { makeChannelPayload } from '../../utils/dev/factories/channels.js'
import { asMockSport } from '../../utils/dev/factories/teams.js'
import { MockBackend } from '../../utils/dev/index.js'
import ChannelManager from '../../utils/guilds/channels/ChannelManager.js'
import { createLogger } from '../../utils/logging/WinstonLogger.js'

const log = createLogger({ component: 'command', command: 'dev' })

@ApplyOptions<Subcommand.Options>({
	name: 'dev',
	description: 'Owner-only mock utilities for development',
	preconditions: ['OwnerOnly'],
	requiredClientPermissions: [
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.ManageChannels,
	],
	subcommands: [
		{
			name: 'mock',
			type: 'group',
			entries: [
				{ name: 'channel-create', chatInputRun: 'mockChannelCreate' },
				{ name: 'seed-games', chatInputRun: 'mockSeedGames' },
				{ name: 'set-balance', chatInputRun: 'mockSetBalance' },
				{ name: 'reset', chatInputRun: 'mockReset' },
			],
		},
	],
})
export class DevCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.setDefaultMemberPermissions(
						PermissionFlagsBits.Administrator,
					)
					.addSubcommandGroup((group) =>
						group
							.setName('mock')
							.setDescription('Mock backend utilities')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('channel-create')
									.setDescription(
										'Create real Discord game channels in the dev guild using mock game data',
									)
									.addIntegerOption((option) =>
										option
											.setName('count')
											.setDescription(
												'How many channels to create (default: 1)',
											)
											.setMinValue(1)
											.setMaxValue(25),
									)
									.addStringOption((option) =>
										option
											.setName('sport')
											.setDescription(
												'Sport to source mock games from',
											)
											.addChoices(
												{ name: 'NBA', value: 'nba' },
												{ name: 'NFL', value: 'nfl' },
											),
									)
									.addBooleanOption((option) =>
										option
											.setName('playoffs')
											.setDescription(
												'Include playoff series + records metadata',
											),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('seed-games')
									.setDescription(
										'Seed mock games into the in-memory backend',
									)
									.addIntegerOption((option) =>
										option
											.setName('count')
											.setDescription(
												'How many games to seed (default: 5)',
											)
											.setMinValue(1)
											.setMaxValue(100),
									)
									.addStringOption((option) =>
										option
											.setName('sport')
											.setDescription('Sport to seed')
											.addChoices(
												{ name: 'NBA', value: 'nba' },
												{ name: 'NFL', value: 'nfl' },
											),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('set-balance')
									.setDescription(
										'Set a user mock balance in the in-memory backend',
									)
									.addUserOption((option) =>
										option
											.setName('user')
											.setDescription('Target user')
											.setRequired(true),
									)
									.addIntegerOption((option) =>
										option
											.setName('amount')
											.setDescription('Balance amount')
											.setRequired(true)
											.setMinValue(0),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('reset')
									.setDescription(
										'Reset all mock games, balances, and bets',
									),
							),
					),
			{
				idHints: [],
				guildIds: [DEV_IDS.guild],
			},
		)
	}

	public async mockSeedGames(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.runMockCommand(interaction, 'seed-games', () => {
			const sport =
				interaction.options.getString('sport') ?? env.MOCK_GUILD_SPORT
			const count = interaction.options.getInteger('count') ?? 5
			const response = MockBackend.instance().seedGames(
				sport === 'nfl' ? 'nfl' : 'nba',
				count,
			)

			return `Seeded ${response.matches.length} ${sport.toUpperCase()} mock games.`
		})
	}

	public async mockSetBalance(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.runMockCommand(interaction, 'set-balance', () => {
			const user = interaction.options.getUser('user', true)
			const amount = interaction.options.getInteger('amount', true)
			const newBalance = MockBackend.instance().setBalance(
				user.id,
				amount,
			)

			return `Set mock balance for <@${user.id}> to $${newBalance.toLocaleString()}.`
		})
	}

	public async mockReset(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.runMockCommand(interaction, 'reset', () => {
			MockBackend.instance().reset()
			return 'Reset mock backend state.'
		})
	}

	public async mockChannelCreate(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.runMockCommand(interaction, 'channel-create', async () => {
			if (!interaction.guild) {
				return 'This command must be used in a guild.'
			}

			const sport = asMockSport(
				interaction.options.getString('sport') ?? env.MOCK_GUILD_SPORT,
			)
			const count = interaction.options.getInteger('count') ?? 1
			const playoffs = interaction.options.getBoolean('playoffs') ?? false

			// Both vars are startup-required when USE_MOCK_DATA is enabled
			const bettingChannelId = env.MOCK_GUILD_BETTING_CHAN_ID!
			const gameCategoryId = env.DEV_GUILD_GAMES_CATEGORY_ID!

			const payload = makeChannelPayload({
				sport,
				guildId: interaction.guild.id,
				bettingChannelId,
				gameCategoryId,
				playoffs,
				count,
			})

			await new ChannelManager().processChannels(payload)

			const names = payload.channels
				.map((c) => `\`${c.channelname}\``)
				.join(', ')
			return `Created ${payload.channels.length} dev ${sport.toUpperCase()} channel(s)${playoffs ? ' (playoffs)' : ''}: ${names}`
		})
	}

	private async runMockCommand(
		interaction: Subcommand.ChatInputCommandInteraction,
		action: string,
		handler: () => Promise<string> | string,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })

		if (!env.USE_MOCK_DATA) {
			return interaction.editReply(
				'`USE_MOCK_DATA` is disabled. Enable it before using `/dev mock` commands.',
			)
		}

		const startedAt = Date.now()

		try {
			const content = await handler()
			log.info('Dev mock command completed', {
				event: 'dev.mock_command_completed',
				action,
				durationMs: Date.now() - startedAt,
				guildId: interaction.guildId,
				channelId: interaction.channelId,
				userId: interaction.user.id,
			})

			return interaction.editReply(content)
		} catch (error) {
			log.error('Dev mock command failed', {
				event: 'dev.mock_command_failed',
				action,
				durationMs: Date.now() - startedAt,
				guildId: interaction.guildId,
				channelId: interaction.channelId,
				userId: interaction.user.id,
				err: error,
			})

			return interaction.editReply(
				`/dev mock ${action} failed. Check the console logs for details.`,
			)
		}
	}
}
