import type { CommandInteraction } from 'discord.js'
import { accountCreatedEmbed } from '../../../../lib/discord/builders/account.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../error-handling/ApiErrorHandler.js'
import type AccountsWrapper from './accounts-wrapper.js'

export default class AccountManager {
	public constructor(private accountWrapper: AccountsWrapper) {}

	public async createAccount(
		interaction: CommandInteraction,
		userId: string,
	) {
		try {
			const account = await this.accountWrapper.createAccount(userId)
			if (!account) {
				return await new ApiErrorHandler().handle(
					interaction,
					'Failed to create account.',
					ApiModules.unknown,
				)
			}
			const embed = accountCreatedEmbed(
				account.monies.balance,
				interaction.user.displayAvatarURL(),
			)
			return interaction.editReply({ embeds: [embed] })
		} catch (e: unknown) {
			return await new ApiErrorHandler().handle(
				interaction,
				e,
				ApiModules.account,
			)
		}
	}
}
