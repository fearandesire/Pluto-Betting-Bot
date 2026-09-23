import { randomUUID } from 'node:crypto'
import { betFooter, supportMessage } from '@pluto-config'
import type {
	BetslipWithAggregationDTO,
	DoubleDownDto,
	InitBetslipRespDTO,
	PlaceBetDto,
	PlacedBetslip,
} from '@pluto-khronos/api-client'
import {
	type ButtonInteraction,
	type CommandInteraction,
	type GuildEmoji,
	type InteractionResponse,
	type Message,
	type StringSelectMenuInteraction,
} from 'discord.js'
import _ from 'lodash'
import {
	betCancellationEmbed,
	betConfirmedEmbed,
	betPlacedAnnouncementEmbed,
	formatMatchDate,
	parlayPlacedAnnouncementEmbed,
	pendingBetslip,
} from '../../../../lib/discord/builders/betting.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import type { IAPIBetslipPayload } from '../../../../lib/interfaces/api/bets/betslips.interfaces.js'
import { isApiError } from '../../../../lib/interfaces/errors/api-errors.js'
import { findEmoji } from '../../../bot_res/findEmoji.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import StringUtils from '../../../common/string-utils.js'
import GuildUtils from '../../../guilds/GuildUtils.js'
import { logger } from '../../../logging/WinstonLogger.js'
import type { BetsCacheService } from '../../common/bets/BetsCacheService.js'
import { handleNewUser } from '../../common/handleNewUser.js'
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
	) {}

	async initialize(
		interaction: CommandInteraction,
		userId: string,
		params: InitializeParams,
	): Promise<Message> {
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
				handleNewUser(response)
				const cacheBetData = {
					...betslip,
					guild_id,
					placement_id: randomUUID(),
				}
				if (!betslip.dateofmatchup || !betslip.opponent) {
					const errEmb = await ErrorEmbeds.internalErr(
						'Unable to process bet due to missing required data, please try again later.',
					)
					return interaction.editReply({ embeds: [errEmb] })
				}
				await this.betCacheService.cacheUserBet(userId, cacheBetData)
				const message = await this.presentBetWithPay(interaction, {
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
				return message
			}
			// Handle non-201 status codes
			const errEmb = await ErrorEmbeds.internalErr(
				`Unexpected response from server (Status: ${response.statusCode}). Please try again later.`,
			)
			return interaction.editReply({ embeds: [errEmb] })
		} catch (error) {
			return await new ApiErrorHandler().handle(
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
			if (response.statusCode >= 200 && response.statusCode < 300) {
				const { betslip } = response
				handleNewUser(response)
				await this.betCacheService.clearUserBet(betDetails.userid)

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

				await this.announceBetPlaced(interaction, {
					betOnTeam: chosenTeamStr,
					amount: betslip.amount,
					balance: (betslip.newBalance ?? 0) + betslip.amount,
				})
			} else {
				const errEmbed = await ErrorEmbeds.internalErr(
					'Failed to place your bet due to an unexpected response from the API. Please try again later.',
				)
				if (interaction.deferred || interaction.replied) {
					return interaction.editReply({
						embeds: [errEmbed],
						...(this.isDefinitiveBusinessFailure(
							response.statusCode,
						)
							? { components: [] }
							: {}),
					})
				}
				return interaction.followUp({
					embeds: [errEmbed],
					ephemeral: true,
				})
			}
		} catch (error) {
			const errEmbed = await ErrorEmbeds.internalErr(
				'Failed to place your bet due to an internal error. Please try again later.',
			)
			logger.error('Failed to place bet', { error })
			if (interaction.deferred || interaction.replied) {
				return interaction.editReply({
					embeds: [errEmbed],
					...(this.isDefinitiveBusinessFailure(error)
						? { components: [] }
						: {}),
				})
			}
			return interaction.followUp({
				embeds: [errEmbed],
				ephemeral: true,
			})
		}
	}

	private isDefinitiveBusinessFailure(value: unknown): boolean {
		if (typeof value === 'number') {
			return (
				value >= 400 && value < 500 && ![408, 425, 429].includes(value)
			)
		}
		if (!value || typeof value !== 'object') return false

		const error = value as {
			status?: unknown
			statusCode?: unknown
			response?: { status?: unknown }
		}
		const status =
			typeof error.statusCode === 'number'
				? error.statusCode
				: typeof error.status === 'number'
					? error.status
					: error.response?.status
		return (
			typeof status === 'number' &&
			status >= 400 &&
			status < 500 &&
			![408, 425, 429].includes(status)
		)
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
	): Promise<Message> {
		const { betAmount, profit, payout } =
			await MoneyFormatter.formatAmounts({
				amount: betslip.amount,
				profit: betslip.profit!,
				payout: betslip.payout!,
			})

		// Use team strings that already have emoji fallback logic applied
		const successEmbed = betConfirmedEmbed({
			betOnTeam: teamDetails.betOnTeam,
			opponent: teamDetails.opponent,
			chosenTeamShort: teamDetails.chosenTeamShort,
			date: formatMatchDate(apiInfo.dateofmatchup),
			amounts: { betAmount, payout, profit },
			avatarUrl: embedImg,
			betId: betslip.betid,
			footer: betFooter({
				balance: (betslip.newBalance ?? 0) + betslip.amount,
				betAmount: betslip.amount,
			}),
		})

		if (interaction.deferred || interaction.replied) {
			return interaction.editReply({
				embeds: [successEmbed],
				components: [],
			})
		}
		return interaction.followUp({
			embeds: [successEmbed],
			ephemeral: true,
		})
	}

	private async announceBetPlaced(
		interaction: CommandInteraction | ButtonInteraction,
		betDetails: { betOnTeam: string; amount: number; balance: number },
	) {
		try {
			if (!interaction.guildId) {
				logger.warn('Cannot announce bet - no guild context')
				return
			}

			const guildWrapper = new GuildWrapper()
			const formattedAmount = MoneyFormatter.toUSD(betDetails.amount)
			const publicEmbed = betPlacedAnnouncementEmbed({
				userId: interaction.user.id,
				betOnTeam: betDetails.betOnTeam,
				formattedAmount,
				footer: betFooter({
					balance: betDetails.balance,
					betAmount: betDetails.amount,
				}),
			})

			await guildWrapper.sendToBettingChannel(interaction.guildId, {
				embeds: [publicEmbed],
			})
		} catch (e) {
			logger.warn('Failed to announce bet placed', { error: e })
		}
	}

	/**
	 * Announce a successfully placed parlay through the same guild betting
	 * channel pathway used by singles.
	 */
	public async announceParlayPlaced(
		interaction: CommandInteraction | ButtonInteraction,
		details: {
			parlayId: string
			legCount: number
			stake: number
			potentialPayout: number
		},
	): Promise<void> {
		try {
			if (!interaction.guildId) {
				logger.warn('Cannot announce parlay - no guild context')
				return
			}

			const publicEmbed = parlayPlacedAnnouncementEmbed({
				userId: interaction.user.id,
				...details,
			})

			await new GuildWrapper().sendToBettingChannel(interaction.guildId, {
				embeds: [publicEmbed],
			})
		} catch (error) {
			logger.warn('Failed to announce parlay placed', { error })
		}
	}

	async cancelBet(
		interaction: CommandInteraction,
		userid: string,
		betId: number,
	): Promise<Message | InteractionResponse<boolean>> {
		try {
			const patreonOverride = await PatreonFacade.isSponsorTier(userid)
			if (isApiError(patreonOverride)) {
				logger.error('Unknown error in patreonOverride', {
					error: patreonOverride,
				})
				const errEmbed = await ErrorEmbeds.accountErr(
					`Unable to cancel bet due to an error.\n${supportMessage}`,
				)
				if (interaction.deferred || interaction.replied) {
					return interaction.followUp({
						embeds: [errEmbed],
						ephemeral: true,
					})
				}
				return interaction.reply({
					embeds: [errEmbed],
					ephemeral: true,
				})
			}
			if (!interaction.guildId) {
				throw new Error('Cannot cancel a bet outside a guild context.')
			}
			await this.betslipInstance.cancel({
				userId: userid,
				betId: betId,
				guildId: interaction.guildId,
				patreonDataDto: {
					patreonOverride,
				},
			})
			const cancelledEmbed = betCancellationEmbed(
				betId,
				interaction.user.displayAvatarURL(),
			)
			if (interaction.deferred || interaction.replied) {
				return interaction.followUp({
					embeds: [cancelledEmbed],
					ephemeral: true,
				})
			}
			return interaction.reply({
				embeds: [cancelledEmbed],
				ephemeral: true,
			})
		} catch (error) {
			logger.error(`[${this.cancelBet.name}] Error`, { error })
			return await new ApiErrorHandler().handle(
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
		const message = await interaction.editReply(
			pendingBetslip({
				chosenTeam: chosenTeamStr,
				opponent: oppTeamStr!,
				// uppercase the first letter of users team choice with lodash
				teamLabel: _.upperFirst(usersTeam),
				date: formatMatchDate(dateofmatchup, betslip),
				amounts: { betAmount, payout, profit },
				avatarUrl: interaction.user.displayAvatarURL(),
			}),
		)
		return message
	}

	async doubleDown(userId: string, betId: number): Promise<DoubleDownDto> {
		const response = await this.betslipInstance.doubleDown({
			userId,
			betId,
		})
		handleNewUser(response)
		return response
	}
}
