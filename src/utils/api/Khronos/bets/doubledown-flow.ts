import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js'
import {
	doubleDownReprompt,
	doubleDownResult,
	oddsChangedNotice,
} from '../../../../lib/discord/builders/betting.js'
import { sendBettingNotice } from '../../../../lib/discord/v2/notice.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { isApiError } from '../../../../lib/interfaces/errors/api-errors.js'
import env from '../../../../lib/startup/env.js'
import { CacheManager } from '../../../cache/cache-manager.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import { logger } from '../../../logging/WinstonLogger.js'
import { BetsCacheService } from '../../common/bets/BetsCacheService.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import PatreonFacade from '../../patreon/Patreon-Facade.js'
import { ApiErrorHandler } from '../error-handling/ApiErrorHandler.js'
import { BetslipManager } from './BetslipsManager.js'
import BetslipWrapper from './betslip-wrapper.js'
import {
	formatAmericanOdds,
	parseOddsChanged,
	StaleDoubleDownError,
} from './odds-changed.js'

/** Error to show when the user may not double down now, or null. */
export async function doubleDownGateError(userId: string) {
	if (env.MAINTENANCE_MODE) return ErrorEmbeds.maintenanceMode()
	const member = await PatreonFacade.memberDetails(userId)
	if (!member || isApiError(member)) return ErrorEmbeds.patreonMembersOnly()
	return null
}

/** Double downs in flight in this process; doubledown has no idempotency key. */
const inFlight = new Set<string>()

/**
 * Claims a double down for this process synchronously, so it must run before
 * any await. Returns its release, or null when one is already running.
 */
export function claimDoubleDown(userId: string, betId: number) {
	const key = `${userId}:${betId}`
	if (inFlight.has(key)) return null
	inFlight.add(key)
	return () => {
		inFlight.delete(key)
	}
}

/** Private notice for an overlapping double down; keeps the shared message. */
export function replyDoubleDownInProgress(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
	return sendBettingNotice(
		interaction,
		{
			title: 'Double down already in progress',
			description:
				'Pluto is still doubling down this bet. Check `/mybets` in a moment.',
		},
		{ keepOriginal: true },
	)
}

/**
 * Doubles a bet and renders the result into the deferred interaction. When
 * Khronos refuses a moved price, shows the new totals with a confirm button
 * that re-sends the new price. Pass `release` when the caller already
 * claimed the double down with claimDoubleDown.
 */
export async function runDoubleDown(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	betId: number,
	expectedOdds?: number,
	expectedStakeCents?: number,
	release = claimDoubleDown(interaction.user.id, betId),
) {
	if (!release) return replyDoubleDownInProgress(interaction)
	const manager = new BetslipManager(
		new BetslipWrapper(),
		new BetsCacheService(new CacheManager()),
	)
	try {
		const { betslip } = await manager.doubleDown(
			interaction.user.id,
			betId,
			expectedOdds,
			expectedStakeCents,
		)
		return interaction.editReply(
			doubleDownResult({
				amount: MoneyFormatter.toUSD(betslip.newBetAmount),
				payout: MoneyFormatter.toUSD(betslip.newPayout),
				profit: MoneyFormatter.toUSD(betslip.newProfit),
				balance: MoneyFormatter.toUSD(betslip.newBalance),
				avatarUrl: interaction.user.displayAvatarURL(),
			}),
		)
	} catch (error) {
		if (error instanceof StaleDoubleDownError) {
			return sendBettingNotice(
				interaction,
				{
					title: 'Double down not placed',
					description:
						'This bet changed since this prompt. Run `/doubledown` again to see the current price.',
				},
				{ keepOriginal: true },
			)
		}
		const details = await parseOddsChanged(error)
		if (!details) {
			await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.betting,
			)
			return
		}
		logger.warn('Double down price changed', {
			event: 'betslip.price.odds_changed',
			user_id: interaction.user.id,
			bet_id: betId,
			expected_odds: details.expected_odds,
			current_odds: details.current_odds,
		})
		return interaction.editReply(
			doubleDownReprompt({
				betId,
				notice: oddsChangedNotice(
					formatAmericanOdds(details.expected_odds),
					formatAmericanOdds(details.current_odds),
				),
				amount: MoneyFormatter.toUSD(details.amount),
				payout: MoneyFormatter.toUSD(details.payout),
				profit: MoneyFormatter.toUSD(details.profit),
				currentOdds: details.current_odds,
				stakeCents: Math.round(
					(details.amount - details.added.amount) * 100,
				),
				avatarUrl: interaction.user.displayAvatarURL(),
			}),
		)
	} finally {
		release()
	}
}
