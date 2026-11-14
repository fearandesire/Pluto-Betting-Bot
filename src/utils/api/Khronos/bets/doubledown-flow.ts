import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js'
import {
	doubleDownReprompt,
	doubleDownResult,
	oddsChangedNotice,
} from '../../../../lib/discord/builders/betting.js'
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
import { formatAmericanOdds, parseOddsChanged } from './odds-changed.js'

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
 * Doubles a bet and renders the result into the deferred interaction. When
 * Khronos refuses a moved price, shows the new totals with a confirm button
 * that re-sends the new price.
 */
export async function runDoubleDown(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	betId: number,
	expectedOdds?: number,
) {
	const key = `${interaction.user.id}:${betId}`
	if (inFlight.has(key)) return
	inFlight.add(key)
	const manager = new BetslipManager(
		new BetslipWrapper(),
		new BetsCacheService(new CacheManager()),
	)
	try {
		const { betslip } = await manager.doubleDown(
			interaction.user.id,
			betId,
			expectedOdds,
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
				avatarUrl: interaction.user.displayAvatarURL(),
			}),
		)
	} finally {
		inFlight.delete(key)
	}
}
