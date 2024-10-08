import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js';
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js';
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js';
import { CacheManager } from '../../utils/cache/RedisCacheManager.js';

@ApplyOptions<Command.Options>({
	description:
		'❌ Cancel a bet you have placed via the bet ID. View your bet IDs with the /mybets command.',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setDMPermission(false)
				.addIntegerOption((option) =>
					option //
						.setName('betid')
						.setDescription('The bet you are wanting to cancel')
						.setRequired(true),
				),
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		const userid = interaction.user.id;
		const betId = interaction.options.getInteger('betid')!;
		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).cancelBet(interaction, userid, betId);
	}
}
