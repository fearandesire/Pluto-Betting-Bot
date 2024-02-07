import {
	ActionRowBuilder,
	CommandInteraction,
	EmbedBuilder,
	GuildEmoji,
	SelectMenuBuilder,
} from 'discord.js'
import { AxiosKhronosInstance } from '../common/axios-config.js'
import { SapphireClient } from '@sapphire/framework'
import { Matchup } from '../interfaces/interfaces.js'
import { OutgoingEndpoints } from '../common/endpoints.js'
import {
	IAPIBetslipPayload,
	IAPIProcessedBetslip,
	IFinalizedBetslip,
	IPendingBetslip,
	IPendingBetslipFull,
	IValidatedBetslipData,
} from '../../../lib/interfaces/api/bets/betslips.interfaces.js'
import embedColors from '../../../lib/colorsConfig.js'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { helpfooter } from '@pluto-core-config'
import { ErrorEmbeds } from '../../errors/global.js'
import {
	ApiHttpErrorTypes,
	IApiHttpError,
} from '../../../lib/interfaces/api/api.interface.js'
import axios from 'axios'
import _ from 'lodash'

export class BetslipManager {
	private readonly axiosKhronosInstance = AxiosKhronosInstance
	private client: SapphireClient

	constructor(client: SapphireClient) {
		this.axiosKhronosInstance = AxiosKhronosInstance
		this.client = client // Use the passed-in client
	}

	async initialize(
		interaction: CommandInteraction,
		userId: string,
		team: string,
		amount: number,
		guild_id: string,
	) {
		try {
			// Construct the payload for initializing the bet
			const payload: IAPIBetslipPayload = {
				userid: userId,
				team,
				amount,
				guild_id,
			}
			// Call the API to initialize the bet
			const response = await this.axiosKhronosInstance.post(
				OutgoingEndpoints.paths.bets.create, // Ensure this endpoint is for initializing a bet
				payload,
			)
			await console.debug('\u2500'.repeat(30))
			await console.debug(`API Response (.data) ==>\n`, response.data)
			if (!response || !response.data) {
				const errEmb = ErrorEmbeds.internalErr(
					`Unable to contact the server, please try again later.`,
				)
				return interaction.followUp({ embeds: [errEmb] })
			}
			if (response.data.statusCode === 200) {
				const data: IAPIProcessedBetslip = response.data
				const { betslip } = data
				const teamEmoji = (await findEmoji(team)) || ''
				const userAvatar = interaction.user.displayAvatarURL()
				return this.successfulBetEmbed(
					interaction,
					userAvatar,
					teamEmoji,
					betslip,
				)
			} else if (response.status === 202) {
				const data: IValidatedBetslipData = response.data
				await this.presentMatchChoices(
					interaction,
					data.matchupsForTeam,
				)
				await interaction.followUp({
					content:
						'Your bet is being processed. Please wait for confirmation.',
					ephemeral: true,
				})
			} else {
				const errEmb = ErrorEmbeds.internalErr(
					`An unknown error occured, please try again later.`,
				)
				return interaction.followUp({ embeds: [errEmb] })
			}
		} catch (error) {
			console.error('Error initializing bet:', error) // Log err
			if (axios.isAxiosError(error) && error.response) {
				const apiError: IApiHttpError = error.response // Declare variable & type for error obj
					?.data as IApiHttpError
				// Ensure we have data for the error
				if (_.isEmpty(apiError) || apiError === null) {
					const errEmbed = ErrorEmbeds.internalErr(
						'An unexpected error occurred. Please try again later.',
					)
					return interaction.followUp({ embeds: [errEmbed] })
				}
				return this.errorResponses(interaction, apiError)
			} else {
				// Handle non-API errors or when error structure is unknown
				const errEmbed = ErrorEmbeds.internalErr(
					'An unexpected error occurred. Please try again later.',
				)
				return interaction.followUp({ embeds: [errEmbed] })
			}
		}
	}

