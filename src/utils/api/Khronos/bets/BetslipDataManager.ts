import type { PlacedBetslip } from '@kh-openapi';
import { helpfooter } from '@pluto-config';
import { type CommandInteraction, EmbedBuilder, type Guild } from 'discord.js';
import embedColors from '../../../../lib/colorsConfig.js';
import { patreonFooter } from '../../patreon/interfaces.js';
import type BetslipWrapper from './betslip-wrapper.js';

export default class BetslipDataManager {
	constructor(private betslipWrapper: BetslipWrapper) {}

	async getActiveBets(interaction: CommandInteraction, userId: string) {
		const activeBets = await this.betslipWrapper.activeBetsForUser({
			userid: userId,
		});
		const guild = interaction.guild;
		if (!guild) {
			throw new Error('Guild not identified from interaction.');
		}
		return this.displayUsersBets(guild, activeBets);
	}

	async displayUsersBets(guild: Guild, bets: PlacedBetslip[]) {
		const embed = new EmbedBuilder()
			.setTitle('🎲 Active Bets')
			.setColor(embedColors.PlutoYellow) // Default embed color
			.setFooter(patreonFooter || { text: helpfooter() });

		if (bets.length === 0) {
			embed
				.setDescription('No active bets found.')
				.setColor(embedColors.PlutoRed);
			return embed;
		}

		bets.forEach((bet) => {
			const teamEmoji =
				guild.emojis.cache.find((emoji) => emoji.name === bet.team) || '';
			const teamShortName = bet.team.split(' ').pop() ?? bet.team;
			const chosenTeamStr = `${teamEmoji} ${teamShortName}`;

			const description = `**${chosenTeamStr}** -> **\`$${bet.amount}\`** | **Profit/Payout:** $\`${bet.profit}/$${bet.payout}\``;
			embed.addFields({
				name: `Bet ID: ${bet.betid}`,
				value: description,
				inline: true,
			});
		});

		return embed;
	}
}
