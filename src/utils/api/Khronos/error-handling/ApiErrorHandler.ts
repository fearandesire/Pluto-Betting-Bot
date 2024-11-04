import type { ButtonInteraction, CommandInteraction } from 'discord.js';
import type { EmbedBuilder } from 'discord.js';
import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../lib/interfaces/api/api.interface.js';
import { ErrorEmbeds } from '../../../common/errors/global.js';
import MoneyFormatter from '../../common/money-formatting/money-format.js';
import { isKhronosApiError, toKhronosApiError } from './types.js';
import type { KhronosApiError } from './types.js';
import { APP_OWNER_INFO } from '../../../../lib/configs/constants.js';

/**
 * @summary Handles errors from the Khronos API.
 * @description Parses and handles errors. Some errors are handled with the metadata sent with the error, while most will be using the default message provided by the API error.
 * Included in the 'handling' is the built-in ability to send a response to the user.
 * This means this class is user-facing, and focused on that first-and-foremost.
 */
export class ApiErrorHandler {
	private async errorResponses(
		interaction: CommandInteraction | ButtonInteraction,
		apiError: KhronosApiError,
		errModule: ApiModules,
	) {
		let errorMessage: string;
		const defaultMessages = {
			default:
				'An unexpected server-side error has occurred. Please try again later.',
		};

		// Handle specific error cases
		if (apiError.exception === ApiHttpErrorTypes.InsufficientBalance) {
			if (
				apiError.details?.balance &&
				typeof apiError.details.balance === 'number'
			) {
				errorMessage = `You only have **\`${MoneyFormatter.toUSD(apiError.details.balance)}\`** available to place bets with.`;
			} else {
				errorMessage = 'Your balance is insufficient to place this bet.';
			}
		} else {
			errorMessage = apiError.message ?? defaultMessages.default;
		}

		// Create appropriate error embed
		const errEmbed = this.createErrorEmbed(errModule, errorMessage);

		return interaction.editReply({
			embeds: [errEmbed],
		});
	}

	private createErrorEmbed(
		errModule: ApiModules,
		errorMessage: string,
	): EmbedBuilder {
		switch (errModule) {
			// ? Handle different error categories/types
			case ApiModules.betting:
				return ErrorEmbeds.betErr(errorMessage);
			case ApiModules.account:
				return ErrorEmbeds.accountErr(errorMessage);
			case ApiModules.props:
				return ErrorEmbeds.propsErr(errorMessage);
			case ApiModules.predictions:
				return ErrorEmbeds.predictionsErr(errorMessage);
			case ApiModules.unknown:
				return ErrorEmbeds.internalErr(errorMessage);
			// ? Fallback
			default:
				return ErrorEmbeds.unknownErr(errorMessage);
		}
	}

	/**
	 * Handles errors from the Khronos API and provides appropriate user feedback
	 */
	async handle(
		interaction: CommandInteraction | ButtonInteraction,
		error: unknown,
		errModule: ApiModules,
	): Promise<void> {
		try {
			const khronosError = await toKhronosApiError(error);
			await this.errorResponses(interaction, khronosError, errModule);
		} catch (e) {
			console.error('Error while handling API error:', e);
			const errEmbed = ErrorEmbeds.internalErr(
				`An issue occurred while handling an error related to your request.\n\nIf this issue persists, please contact ${APP_OWNER_INFO.discord_username}`,
			);
			await interaction.editReply({ embeds: [errEmbed] });
		}
	}
}
