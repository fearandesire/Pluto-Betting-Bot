import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Colors } from 'discord.js';
import { helpfooter } from '../../lib/pluto-config.js';
import StatsWraps from '../../utils/api/Khronos/stats/stats-wrapper.js';

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
				),
		);
	}

	public async viewH2hStats(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		try {
			await interaction.deferReply();
			const stats = new StatsWraps();
			const overallStats = await stats.getOverallStats({
				userId: interaction.user.id,
			});

			if (!overallStats || overallStats.totalBets === 0) {
				const noStatsEmbed = {
					color: Colors.Red,
					title: '❌ No Betting Stats Available',
					description:
						"You don't have enough betting history to display statistics.",
					footer: {
						text: await helpfooter(),
					},
				};
				return await interaction.editReply({ embeds: [noStatsEmbed] });
			}

			const formatValue = (value: number) =>
				value === 0 ? 'N/A' : `$${value.toLocaleString()}`;
			const formatPercentage = (value: number) =>
				value === 0 ? 'N/A' : `${(value * 100).toFixed(1)}%`;

			const embed = {
				color: Colors.Blue,
				title: `🎲 ${interaction.user.username}'s Betting Stats`,
				fields: [
					{
						name: '📊 Totals',
						value: [
							`Bets: **${formatValue(overallStats.totalBets)}**`,
							`Wins: **${formatValue(overallStats.totalWins)}**`,
							`Losses: **${formatValue(overallStats.totalLosses)}**`,
							`Win Rate: **${formatPercentage(overallStats.winRate)}**`,
							`Highest Bet: **${formatValue(overallStats.highestBetAmount)}** 💰`,
						].join('\n'),
						inline: false,
					},
					{
						name: '🏆 Most Bet Team',
						value:
							overallStats.mostBetTeam.count === 0
								? 'N/A'
								: `Team: **${overallStats.mostBetTeam.team}**\nBets: **${overallStats.mostBetTeam.count}**`,
						inline: true,
					},
					{
						name: '😅 Most Losses Team',
						value:
							overallStats.mostLossesTeam.losses === 0
								? 'N/A'
								: `Team: **${overallStats.mostLossesTeam.team}**\nLosses: **${overallStats.mostLossesTeam.losses}**`,
						inline: true,
					},
					{
						name: '💵 Profit/Loss Summary',
						value: [
							`Total Profit: **${formatValue(overallStats.profitLossSummary.totalWon)}**`,
							`Total Loss: **${formatValue(overallStats.profitLossSummary.totalLost)}**`,
							`Net Profit: **${formatValue(overallStats.profitLossSummary.netProfit)}**`,
						].join('\n'),
						inline: false,
					},
				],
				timestamp: new Date().toISOString(),
				footer: {
					text: await helpfooter(),
				},
			};

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			return await interaction.editReply({
				content: 'An error occurred while fetching your stats.',
			});
		}
	}
}
