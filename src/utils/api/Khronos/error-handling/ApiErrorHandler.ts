import type {
	ButtonInteraction,
	CommandInteraction,
	EmbedBuilder,
	Message,
} from 'discord.js'
import { APP_OWNER_INFO } from '../../../../lib/configs/constants.js'
import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../lib/interfaces/api/api.interface.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import type { KhronosApiError } from './types.js'
import { toKhronosApiError } from './types.js'

/**
 * @summary Handles errors from the Khronos API.
 * @description Parses and handles errors. Some errors are handled with the metadata sent with the error, while most will be using the default message provided by the API error.
 * Included in the 'handling' is the built-in ability to send a response to the user.
 * This means this class is user-facing, and focused on that first-and-foremost.
 * As a fallback, this will also handle errors that cannot be identified to be originating from Khronos.
 */
export class ApiErrorHandler {
	private static readonly pendingTimeouts = new Map<string, NodeJS.Timeout>()

	private async safeDeleteMessage(
		msg: Message<boolean>,
		source: string,
	): Promise<void> {
		try {
			if (!msg.deletable) {
				console.warn({
					source,
					message: 'Message is not deletable, skipping deletion',
					messageId: msg.id,
				})
				this.clearTimeout(msg.id)
				return
			}

			if (!msg.channel) {
				console.warn({
					source,
					message:
						'Message channel no longer exists, skipping deletion',
					messageId: msg.id,
				})
				this.clearTimeout(msg.id)
				return
			}

			await msg.delete()
			this.clearTimeout(msg.id)
		} catch (err) {
			console.error({
				source,
				message: 'Failed to delete error message',
				error: err,
				messageId: msg.id,
			})
			this.clearTimeout(msg.id)
		}
	}

	private clearTimeout(messageId: string): void {
		const timeout = ApiErrorHandler.pendingTimeouts.get(messageId)
		if (timeout) {
			clearTimeout(timeout)
			ApiErrorHandler.pendingTimeouts.delete(messageId)
		}
	}

	private scheduleMessageDeletion(
		msg: Message<boolean>,
		source: string,
	): void {
		// Skip deletion for ephemeral messages - they auto-expire after 15 minutes
		if (msg.flags.has('Ephemeral')) {
			return
		}
		const timeoutId = setTimeout(() => {
			this.safeDeleteMessage(msg, source)
		}, 30000)
		ApiErrorHandler.pendingTimeouts.set(msg.id, timeoutId)
	}

	static cleanupAllTimeouts(): void {
		for (const timeout of ApiErrorHandler.pendingTimeouts.values()) {
			clearTimeout(timeout)
		}
		ApiErrorHandler.pendingTimeouts.clear()
	}

	private resolveErrorMessage(apiError: KhronosApiError): string {
		const defaultMessages = {
			default:
				'An unexpected server-side error has occurred. Please try again later.',
		}

		if (apiError.exception === ApiHttpErrorTypes.ClaimCooldown) {
			if (apiError.details?.timeLeft) {
				return `You are on cooldown and can claim again in ${apiError.details.timeLeft}`
			}
			return 'You are on cooldown. Please try again later.'
		}

		if (apiError.exception === ApiHttpErrorTypes.InsufficientBalance) {
			if (typeof apiError.details?.balance === 'number') {
				return `You only have **\`${MoneyFormatter.toUSD(apiError.details.balance)}\`** available to place bets with.`
			}
			return 'Your balance is insufficient to place this bet.'
		}

		return apiError.message ?? defaultMessages.default
	}

	private async errorResponses(
		interaction: CommandInteraction | ButtonInteraction,
		apiError: KhronosApiError,
		errModule: ApiModules,
	): Promise<Message<boolean>> {
		const errorMessage = this.resolveErrorMessage(apiError)

		const errEmbed = await this.createErrorEmbed(errModule, errorMessage)

		const msg = await interaction.editReply({
			embeds: [errEmbed],
		})
		this.scheduleMessageDeletion(msg, 'ApiErrorHandler.errorResponses')
		return msg
	}

	private async createErrorEmbed(
		errModule: ApiModules,
		errorMessage: string,
	): Promise<EmbedBuilder> {
		switch (errModule) {
			// ? Handle different error categories/types
			case ApiModules.betting:
				return await ErrorEmbeds.betErr(errorMessage)
			case ApiModules.account:
				return await ErrorEmbeds.accountErr(errorMessage)
			case ApiModules.props:
				return await ErrorEmbeds.propsErr(errorMessage)
			case ApiModules.predictions:
				return await ErrorEmbeds.predictionsErr(errorMessage)
			case ApiModules.unknown:
				return await ErrorEmbeds.internalErr(errorMessage)
			// ? Fallback
			default:
				return await ErrorEmbeds.unknownErr(errorMessage)
		}
	}

	/**
	 * Gets the error message string from an error without sending a response
	 * @param error The error to process
	 * @returns The user-friendly error message string
	 */
	async getErrorMessage(error: unknown): Promise<string> {
		try {
			const khronosError = await toKhronosApiError(error)
			return this.resolveErrorMessage(khronosError)
		} catch (e) {
			console.error({
				source: 'ApiErrorHandler.getErrorMessage',
				message: 'Issue while processing error message',
				error: e,
			})
			return `An issue occurred while handling an error related to your request.\n\nIf this issue persists, please contact ${APP_OWNER_INFO.discord_username}`
		}
	}

	/**
	 * Handles errors from the Khronos API and provides appropriate user feedback
	 * @returns The error message that was sent to the user
	 */
	async handle(
		interaction: CommandInteraction | ButtonInteraction | null,
		error: unknown,
		errModule: ApiModules,
	): Promise<Message<boolean>> {
		try {
			const khronosError = await toKhronosApiError(error)

			if (interaction) {
				return await this.errorResponses(
					interaction,
					khronosError,
					errModule,
				)
			}
			// nO interaction provided, fallback to throwing the error again. someone will catch this dang thing
			console.error({
				source: 'ApiErrorHandler.handle',
				message:
					'An error occurred and no interaction was provided - re-throwing error',
				error: error,
			})
			throw error
		} catch (e) {
			console.error({
				source: 'ApiErrorHandler.handle',
				message: 'Issue while handling an error',
				error: e,
			})
			const errEmbed = await ErrorEmbeds.internalErr(
				`An issue occurred while handling an error related to your request.\n\nIf this issue persists, please contact ${APP_OWNER_INFO.discord_username}`,
			)

			if (!interaction) {
				console.error({
					source: 'ApiErrorHandler.handle',
					message:
						'Cannot send error embed - no interaction provided',
				})
				throw e
			}

			const msg = await interaction.editReply({ embeds: [errEmbed] })
			this.scheduleMessageDeletion(msg, 'ApiErrorHandler.handle')
			return msg
		}
	}
}
