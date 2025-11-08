import type {
	BetslipWithAggregationDTO,
	DoubleDownDto,
	InitBetslipRespDTO,
	PlaceBetDto,
	PlacedBetslip,
} from '@kh-openapi'
import { helpfooter, supportMessage } from '@pluto-config'
import { format } from 'date-fns'
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type CommandInteraction,
	EmbedBuilder,
	type GuildEmoji,
	type StringSelectMenuInteraction,
} from 'discord.js'
import _ from 'lodash'
import embedColors from '../../../../lib/colorsConfig.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import type { IAPIBetslipPayload } from '../../../../lib/interfaces/api/bets/betslips.interfaces.js'
import { isApiError } from '../../../../lib/interfaces/errors/api-errors.js'
import { findEmoji } from '../../../bot_res/findEmoji.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import StringUtils from '../../../common/string-utils.js'
import GuildUtils from '../../../guilds/GuildUtils.js'
import type { BetsCacheService } from '../../common/bets/BetsCacheService.js'
import type { IMatchInfoArgs } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import PatreonFacade from '../../patreon/Patreon-Facade.js'
import { ApiErrorHandler } from '../error-handling/ApiErrorHandler.js'
import GuildWrapper from '../guild/guild-wrapper.js'
import BetslipWrapper from './betslip-wrapper.js'

