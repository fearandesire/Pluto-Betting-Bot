import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	CommandInteraction,
	EmbedBuilder,
	GuildEmoji,
} from 'discord.js'
import { IMatchInfoArgs } from '../../common/interfaces/common-interfaces.js'
import { IAPIBetslipPayload } from '../../../../lib/interfaces/api/bets/betslips.interfaces.js'
import embedColors from '../../../../lib/colorsConfig.js'
import { findEmoji } from '../../../bot_res/findEmoji.js'
import { helpfooter } from '@pluto-core-config'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../error-handling/ApiErrorHandler.js'
import { BetsCacheService } from '../../common/bets/BetsCacheService.js'
import BetslipWrapper from './betslip-wrapper.js'
import GuildWrapper from '../guild/guild-wrapper.js'
import {
	BetslipWithAggregationDTO,
	InitBetslipRespDTO,
	PlaceBetDto,
	PlacedBetslip,
} from '@khronos-index'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import GuildUtils from '../../../guilds/GuildUtils.js'
import StringUtils from '../../../common/string-utils.js'

/**
 * Manages betslips / betting process
 * Some info to know:
 * - `dateofmatchup` and `opponenet` are provided if there's only one match available - directly in the `betslip` object from Khronos API
 */
export class BetslipManager {
	constructor(
		private betslipInstance: BetslipWrapper,
		private betCacheService: BetsCacheService,
	) {
		this.betslipInstance = new BetslipWrapper()
	}

