import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	h2hNoStatsEmbed,
	h2hStatsEmbed,
	propNoStatsEmbed,
	propStatsEmbed,
	propStatsErrorEmbed,
} from '../../lib/discord/builders/account.js'
import { helpfooter } from '../../lib/PlutoConfig.js'
import StatsWraps, {
	type PropStatsSport,
	PropStatsUnavailableError,
} from '../../utils/api/Khronos/stats/stats-wrapper.js'

@ApplyOptions<Subcommand.Options>({
	description: '📈 View Your Betting Stats',
	subcommands: [
		{
			name: 'h2h',
			type: 'group',
			entries: [
				{
					name: 'view',
					chatInputRun: 'viewH2hStats',
				},
			],
		},
		{
			name: 'props',
			chatInputRun: 'viewPropStats',
		},
	],
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setContexts([0])
				.addSubcommandGroup((group) =>
					group
						.setName('h2h')
						.setDescription('View your betting stats for h2h bets')
						.addSubcommand((subcommand) =>
							subcommand
								.setName('view')
								.setDescription('View your h2h betting stats'),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('props')
						.setDescription('View your prop prediction hit rate')
						.addStringOption((option) =>
							option
								.setName('sport')
								.setDescription(
									'Limit to one sport (default: all)',
								)
								.setRequired(false)
								.addChoices(
									{ name: 'NBA', value: 'nba' },
									{ name: 'NFL', value: 'nfl' },
								),
						),
				),
		)
	}

	public async viewH2hStats(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		try {
			await interaction.deferReply()
			const stats = new StatsWraps()
			const overallStats = await stats.getOverallStats({
				userId: interaction.user.id,
			})

			if (!overallStats || overallStats.totalBets === 0) {
				const noStatsEmbed = h2hNoStatsEmbed(
					await helpfooter('general'),
				)
				return await interaction.editReply({ embeds: [noStatsEmbed] })
			}

			const embed = h2hStatsEmbed(
				interaction.user.username,
				overallStats,
				await helpfooter('general'),
			)

			await interaction.editReply({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error('Failed to fetch h2h stats', {
				userId: interaction.user.id,
				error,
			})
			return await interaction.editReply({
				content: 'An error occurred while fetching your stats.',
			})
		}
	}

	public async viewPropStats(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		try {
			await interaction.deferReply()
			const sport = interaction.options.getString(
				'sport',
			) as PropStatsSport | null
			const stats = await new StatsWraps().getPropBettingStats({
				userId: interaction.user.id,
				sport: sport ?? undefined,
				guildId: interaction.guildId ?? undefined,
			})
			const footer = await helpfooter('general')

			if (stats.total_settled === 0 && stats.pending === 0) {
				return await interaction.editReply({
					embeds: [propNoStatsEmbed(footer)],
				})
			}

			await interaction.editReply({
				embeds: [
					propStatsEmbed(interaction.user.username, stats, footer),
				],
			})
		} catch (error) {
			const log =
				error instanceof PropStatsUnavailableError
					? this.container.logger.warn
					: this.container.logger.error
			log.call(this.container.logger, 'Failed to fetch prop stats', {
				userId: interaction.user.id,
				error,
			})
			return await interaction.editReply({
				embeds: [propStatsErrorEmbed(await helpfooter('general'))],
			})
		}
	}
}