interface InitializeParams {
	team: string
	amount: number
	guild_id: string
	event_id: string
	market_key: string
}

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
		params: InitializeParams,
	) {
		const { team, amount, guild_id, event_id, market_key } = params
		try {
			const guild = await new GuildWrapper().getGuild(guild_id)
			const sport = guild.sport
			const payload: IAPIBetslipPayload = {
				userid: userId,
				team,
				amount,
				guild_id,
				event_id,
				market_key,
			}
			// Call the API to initialize the bet
			const response = await this.betslipInstance.init({
				sport,
				// @ts-ignore
				initBetslipDTO: payload,
			})
			if (!response) {
				const errEmb = await ErrorEmbeds.internalErr(
					'Unable to contact the server, please try again later.',
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
					const errEmb = await ErrorEmbeds.internalErr(
						'Unable to process bet due to missing required data, please try again later.',
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
				const errEmbed = await ErrorEmbeds.internalErr(
					'Failed to place your bet due to an unexpected response from the API. Please try again later.',
				)
				return interaction.followUp({
					embeds: [errEmbed],
				})
			}
		} catch (error) {
			const errEmbed = await ErrorEmbeds.internalErr(
				'Failed to place your bet due to an internal error. Please try again later.',
			)
			console.error(error)
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
		const { betAmount, profit, payout } =
			await MoneyFormatter.formatAmounts({
				amount: betslip.amount,
				profit: betslip.profit!,
				payout: betslip.payout!,
			})

		const formattedBetData = this.formatBetStr(betAmount, payout, profit)
		const formattedDate = this.formatMatchDate(apiInfo.dateofmatchup)

		// Use team strings that already have emoji fallback logic applied
		const successEmbed = new EmbedBuilder()
			.setTitle('Bet confirmed!')
			.setDescription(
				`## ${teamDetails.betOnTeam} *vs.* ${teamDetails.opponent}\n**${teamDetails.chosenTeamShort}** | **${formattedDate}**\n${formattedBetData}`,
			)
			.setColor(embedColors.success)
			.setThumbnail(embedImg)
			.setFooter({
				text: `Bet ID: ${betslip.betid} | ${await helpfooter('betting')}`,
			})
		await interaction.followUp({
			embeds: [successEmbed],
		})
	}

	private formatBetStr(betAmount: string, payout: string, profit: string) {
		const b = '**'
		const formattedBetData = `${b}${betAmount}${b} -> ${b}${payout}${b}\n${b}Profit:${b} ${b}${profit}${b}`
		return formattedBetData
	}

	/**
	 * Formats a date string to MM/DD/YY format
	 * Handles both ISO date strings and already-formatted dates
	 */
	private formatMatchDate(
		dateInput: string | undefined,
		betslip?: BetslipWithAggregationDTO,
	): string {
		// Try to get commence_time from betslip.match if available
		if (betslip?.match?.commence_time) {
			const date = new Date(betslip.match.commence_time)
			return format(date, 'MM/dd/yy')
		}

		// If dateInput is an ISO date string (contains 'T' or matches ISO pattern), format it
		if (dateInput) {
			try {
				// Check if it's an ISO date string
				if (
					dateInput.includes('T') ||
					/^\d{4}-\d{2}-\d{2}/.test(dateInput)
				) {
					const date = new Date(dateInput)
					return format(date, 'MM/dd/yy')
				}
				// If it's already formatted, try to parse and reformat to ensure MM/DD/YY
				const parsedDate = new Date(dateInput)
				if (!isNaN(parsedDate.getTime())) {
					return format(parsedDate, 'MM/dd/yy')
				}
			} catch {
				// If parsing fails, return as-is
			}
		}

		return dateInput || 'TBD'
	}

	async cancelBet(
		interaction: CommandInteraction,
		userid: string,
		betId: number,
	) {
		try {
			const patreonOverride = await PatreonFacade.isSponsorTier(userid)
			if (isApiError(patreonOverride)) {
				console.error(
					`Unknown Err in patreonOverride:\n${patreonOverride}`,
				)
				const errEmbed = await ErrorEmbeds.accountErr(
					`Unable to cancel bet due to an error.\n${supportMessage}`,
				)
				return interaction.followUp({ embeds: [errEmbed] })
			}
			await this.betslipInstance.cancel({
				betId: betId,
				patreonDataDto: {
					patreonOverride,
				},
			})
			const cancelledEmbed = new EmbedBuilder()
				.setTitle('Bet Cancellation :ticket:')
				.setDescription(
					`Successfully cancelled bet \`${betId}\`\nYour funds have been restored.`,
				)
				.setColor(embedColors.success)
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter({
					text: await helpfooter('betting'),
				})
			return interaction.followUp({
				embeds: [cancelledEmbed],
			})
		} catch (error) {
			console.error({
				message: `[${this.cancelBet.name}] Error`,
				error,
			})
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
		interaction:
			| CommandInteraction
			| ButtonInteraction
			| StringSelectMenuInteraction,
		betData: {
			betslip: BetslipWithAggregationDTO
			payData: { payout: number; profit: number }
			matchInfo: IMatchInfoArgs
		},
	) {
		const { betslip } = betData
		const { opponent, dateofmatchup } = betData.matchInfo
		const usersTeam = betslip.team
		let chosenTeamStr = await findEmoji(betslip.team)
		let oppTeamStr = await findEmoji(opponent)

		if (!chosenTeamStr || chosenTeamStr === '') chosenTeamStr = usersTeam
		if (!oppTeamStr || oppTeamStr === '')
			oppTeamStr = _.last(opponent.split(' ')) // Fallback to use the shortname of the opponent

		const { betAmount, profit, payout } =
			await MoneyFormatter.formatAmounts({
				amount: betslip.amount,
				profit: betData.payData.profit,
				payout: betData.payData.payout,
			})
		const formattedBetData = this.formatBetStr(betAmount, payout, profit)
		// uppercase the first letter of users team choice with lodash
		const usersTeamUpper = _.upperFirst(usersTeam)
		const formattedDate = this.formatMatchDate(dateofmatchup, betslip)

		const embed = new EmbedBuilder()
			.setTitle('Pending Betslip')
			.setDescription(
				`## ${chosenTeamStr} *vs.* ${oppTeamStr}\n**${usersTeamUpper}** | **${formattedDate}**\n${formattedBetData}\n*Confirm your bet via the buttons below*`,
			)
			.setThumbnail(interaction.user.displayAvatarURL())
			.setColor(embedColors.PlutoYellow)
			.setFooter({
				text: await helpfooter('betting'),
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

	async doubleDown(userId: string, betId: number): Promise<DoubleDownDto> {
		return this.betslipInstance.doubleDown({ userId, betId })
	}
}
