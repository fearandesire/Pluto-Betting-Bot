import { type CommandInteraction, EmbedBuilder } from 'discord.js';
import embedColors from '../../../../lib/colorsConfig.js';
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js';
import { ApiErrorHandler } from '../error-handling/ApiErrorHandler.js';
import type AccountsWrapper from './accounts-wrapper.js';

export default class AccountManager {
	public constructor(private accountWrapper: AccountsWrapper) {}

	public async createAccount(interaction: CommandInteraction, userId: string) {
		try {
			const account = await this.accountWrapper.createAccount(userId);
			if (!account) {
				return new ApiErrorHandler().handle(
					interaction,
					'Failed to create account.',
					ApiModules.unknown,
				);
			}
			const accountCreatedEmbed = new EmbedBuilder()
				.setTitle('Account Created')
				.setDescription(
					`Your account has been created! You will start off with a balance of $${account.monies.balance}.\nIf you run out of money, you can get get more by claiming daily rewards from the \`/dailyclaim\` command.`,
				)
				.setColor(embedColors.PlutoGreen)
				.setThumbnail(interaction.user.displayAvatarURL());
			return interaction.editReply({ embeds: [accountCreatedEmbed] });
		} catch (e) {
			return new ApiErrorHandler().handle(interaction, e, ApiModules.account);
		}
	}
}
