import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	CommandInteraction,
	EmbedBuilder,
	GuildEmoji,
	SelectMenuBuilder,
} from 'discord.js'
import { ApiMatchInfo, Matchup } from '../../interfaces/interfaces.js'
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
import KhronosReqHandler from '../../common/KhronosReqHandler.js'
import { BetsCacheService } from '../../common/bets/BetsCacheService.js'
import { selectMenuIds } from '../../../../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import MoneyFormatter from '../../common/money-formatting/money-format'

/**
 * Manages betslips / betting process
 *
 * Some info to know:
 * - `dateofmatchup` and `opponenet` are provided if there's only one match available - directly in the `betslip` object from Khronos API
 *
 */
export class BetslipManager {
	constructor(
		private khronosReqHandler: KhronosReqHandler,
		private betCacheService: BetsCacheService,
	) {}

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
				return interaction.editReply({ embeds: [errEmb] })
			}
			if (response.data.statusCode === 200) {
				const data: IAPIProcessedBetslip = response.data
				const { betslip } = data
				if (!betslip.dateofmatchup || !betslip.opponent) {
					const errEmb = ErrorEmbeds.internalErr(
						`Unable to process bet due to missing required data, please try again later.`,
					)
					return interaction.editReply({ embeds: [errEmb] })
				}
				await this.betCacheService.cacheUserBet(userId, betslip)
				return this.presentBetWithPay(interaction, {
					betslip,
					payData: {
						payout: betslip.payout,
						profit: betslip.profit,
					},
					apiInfo: {
						opponent: betslip.opponent,
						dateofmatchup: betslip.dateofmatchup,
					},
				})
			} else if (response.data.statusCode === 202) {
				const data: IValidatedBetslipData = response.data
				await this.betCacheService.cacheUserBet(userId, data.betslip)
				await this.presentMatchChoices(
					interaction,
					data.matchupsForTeam,
				)
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
			.setColor(embedColors.PlutoYellow)
			.setFooter({
				text: helpfooter,
			})

		const selectMenu = new SelectMenuBuilder()
			.setCustomId(selectMenuIds.matchup_select_team)
			.setPlaceholder('Choose a matchup')
			.addOptions(
				matchups.map((match) => ({
					label: `${match.away_team} vs ${match.home_team}`,
					description: match.dateofmatchup,
					value: match.id,
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
	 * Called after user confirmation from ButtonListener event
	 * @param interaction - Interaction to respond to
	 * @param betDetails - Details of the bet
	 * @param apiInfo - Optional -- Data about the match, or additional data to include
	 */
	async placeBet(
		interaction: CommandInteraction | ButtonInteraction,
		betDetails: IPendingBetslipFull,
		apiInfo: ApiMatchInfo,
	) {
		try {
			// Make the API request to place the bet
			const response =
				await this.khronosReqHandler.finalizeBetslip(betDetails)
			if (response.data.statusCode === 200) {
				const data: IAPIProcessedBetslip = response.data
				const teamEmoji = (await findEmoji(data.betslip.team)) || ''
				const oppEmoji = (await findEmoji(apiInfo.opponent)) || ''
				// Handle successful bet placement
				await this.successfulBetEmbed(
					interaction,
					interaction.user.displayAvatarURL(),
					{
						betOnTeam: teamEmoji,
						opponent: oppEmoji,
					},
					data.betslip,
					apiInfo,
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
		interaction: CommandInteraction | ButtonInteraction,
		embedImg: string,
		teamEmojis: {
			betOnTeam: string | GuildEmoji
			opponent: string | GuildEmoji
		},
		betslip: IFinalizedBetslip,
		apiInfo: ApiMatchInfo,
	) {
		const betTeamFull = `${betslip.team} ${teamEmojis.betOnTeam}`
		const oppTeamFull = `${apiInfo.opponent} ${teamEmojis.opponent}`

		const { bet, profit, payout } = await this.formatAmounts({
			bet: betslip.amount,
			profit: betslip.profit,
			payout: betslip.payout,
		})
		// Bet is placed, just need to inform the user
		const successEmbed = new EmbedBuilder()
			.setTitle(`Bet confirmed! :ticket:`)
			.setDescription(
				`## Match\n**${betTeamFull}** *vs* **${oppTeamFull}\n**Date:** ${apiInfo.dateofmatchup}\n**## **__Betslip__**\n**${betTeamFull}\n**Bet:** **\`${bet}\`**\n**Profit:** **\`${profit}\`**\n**Payout:** **\`${payout}\`**\n\n*View more commands via \`/commands\`*\n*Betslip ID: \`${betslip.betid}\`*`,
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

	/**
	 * @summary Display embed to the user with a button to confirm or cancel the bet
	 *
	 * This method is used when a user has selected a match // or team that has only one match available
	 * This method will display the bet information along with the potential payout and profit for the user to process it.
	 * @param interaction
	 * @param betData
	 */
	async presentBetWithPay(
		interaction: CommandInteraction | ButtonInteraction,
		betData: {
			betslip: IFinalizedBetslip | IPendingBetslip
			payData: { payout: number; profit: number }
			apiInfo: ApiMatchInfo
		},
	) {
		console.debug({
			method: this.presentBetWithPay.name,
			data: {
				betData,
			},
		})
		const { betslip } = betData
		const { opponent, dateofmatchup } = betData.apiInfo
		const teamEmoji = (await findEmoji(betslip.team)) || ''
		const usersTeam = `${betslip.team} ${teamEmoji}`
		const oppTeamEmoji = (await findEmoji(opponent)) || ''
		const oppTeam = `${opponent} ${oppTeamEmoji}`
		const { bet, profit, payout } = await this.formatAmounts({
			bet: betslip.amount,
			profit: betData.payData.profit,
			payout: betData.payData.payout,
		})

		const embed = new EmbedBuilder()
			.setTitle('Pending Betslip')
			.setDescription(
				`## __Match__\n${usersTeam} *vs.* ${oppTeam}\n**Date:** ${dateofmatchup}\n**Team:** ${betslip.team}\n## __Betslip__\n**Bet:** ${bet}\n**Payout:** **\`${payout}\`**\n**Profit:** **\`${profit}\`**
				Confirm your bet via the buttons below`,
			)
			.setColor(embedColors.PlutoYellow)
			.setFooter({
				text: helpfooter,
			})
		const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('matchup_btn_confirm')
				.setLabel('Confirm Bet')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId('matchup_btn_cancel')
				.setLabel('Cancel Bet')
				.setStyle(ButtonStyle.Danger),
		)
		await interaction.editReply({
			embeds: [embed],
			components: [actionRow],
		})
	}

	async formatAmounts(bettingNumbers: { [key: string]: number }) {
		const bet = MoneyFormatter.toUSD(bettingNumbers.amount)
		const payout = MoneyFormatter.toUSD(bettingNumbers.payout)
		const profit = MoneyFormatter.toUSD(bettingNumbers.profit)

		return {
			bet,
			payout,
			profit,
		}
	}
}
