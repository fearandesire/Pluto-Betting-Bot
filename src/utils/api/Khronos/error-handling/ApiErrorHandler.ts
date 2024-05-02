import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../lib/interfaces/api/api.interface.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import { CommandInteraction } from 'discord.js'
import { IKhronosErr } from './interface.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'

export class ApiErrorHandler {
	async errorResponses(
		interaction: CommandInteraction,
		apiError: IKhronosErr,
		errModule: ApiModules,
	) {
		const errorType = apiError.exception
		let errorMessage
		let timeLeft
		switch (errorType) {
			// ? These error types will by default use the message that they arrived with
			case ApiHttpErrorTypes.UnableToFindBalance:
				errorMessage = apiError.message
				break
			case ApiHttpErrorTypes.MatchNotFound:
				errorMessage = 'The match specified could not be found.'
				break
			case ApiHttpErrorTypes.MultipleGamesForTeam:
				errorMessage = `There's more than one game available for this team.\nPlease place your bet again and specify a match.`
				break
			case ApiHttpErrorTypes.InvalidTeamForMatch:
				errorMessage = `The team specified was not valid for the match you selected.\nPlease place your bet again and select the correct match.`
				break
			case ApiHttpErrorTypes.AccountNotFound:
				errorMessage = `You don't have an account yet.\nUse \`/register\` to instantly create one!`
				break
			case ApiHttpErrorTypes.ClaimCooldown:
				if (
					apiError.details &&
					typeof apiError.details === 'object' &&
					apiError.details.timeLeft
				) {
					timeLeft = apiError.details.timeLeft
					errorMessage = `You are on cooldown for another ${timeLeft}.`
				} else {
					errorMessage = `You can only claim once every 24 hours!`
				}
				break
			case ApiHttpErrorTypes.HasPendingBet:
				errorMessage = `You have another bet you haven't finished confirming yet.\nPlease finish it before trying to place a new bet.`
				break
			case ApiHttpErrorTypes.TeamNotFound:
				errorMessage =
					'The team specified could not be found.\nPlease verify the team you provided against the currently `/odds` available'
				break
			case ApiHttpErrorTypes.GameHasStarted:
				errorMessage = 'This game has already started.'
				break
			case ApiHttpErrorTypes.NoGamesForTeam:
				errorMessage = 'There are no games available for this team.'
				break
			case ApiHttpErrorTypes.DuplicateBetslip:
				errorMessage = 'You have already placed a bet on this match!'
				break
			case ApiHttpErrorTypes.InsufficientBalance:
				if (
					apiError.details &&
					typeof apiError.details === 'object' &&
					apiError.details.balance
				) {
					errorMessage = `You only have **\`${MoneyFormatter.toUSD(apiError.details.balance)}\`** available to place bets with.`
				} else {
					errorMessage = `Your balance is insufficient to place this bet.`
				}
				break
			case ApiHttpErrorTypes.InternalError:
				errorMessage = `An internal error has occurred. Please try again later.`
				break
			case ApiHttpErrorTypes.AccountExists:
				errorMessage = `You already have an account with Pluto.`
				break
			case ApiHttpErrorTypes.NoActiveBets:
				errorMessage = `You have no active bets.`
				break
			default:
				errorMessage =
					'An unexpected server-side error has occurred. Please try again later.'
		}
		let errEmbed
		// ? Currently just changes the `title` of the embed, but more functionality may be added
		switch (errModule) {
			case ApiModules.betting:
				errEmbed = ErrorEmbeds.betErr(errorMessage)
				break
			case ApiModules.account:
				errEmbed = ErrorEmbeds.accountErr(errorMessage)
				break
			case ApiModules.unknown:
				errEmbed = ErrorEmbeds.internalErr(errorMessage)
				break
			default:
				errEmbed = ErrorEmbeds.unknownErr(errorMessage)
		}
		return interaction.editReply({
			embeds: [errEmbed],
		})
	}

	/**
	 * Handles the error that occurs during the execution of a command interaction.
	 *
	 * @param {CommandInteraction} interaction - The command interaction that triggered the error.
	 * @param {any} error - The error that occurred.
	 * @param {ApiModules} errModule - The API module related to the error.
	 * @return {Promise<void>} - A promise that resolves when the error handling is complete.
	 */
	async handle(
		interaction: CommandInteraction,
		error: any,
		errModule: ApiModules,
	) {
		if (error?.response) {
			const errorData = await error.response.json()

			return this.errorResponses(interaction, errorData, errModule)
		}
		// Fallback error handling for non-API or malformed API errors
		console.error(error)
		const errEmbed = ErrorEmbeds.internalErr(
			'Sorry, an unexpected error occurred. Please try again later.',
		)
		return interaction.editReply({ embeds: [errEmbed] })
	}
}