	async fetchPendingBet(userId: string): Promise<IPendingBetslip | null> {
		try {
			const pendingBet = await this.axiosKhronosInstance({
				method: `get`,
				url: `${OutgoingEndpoints.paths.bets.pending}`,
				params: {
					userid: userId,
				},
			})
			const { data } = pendingBet || null
			if (!data) {
				return null
			}
			return {
				amount: data.amount,
				team: data.team,
			}
		} catch (error) {
			console.error(error)
			return null
		}
	}

	async presentMatchChoices(
		interaction: CommandInteraction,
		matchups: Matchup[],
	) {
		const embed = new EmbedBuilder()
			.setTitle('Select a Matchup')
			.setDescription('Choose which game you want to bet on:')
			.setColor(0xfee75c) // Yellow color, adjust as needed

		const selectMenu = new SelectMenuBuilder()
			.setCustomId('select_matchup')
			.setPlaceholder('Choose a matchup')
			.addOptions(
				matchups.map((match) => ({
					label: `${match.away_team} vs ${match.home_team}`,
					description: match.dateofmatchup,
					value: match.id.toString(),
				})),
			)

		const actionRow =
			new ActionRowBuilder<SelectMenuBuilder>().addComponents(selectMenu)

		await interaction.followUp({
			embeds: [embed],
			components: [actionRow],
			ephemeral: true,
		})
	}

	/**
	 * Placees a bet on a match
	 * Used for 'finalizing' a bet - not to initialize one.
	 * Called via `SelectListener`.
	 * @param interaction
	 * @param betDetails
	 */
	async placeBet(
		interaction: CommandInteraction,
		betDetails: IPendingBetslipFull,
	) {
		try {
			// Make the API request to place the bet
			const response = await this.axiosKhronosInstance.post(
				OutgoingEndpoints.paths.bets.place,
				betDetails,
			)
			if (response.status === 200) {
				const data: IAPIProcessedBetslip = response.data
				const teamEmoji = (await findEmoji(data.betslip.team)) || ''
				// Handle successful bet placement
				await this.successfulBetEmbed(
					interaction,
					interaction.user.displayAvatarURL(),
					teamEmoji,
					data.betslip,
				)
			} else {
				// Handle unexpected API response
				const errEmbed = ErrorEmbeds.internalErr(
					'Failed to place your bet due to an unexpected response from the API. Please try again later.',
				)
				return interaction.followUp({
					embeds: [errEmbed],
				})
			}
		} catch (error) {
			console.error('Error placing bet:', error)
			// Handle error scenario, e.g., API not reachable or internal server error
			const errEmbed = ErrorEmbeds.internalErr(
				'Failed to place your bet due to an internal error. Please try again later.',
			)
			return interaction.followUp({
				embeds: [errEmbed],
			})
		}
	}

	async successfulBetEmbed(
		interaction: CommandInteraction,
		embedImg: string,
		teamEmoji: string | GuildEmoji,
		betslip: IFinalizedBetslip,
	) {
		// Bet is placed, just need to inform the user
		const successEmbed = new EmbedBuilder()
			.setTitle(`Bet confirmed! :ticket:`)
			.setDescription(
				`## **__Betslip__**\n**${betslip.team}** ${teamEmoji}\n**Bet:** **\`$${betslip.amount}\`**\n**Profit:** **\`$${betslip.profit}\`** ➞ **Payout:** **\`$${betslip.payout}\`**\n\n*View more commands via \`/commands\`*\n*Betslip ID: \`${betslip.betid}\`*`,
			)
			.setColor(embedColors.success)
			.setThumbnail(embedImg)
			.setFooter({
				text: helpfooter,
			})
		await interaction.followUp({
			embeds: [successEmbed],
		})
	}

	async errorResponses(
		interaction: CommandInteraction,
		apiError: IApiHttpError,
	) {
		const errorType = apiError.error.errorName
		let errorMessage =
			'An unknown internal error has occurred 😔! Please try again later.'

		switch (errorType) {
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
				errorMessage = `Your balance is insufficient to place this bet.\nAvailable balance: \`$${apiError.error.balance}\``
				break
		}
		const errEmbed = ErrorEmbeds.betErr(errorMessage)
		return interaction.followUp({
			embeds: [errEmbed],
		})
	}
}
