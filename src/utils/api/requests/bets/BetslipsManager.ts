import {
	ActionRowBuilder,
	CommandInteraction,
	EmbedBuilder,
	GuildEmoji,
	SelectMenuBuilder,
} from 'discord.js'
import { Matchup } from '../../interfaces/interfaces.js'
import {
	IAPIBetslipPayload,
	IAPIProcessedBetslip,
	IFinalizedBetslip,
	IPendingBetslip,
	IPendingBetslipFull,
	IValidatedBetslipData,
} from '../../../../lib/interfaces/api/bets/betslips.interfaces.js'
import embedColors from '../../../../lib/colorsConfig.js'
import { findEmoji } from '../../../bot_res/findEmoji.js'
import { helpfooter } from '@pluto-core-config'
import { ErrorEmbeds } from '../../../errors/global.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../../common/ApiErrorHandler.js'
import KhronosReqHandler from '../../common/KhronosReqHandler'

export class BetslipManager {
	constructor(private khronosReqHandler: KhronosReqHandler) {}

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
			const response = await this.khronosReqHandler.initBetslip(payload)
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
			} else if (response.data.statusCode === 202) {
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
			return new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.betting,
			)
		}
	}

	async fetchPendingBet(userId: string): Promise<IPendingBetslip | null> {
		try {
			const pendingBet =
				await this.khronosReqHandler.fetchPendingBet(userId)
			const { data } = pendingBet || null
			if (!data) {
				return null
			}
			return {
				userid: data.userid,
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
			.setColor(embedColors.yellow)
			.setFooter({
				text: helpfooter,
			})

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
			const response =
				await this.khronosReqHandler.finalizeBetslip(betDetails)
			if (response.data.statusCode === 200) {
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

	async cancelBet(
		interaction: CommandInteraction,
		userid: string,
		betId: number,
	) {
		try {
			const response = await this.khronosReqHandler.cancelBet(
				userid,
				betId,
			)
			if (response.data.status === 200) {
				const cancelledEmbed = new EmbedBuilder()
					.setTitle(`Bet cancelled! :ticket:`)
					.setColor(embedColors.success)
					.setThumbnail(interaction.user.displayAvatarURL())
					.setFooter({
						text: helpfooter,
					})
				return interaction.followUp({
					embeds: [cancelledEmbed],
				})
			}
			// Bet cant be found
			if (response.data.status === 404) {
				const cantCancelEmb = ErrorEmbeds.invalidRequest(
					`This bet cannot be cancelled as it does not exist.`,
				)
				return interaction.followUp({ embeds: [cantCancelEmb] })
			}
			// Case where API says they cannot cancel their bet
			if (response.data.status === 400) {
				const cantCancelEmb = ErrorEmbeds.invalidRequest(
					`This bet cannot be cancelled as the game has already started, or the match has already finished.`,
				)
				return interaction.followUp({ embeds: [cantCancelEmb] })
			}
		} catch (error) {
			console.error('Error cancelling bet:', error)
			// Handle error scenario, e.g., API not reachable or internal server error
			return new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.betting,
			)
		}
	}
}
