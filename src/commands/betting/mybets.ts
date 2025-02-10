import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { InteractionContextType } from 'discord.js';
import BetslipDataManager from '../../utils/api/Khronos/bets/BetslipDataManager.js';
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js';
import { ErrorEmbeds } from '../../utils/common/errors/global.js';

@ApplyOptions<Command.Options>({
	description: '🪙 View your currently active bets',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild),
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		try {
			const activeBetsEmbed = await new BetslipDataManager(
				new BetslipWrapper(),
			).getActiveBets(interaction, interaction.user.id);
			return interaction.followUp({ embeds: [activeBetsEmbed] });
		} catch (error) {
			const errEmb = await ErrorEmbeds.accountErr(
				'You currently have no active bets.',
			);
			return interaction.followUp({ embeds: [errEmb] });
		}
	}
}
