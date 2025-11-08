import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import env from '../../lib/startup/env.js'
import {
	AccountManager,
	AccountsWrapper,
} from '../../utils/api/requests/accounts/AccountManager.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

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

		if (env.MAINTENANCE_MODE) {
			const errEmbed = await ErrorEmbeds.maintenanceMode()
			return interaction.editReply({ embeds: [errEmbed] })
		}

		const accountManager = new AccountManager(new AccountsWrapper())
		return accountManager.claim(interaction)
	}
}
