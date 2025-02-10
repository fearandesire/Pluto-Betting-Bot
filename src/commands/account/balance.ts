import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { InteractionContextType } from 'discord.js';
import {
	AccountManager,
	AccountsWrapper,
} from '../../utils/api/requests/accounts/AccountManager.js';

@ApplyOptions<Command.Options>({
	description: '🏦 View the balance of a user',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.addUserOption((option) =>
						option
							.setName('user')
							.setDescription('Optional | User to view balance of')
							.setRequired(false),
					),
			{ idHints: ['1022954913489223690'] },
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		const targetUser = interaction.options.getUser('user') ?? interaction.user;
		const targetId = targetUser.id;
		return new AccountManager(new AccountsWrapper()).getBalance(
			interaction,
			targetId,
		);
	}
}
