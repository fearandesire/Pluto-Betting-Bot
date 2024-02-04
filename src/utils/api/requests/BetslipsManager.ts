import {
	ActionRowBuilder,
	CommandInteraction,
	EmbedBuilder,
	SelectMenuBuilder,
} from 'discord.js'
import { AxiosKhronosInstance } from '../common/axios-config'
import { SapphireClient } from '@sapphire/framework'
import { Matchup } from '../interfaces/interfaces'
import { OutgoingEndpoints } from '../common/endpoints'
import {
	IPendingBetslip,
	IPendingBetslipFull,
} from '../../../lib/interfaces/api/bets/betslips.interfaces'
export class BetslipManager {
	private axiosKhronosInstance = AxiosKhronosInstance
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
		sport: string,
	) {
		try {
			// Construct the payload for initializing the bet
			const payload = {
				userid: userId,
				team: team,
				amount: amount,
				sport: sport, // Assuming sport is a necessary field for your API
			}

			// Call the API to initialize the bet
			const response = await this.axiosKhronosInstance.post(
				OutgoingEndpoints.paths.bets.create, // Ensure this endpoint is for initializing a bet
				payload,
			)

			if (response.status === 200) {
				// or directly initializes the bet if there's only one matchup
				const data = response.data

				if (data.matchups && data.matchups.length > 1) {
					// If there are multiple matchups, present the user with choices
					await this.presentMatchChoices(interaction, data.matchups)
				} else {
					// If there's only one matchup or no need for user selection, confirm bet initialization
					await interaction.reply({
						content:
							'Your bet is being processed. Please wait for confirmation.',
						ephemeral: true,
					})
				}
			} else {
				// Handle unexpected API response
				await interaction.reply({
					content:
						'There was an issue initializing your bet. Please try again later.',
					ephemeral: true,
				})
			}
		} catch (error) {
			console.error('Error initializing bet:', error)
			// Handle error scenario, e.g., API not reachable, validation errors, etc.
			await interaction.reply({
				content:
					'Failed to initialize your bet due to an internal error. Please try again or contact support.',
				ephemeral: true,
			})
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
				matchups.map((match, index) => ({
					label: `${match.away_team} vs ${match.home_team}`,
					description: match.dateofmatchup,
					value: match.id.toString(),
				})),
			)

		const actionRow =
			new ActionRowBuilder<SelectMenuBuilder>().addComponents(selectMenu)

		await interaction.reply({
			embeds: [embed],
			components: [actionRow],
			ephemeral: true,
		})
	}

	/**
	 * Placees a bet on a match
	 * Used for 'finalizing' a bet - not to initialize one.
	 * @param interaction
	 * @param betDetails
	 * @param selectedMatchId
	 */
	async placeBet(
		interaction: CommandInteraction,
		betDetails: IPendingBetslipFull,
		selectedMatchId: string,
	) {
		try {
			// Construct the payload for the API request
			const payload = {
				...betDetails,
				matchup_id: selectedMatchId, // Ensure this matches the expected field in your API
			}

			// Make the API request to place the bet
			const response = await this.axiosKhronosInstance.post(
				'/betslips/place',
				payload,
			)

			if (response.status === 200) {
				// Handle successful bet placement
				await interaction.followUp({
					content: 'Your bet has been successfully placed!',
					ephemeral: true,
				})
			} else {
				// Handle unexpected API response
				await interaction.followUp({
					content:
						'There was an issue placing your bet. Please try again later.',
					ephemeral: true,
				})
			}
		} catch (error) {
			console.error('Error placing bet:', error)
			// Handle error scenario, e.g., API not reachable or internal server error
			await interaction.followUp({
				content:
					'Failed to place your bet due to an internal error. Please contact support.',
				ephemeral: true,
			})
		}
	}
}
