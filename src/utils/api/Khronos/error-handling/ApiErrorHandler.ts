import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../lib/interfaces/api/api.interface.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import { CommandInteraction } from 'discord.js'
import { IKhronosErr } from './interface.js'

export class ApiErrorHandler {
	async errorResponses(
		interaction: CommandInteraction,
		apiError: IKhronosErr,
		errModule: ApiModules,
	) {
		const errorType = apiError.exception
		let errorMessage

		switch (errorType) {
			case ApiHttpErrorTypes.AccountNotFound:
			case ApiHttpErrorTypes.UnableToFindBalance:
			case ApiHttpErrorTypes.ClaimCooldown:
				errorMessage = apiError.message
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
				errorMessage = `Your balance is insufficient to place this bet.`
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

	async handle(
		interaction: CommandInteraction,
		error: any,
		errModule: ApiModules,
	) {
		let apiError: IKhronosErr
		if (error?.response) {
			const { statusCode, message, exception } =
				await error.response.json()
			apiError = {
				statusCode,
				message,
				exception,
			}
			return this.errorResponses(interaction, apiError, errModule)
		}
		// Fallback error handling for non-API or malformed API errors
		console.error(error)
		const errEmbed = ErrorEmbeds.internalErr(
			'Sorry, an unexpected error occurred. Please try again later.',
		)
		return interaction.editReply({ embeds: [errEmbed] })
	}
}