	async initialize(
		interaction: CommandInteraction,
		userId: string,
		team: string,
		amount: number,
		guild_id: string,
	) {
		try {
			const guild = await new GuildWrapper().getGuild(guild_id)
			const sport = guild.sport
			// Construct the payload for initializing the bet
			const payload: IAPIBetslipPayload = {
				userid: userId,
				team,
				amount,
				guild_id,
			}
			// Call the API to initialize the bet
			const response = await this.betslipInstance.init({
				sport,
				initBetslipDTO: payload,
			})
			if (!response) {
				const errEmb = ErrorEmbeds.internalErr(
					`Unable to contact the server, please try again later.`,
				)
				return interaction.editReply({ embeds: [errEmb] })
			}
			if (response.statusCode === 201) {
				const { betslip }: InitBetslipRespDTO = response
				const cacheBetData = {
					...betslip,
					guild_id,
				}
				if (!betslip.dateofmatchup || !betslip.opponent) {
					const errEmb = ErrorEmbeds.internalErr(
						`Unable to process bet due to missing required data, please try again later.`,
					)
					return interaction.editReply({ embeds: [errEmb] })
				}
				await this.betCacheService.cacheUserBet(userId, cacheBetData)
				return this.presentBetWithPay(interaction, {
					betslip,
					payData: {
						payout: betslip.payout!,
						profit: betslip.profit!,
					},
					matchInfo: {
						opponent: betslip.opponent,
						dateofmatchup: betslip.dateofmatchup,
					},
				})
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

	/**
	 * Places a bet on a match
	 * Used for 'finalizing' a bet - not to initialize one.
	 * Called after user confirmation from ButtonListener event
	 * @param interaction - Interaction to respond to
	 * @param betDetails - Details of the bet
	 * @param matchInfo - Optional -- Data about the match, or additional data to include
	 */
	async placeBet(
		interaction: CommandInteraction | ButtonInteraction,
		betDetails: PlaceBetDto,
		matchInfo: IMatchInfoArgs,
	) {
		try {
			// Make the API request to place the bet
			const response = await this.betslipInstance.finalize({
				placeBetDto: betDetails,
			})
			if (response.statusCode <= 400 && response.statusCode >= 200) {
				const { betslip } = response

				const guildUtils = new GuildUtils()
				const chosenTeamEmoji =
					(await guildUtils.findEmoji(betslip.team)) ?? ''
				const oppTeamEmoji =
					(await guildUtils.findEmoji(matchInfo.opponent)) ?? ''
				const chosenTeamShort = new StringUtils().getShortName(
					betslip.team,
				)!
				const oppTeamShort = new StringUtils().getShortName(
					matchInfo.opponent,
				)!
				const chosenTeamStr =
					`${chosenTeamEmoji} ${chosenTeamShort}`.trimStart()
				const oppTeamStr = `${oppTeamEmoji} ${oppTeamShort}`.trimStart()
				// Handle successful bet placement
				await this.successfulBetEmbed(
					interaction,
					interaction.user.displayAvatarURL(),
					{
						betOnTeam: chosenTeamStr,
						betOnTeamEmoji: chosenTeamEmoji ?? '',
						opponent: oppTeamStr,
						opponentEmoji: oppTeamEmoji ?? '',
						chosenTeamShort,
						oppTeamShort,
					},
					betslip,
					matchInfo,
				)
			} else {
				const errEmbed = ErrorEmbeds.internalErr(
					'Failed to place your bet due to an unexpected response from the API. Please try again later.',
				)
				return interaction.followUp({
					embeds: [errEmbed],
				})
			}
		} catch (error) {
			console.error('Error placing bet:', error)
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
		teamDetails: {
			betOnTeam: string
			betOnTeamEmoji: GuildEmoji | ''
			opponent: string
			opponentEmoji: GuildEmoji | ''
			chosenTeamShort: string
			oppTeamShort: string
		},
		betslip: PlacedBetslip,
		apiInfo: IMatchInfoArgs,
	) {
		const betTeamFull = `${teamDetails.betOnTeam}`
		const oppTeamFull = `${teamDetails.opponent}`

		const { betAmount, profit, payout } =
			await MoneyFormatter.formatAmounts({
				amount: betslip.amount,
				profit: betslip.profit!,
				payout: betslip.payout!,
			})
		// Bet is placed, just need to inform the user
		const successEmbed = new EmbedBuilder()
			.setTitle(`Bet confirmed! :ticket:`)
			.setDescription(
				`## __Match__\n**${betTeamFull}** *vs* **${oppTeamFull}**\n**Date:** ${apiInfo.dateofmatchup}\n## __Betslip__\n**${betTeamFull}**\n**Bet: \`${betAmount}\`**\n**Profit: \`${profit}\`**\n**Payout: \`${payout}\`**\n\n*Betslip ID: \`${betslip.betid}\`*\n*View more commands via \`/commands\`*`,
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
			await this.betslipInstance.cancel({
				betid: betId,
			})
			const cancelledEmbed = new EmbedBuilder()
				.setTitle(`Bet Cancellation :ticket:`)
				.setDescription(
					`Successfully cancelled bet \`${betId}\`\nYour funds have been restored.`,
				)
				.setColor(embedColors.success)
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter({
					text: helpfooter,
				})
			return interaction.followUp({
				embeds: [cancelledEmbed],
			})
		} catch (error) {
			console.error('Error cancelling bet:', error)
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
			betslip: BetslipWithAggregationDTO
			payData: { payout: number; profit: number }
			matchInfo: IMatchInfoArgs
		},
	) {
		const { betslip } = betData
		const { opponent, dateofmatchup } = betData.matchInfo
		const usersTeam = betslip.team
		const chosenTeamStr = (await findEmoji(betslip.team)) ?? usersTeam
		const oppTeamStr = (await findEmoji(opponent)) ?? opponent

		const { betAmount, profit, payout } =
			await MoneyFormatter.formatAmounts({
				amount: betslip.amount,
				profit: betData.payData.profit,
				payout: betData.payData.payout,
			})

		const embed = new EmbedBuilder()
			.setTitle('Pending Betslip')
			.setDescription(
				`## __Match__\n${chosenTeamStr} *vs.* ${oppTeamStr}\n**Date:** ${dateofmatchup}\n## __Betslip__\n**Team:** ${chosenTeamStr} ${betslip.team}\n**Bet:** **\`${betAmount}\`**\n**Payout:** **\`${payout}\`**\n**Profit:** **\`${profit}\`**
				\nConfirm your bet via the buttons below`,
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
}
