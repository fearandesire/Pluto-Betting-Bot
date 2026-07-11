import type { PlacedBetslip } from '@pluto-khronos/api-client'
import { PlacedBetslipBetresultEnum } from '@pluto-khronos/api-client'
import { format, isValid, parseISO } from 'date-fns'
import { logger } from '../../../logging/WinstonLogger.js'
import ParlayApiWrapper, {
	type UserParlay,
} from '../parlays/ParlayApiWrapper.js'
import BetslipWrapper from './betslip-wrapper.js'

export interface MyBetsData {
	pendingBets: PlacedBetslip[]
	historyBets: PlacedBetslip[]
	pendingParlays: UserParlay[]
	historyParlays: UserParlay[]
	totalPages: number
}

export type HistoryEntry =
	| { kind: 'bet'; bet: PlacedBetslip }
	| { kind: 'parlay'; parlay: UserParlay }

export interface HistoryPage {
	bets: PlacedBetslip[]
	parlays: UserParlay[]
	entries: HistoryEntry[]
	page: number
	totalPages: number
}

export interface BetsByDate {
	date: string
	bets: PlacedBetslip[]
}

export class MyBetsPaginationService {
	private readonly PAGE_SIZE = 10
	private betslipWrapper: BetslipWrapper
	private parlayWrapper: ParlayApiWrapper

	constructor(
		betslipWrapper?: BetslipWrapper,
		parlayWrapper?: ParlayApiWrapper,
	) {
		this.betslipWrapper = betslipWrapper ?? new BetslipWrapper()
		this.parlayWrapper = parlayWrapper ?? new ParlayApiWrapper()
	}

	async fetchUserBets(userId: string): Promise<MyBetsData> {
		try {
			const [betsResult, parlaysResult] = await Promise.allSettled([
				this.betslipWrapper.getUserBetslips({ userid: userId }),
				this.fetchAllUserParlays(userId),
			])
			if (betsResult.status === 'rejected') throw betsResult.reason
			const allBets = betsResult.value
			const parlayResponse =
				parlaysResult.status === 'fulfilled'
					? parlaysResult.value
					: { parlays: [] }
			if (parlaysResult.status === 'rejected') {
				logger.warn(
					'Failed to fetch user parlays; showing singles only',
					{
						source: this.fetchUserBets.name,
						userId,
						error:
							parlaysResult.reason instanceof Error
								? parlaysResult.reason.message
								: String(parlaysResult.reason),
					},
				)
			}

			const { pending, history } = this.splitBetsByStatus(allBets)
			const pendingParlays = parlayResponse.parlays.filter(
				(parlay) => parlay.status === 'pending',
			)
			const historyParlays = parlayResponse.parlays.filter(
				(parlay) => parlay.status !== 'pending',
			)
			const sortedHistory = this.sortByDateDesc(history)
			const sortedHistoryParlays =
				this.sortParlaysByDateDesc(historyParlays)
			const totalPages = Math.max(
				1,
				Math.ceil(
					(sortedHistory.length + sortedHistoryParlays.length) /
						this.PAGE_SIZE,
				),
			)

			return {
				pendingBets: pending,
				historyBets: sortedHistory,
				pendingParlays,
				historyParlays: sortedHistoryParlays,
				totalPages,
			}
		} catch (error) {
			logger.error('Failed to fetch user betslips', {
				source: this.fetchUserBets.name,
				userId,
				operation: 'getUserBetslips',
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})

			throw error
		}
	}

	private async fetchAllUserParlays(userId: string): Promise<{
		parlays: UserParlay[]
	}> {
		const pageSize = 100
		const firstPage = await this.parlayWrapper.getUserParlays(userId, {
			page: 1,
			limit: pageSize,
		})
		const totalPages = Math.max(1, firstPage.total_pages || 1)
		const parlays = [...firstPage.parlays]

		for (let page = 2; page <= totalPages; page++) {
			const nextPage = await this.parlayWrapper.getUserParlays(userId, {
				page,
				limit: pageSize,
			})
			parlays.push(...nextPage.parlays)
		}

		return { parlays }
	}

	private splitBetsByStatus(bets: PlacedBetslip[]): {
		pending: PlacedBetslip[]
		history: PlacedBetslip[]
	} {
		const pending: PlacedBetslip[] = []
		const history: PlacedBetslip[] = []

		for (const bet of bets) {
			if (bet.betresult === PlacedBetslipBetresultEnum.Pending) {
				pending.push(bet)
			} else {
				history.push(bet)
			}
		}

		return { pending, history }
	}

	private sortByDateDesc(bets: PlacedBetslip[]): PlacedBetslip[] {
		return [...bets].sort((a, b) => {
			const dateA = a.dateofbet ? new Date(a.dateofbet).getTime() : 0
			const dateB = b.dateofbet ? new Date(b.dateofbet).getTime() : 0
			return dateB - dateA
		})
	}

	private sortParlaysByDateDesc(parlays: UserParlay[]): UserParlay[] {
		return [...parlays].sort(
			(a, b) =>
				new Date(b.created_at).getTime() -
				new Date(a.created_at).getTime(),
		)
	}

	getHistoryPage(
		historyBets: PlacedBetslip[],
		page: number,
		historyParlays: UserParlay[] = [],
	): HistoryPage {
		const entries: HistoryEntry[] = [
			...historyBets.map((bet) => ({ kind: 'bet' as const, bet })),
			...historyParlays.map((parlay) => ({
				kind: 'parlay' as const,
				parlay,
			})),
		].sort((a, b) => {
			const dateA =
				a.kind === 'bet' ? a.bet.dateofbet : a.parlay.created_at
			const dateB =
				b.kind === 'bet' ? b.bet.dateofbet : b.parlay.created_at
			return (
				new Date(dateB ?? 0).getTime() - new Date(dateA ?? 0).getTime()
			)
		})
		const totalPages = Math.max(
			1,
			Math.ceil(entries.length / this.PAGE_SIZE),
		)
		const clampedPage = Math.max(1, Math.min(page, totalPages))
		const start = (clampedPage - 1) * this.PAGE_SIZE
		const end = start + this.PAGE_SIZE
		const pageEntries = entries.slice(start, end)

		return {
			bets: pageEntries.flatMap((entry) =>
				entry.kind === 'bet' ? [entry.bet] : [],
			),
			parlays: pageEntries.flatMap((entry) =>
				entry.kind === 'parlay' ? [entry.parlay] : [],
			),
			entries: pageEntries,
			page: clampedPage,
			totalPages,
		}
	}

	groupBetsByDate(bets: PlacedBetslip[]): BetsByDate[] {
		const grouped = new Map<string, PlacedBetslip[]>()

		for (const bet of bets) {
			const dateKey = this.formatDateKey(bet.dateofbet)
			const existing = grouped.get(dateKey) || []
			existing.push(bet)
			grouped.set(dateKey, existing)
		}

		return Array.from(grouped.entries()).map(([date, bets]) => ({
			date,
			bets,
		}))
	}

	private formatDateKey(dateStr: string | null): string {
		if (!dateStr) return 'Unknown Date'

		try {
			const date = parseISO(dateStr)
			if (!isValid(date)) {
				return 'Unknown Date'
			}
			return format(date, 'MMM d, yyyy')
		} catch {
			return 'Unknown Date'
		}
	}

	get pageSize(): number {
		return this.PAGE_SIZE
	}
}
