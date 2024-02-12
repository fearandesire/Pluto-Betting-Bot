import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { AccountManager } from '../../utils/api/requests/accounts/AccountManager.js'
import KhronosReqHandler from '../../utils/api/common/KhronosReqHandler.js'

@ApplyOptions<Command.Options>({
	description: '💲 Claim $20 dollars every 24 hours.',
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
		return new AccountManager(new KhronosReqHandler()).processClaim(
			interaction,
		)
	}
}
