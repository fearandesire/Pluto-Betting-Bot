import type {
	ButtonInteraction,
	CommandInteraction,
	Message,
} from 'discord.js';
import type { EmbedBuilder } from 'discord.js';
import { APP_OWNER_INFO } from '../../../../lib/configs/constants.js';
import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../lib/interfaces/api/api.interface.js';
import { ErrorEmbeds } from '../../../common/errors/global.js';
import MoneyFormatter from '../../common/money-formatting/money-format.js';
import { toKhronosApiError } from './types.js';
import type { KhronosApiError } from './types.js';

/**
 * @summary Handles errors from the Khronos API.
 * @description Parses and handles errors. Some errors are handled with the metadata sent with the error, while most will be using the default message provided by the API error.
 * Included in the 'handling' is the built-in ability to send a response to the user.
 * This means this class is user-facing, and focused on that first-and-foremost.
 * As a fallback, this will also handle errors that cannot be identified to be originating from Khronos.
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
		if (apiError.exception === ApiHttpErrorTypes.ClaimCooldown) {
			errorMessage = `You are on cooldown and can claim again in ${apiError.details.timeLeft}`;
		} else if (apiError.exception === ApiHttpErrorTypes.InsufficientBalance) {
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
		const errEmbed = await this.createErrorEmbed(errModule, errorMessage);

		return interaction.editReply({
			embeds: [errEmbed],
		});
	}

	private async createErrorEmbed(
		errModule: ApiModules,
		errorMessage: string,
	): Promise<EmbedBuilder> {
		switch (errModule) {
			// ? Handle different error categories/types
			case ApiModules.betting:
				return await ErrorEmbeds.betErr(errorMessage);
			case ApiModules.account:
				return await ErrorEmbeds.accountErr(errorMessage);
			case ApiModules.props:
				return await ErrorEmbeds.propsErr(errorMessage);
			case ApiModules.predictions:
				return await ErrorEmbeds.predictionsErr(errorMessage);
			case ApiModules.unknown:
				return await ErrorEmbeds.internalErr(errorMessage);
			// ? Fallback
			default:
				return await ErrorEmbeds.unknownErr(errorMessage);
		}
	}

	/**
	 * Handles errors from the Khronos API and provides appropriate user feedback
	 */
	async handle(
		interaction: CommandInteraction | ButtonInteraction | null,
		error: unknown,
		errModule: ApiModules,
	): Promise<Message<boolean>> {
		try {
			const khronosError = await toKhronosApiError(error);

			if (interaction) {
				await this.errorResponses(interaction, khronosError, errModule);
				return;
			}
			// nO interaction provided, fallback to throwing the error again. someone will catch this dang thing
			console.error({
				source: 'ApiErrorHandler.handle',
				message:
					'An error occurred and no interaction was provided - re-throwing error',
				error: error,
			});
			throw error;
		} catch (e) {
			console.error({
				source: 'ApiErrorHandler.handle',
				message: 'Issue while handling an error',
				error: e,
			});
			const errEmbed = await ErrorEmbeds.internalErr(
				`An issue occurred while handling an error related to your request.\n\nIf this issue persists, please contact ${APP_OWNER_INFO.discord_username}`,
			);
			await interaction.editReply({ embeds: [errEmbed] });
		}
	}
}
