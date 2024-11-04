import type { CommandInteraction } from 'discord.js';
import type { EmbedBuilder } from 'discord.js';
import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../lib/interfaces/api/api.interface.js';
import { ErrorEmbeds } from '../../../common/errors/global.js';
import MoneyFormatter from '../../common/money-formatting/money-format.js';
import type { IKhronosErr } from './interface.js';

/**
 * Handles errors from the Khronos API.
 */
export class ApiErrorHandler {
	async errorResponses(
		interaction: CommandInteraction,
		apiError: IKhronosErr,
		errModule: ApiModules,
	) {
		let errorMessage: string;
		const defaultMessages = {
			default:
				'An unexpected server-side error has occurred. Please try again later.',
		};
		// ? Specific handling to apply logic not run server-side
		if (apiError.exception === ApiHttpErrorTypes.InsufficientBalance) {
			if (
				apiError.details &&
				typeof apiError.details === 'object' &&
				apiError.details.balance
			) {
				errorMessage = `You only have **\`${MoneyFormatter.toUSD(apiError.details.balance)}\`** available to place bets with.`;
			} else {
				errorMessage = 'Your balance is insufficient to place this bet.';
			}
		} else if (apiError.exception) {
			errorMessage = apiError?.message ?? defaultMessages.default;
		} else {
			errorMessage = defaultMessages.default;
		}

		let errEmbed: EmbedBuilder;
		switch (errModule) {
			case ApiModules.betting:
				errEmbed = ErrorEmbeds.betErr(errorMessage);
				break;
			case ApiModules.account:
				errEmbed = ErrorEmbeds.accountErr(errorMessage);
				break;
			case ApiModules.unknown:
				errEmbed = ErrorEmbeds.internalErr(errorMessage);
				break;
			default:
				errEmbed = ErrorEmbeds.unknownErr(errorMessage);
		}
		return interaction.editReply({
			embeds: [errEmbed],
		});
	}

	/**
	 * Handles the error that occurs during the execution of a command interaction.
	 *
	 * @param {CommandInteraction} interaction - The command interaction that triggered the error.
	 * @param {unknown} error - The error that occurred.
	 * @param {ApiModules} errModule - The API module related to the error.
	 * @return {Promise<void>} - A promise that resolves when the error handling is complete.
	 */
	async handle(
		interaction: CommandInteraction,
		error: unknown,
		errModule: ApiModules,
	) {
		if (error && typeof error === 'object' && 'response' in error) {
			const errorData = await (error as { response: Response }).response.json();
			return this.errorResponses(interaction, errorData, errModule);
		}
		console.error(error);
		const errEmbed = ErrorEmbeds.internalErr(
			'Sorry, an unexpected error occurred. Please try again later.',
		);
		return interaction.editReply({ embeds: [errEmbed] });
	}
}
