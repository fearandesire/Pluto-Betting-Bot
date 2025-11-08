import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import AccountManager from '../../utils/api/Khronos/accounts/AccountManager.js'
import AccountsWrapper from '../../utils/api/Khronos/accounts/accounts-wrapper.js'

@ApplyOptions<Command.Options>({
	description: 'Instantly register your account with Pluto!',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()
		return new AccountManager(new AccountsWrapper()).createAccount(
			interaction,
			interaction.user.id,
		)
	}
}
