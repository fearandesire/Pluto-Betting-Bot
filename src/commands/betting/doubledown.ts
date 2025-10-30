import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, InteractionContextType } from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import { ApiModules } from '../../lib/interfaces/api/api.interface.js';
import env from '../../lib/startup/env.js';
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js';
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js';
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js';
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js';
import MoneyFormatter from '../../utils/api/common/money-formatting/money-format.js';
import PatreonFacade from '../../utils/api/patreon/Patreon-Facade.js';
import { CacheManager } from '../../utils/cache/cache-manager.js';
import { ErrorEmbeds } from '../../utils/common/errors/global.js';
import { isApiError } from './../../lib/interfaces/errors/api-errors.js';

@ApplyOptions<Command.Options>({
	description: 'Double down an existing bet',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.addIntegerOption((option) =>
						option
							.setName('betid')
							.setDescription('The ID of the bet to double down')
							.setRequired(true),
					),
			{
				idHints: ['1233093568067932251'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		
		if (env.MAINTENANCE_MODE) {
			const errEmbed = await ErrorEmbeds.maintenanceMode();
			return interaction.editReply({ embeds: [errEmbed] });
		}

		// Ensure user is Patreon member
		const isMember = await PatreonFacade.memberDetails(interaction.user.id);
		if (!isMember || isApiError(isMember)) {
			const errEmbed = await ErrorEmbeds.patreonMembersOnly();
			await interaction.reply({
				embeds: [errEmbed],
			});
			return;
		}
		const betId = interaction.options.getInteger('betid', true);
		try {
			const betslipManager = new BetslipManager(
				new BetslipWrapper(),
				new BetsCacheService(new CacheManager()),
			);
			const newBetDetails = await betslipManager.doubleDown(
				interaction.user.id,
				betId,
			);
			const { newBetAmount, newProfit, newPayout, newBalance } =
				newBetDetails.betslip;
			// Format the money
			const formattedAmount = MoneyFormatter.toUSD(newBetAmount);
			const formattedPayout = MoneyFormatter.toUSD(newPayout);
			const formattedProfit = MoneyFormatter.toUSD(newProfit);
			const formattedBalance = MoneyFormatter.toUSD(newBalance);
			const modifiedBetEmbed = new EmbedBuilder()
				.setDescription(
					`## Double Down\n\n**Bet:** \`${formattedAmount}\` | **Payout:** \`${formattedPayout}\`\n**Profit:** \`${formattedProfit}\`\n**Balance:** \`${formattedBalance}\``,
				)
				.setColor(embedColors.success)
				.setThumbnail(interaction.user.displayAvatarURL());
			return interaction.editReply({ embeds: [modifiedBetEmbed] });
		} catch (err) {
			await new ApiErrorHandler().handle(interaction, err, ApiModules.betting);
			return;
		}
	}
}
