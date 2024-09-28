import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	AccountManager,
	AccountsWrapper,
} from '../../utils/api/requests/accounts/AccountManager.js';

@ApplyOptions<Command.Options>({
	description: '📊 View the current betting leaderboard',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setDMPermission(false),
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: false });
		return new AccountManager(new AccountsWrapper()).getLeaderboardData(
			interaction,
		);
	}
}
