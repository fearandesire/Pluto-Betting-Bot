import type { PlacedBetslip } from '@kh-openapi'
import { format, isValid, parseISO } from 'date-fns'
import { PlacedBetslipBetresultEnum } from '../../../../openapi/khronos/index.js'
import { logger } from '../../../logging/WinstonLogger.js'
import BetslipWrapper from './betslip-wrapper.js'

export interface MyBetsData {
	pendingBets: PlacedBetslip[]
	historyBets: PlacedBetslip[]
	totalPages: number
}

export interface HistoryPage {
	bets: PlacedBetslip[]
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

	constructor(betslipWrapper?: BetslipWrapper) {
		this.betslipWrapper = betslipWrapper ?? new BetslipWrapper()
	}

	async fetchUserBets(userId: string): Promise<MyBetsData> {
		try {
			const allBets = await this.betslipWrapper.getUserBetslips({
				userid: userId,
			})

			const { pending, history } = this.splitBetsByStatus(allBets)
			const sortedHistory = this.sortByDateDesc(history)
			const totalPages = Math.max(
				1,
				Math.ceil(sortedHistory.length / this.PAGE_SIZE),
			)

			return {
				pendingBets: pending,
				historyBets: sortedHistory,
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

	getHistoryPage(historyBets: PlacedBetslip[], page: number): HistoryPage {
		const totalPages = Math.max(
			1,
			Math.ceil(historyBets.length / this.PAGE_SIZE),
		)
		const clampedPage = Math.max(1, Math.min(page, totalPages))
		const start = (clampedPage - 1) * this.PAGE_SIZE
		const end = start + this.PAGE_SIZE

		return {
			bets: historyBets.slice(start, end),
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
