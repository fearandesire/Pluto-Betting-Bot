import type { OverallStatsDto } from '../../../openapi/khronos/index.js'
import StatsWraps from '../../api/Khronos/stats/stats-wrapper.js'
import { createLogger } from '../../logging/WinstonLogger.js'

const log = createLogger({ component: 'game', handler: 'player-compare' })

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CompareOptions {
	userId1: string
	userId2: string
	username1: string
	username2: string
}

export type StatWinner = 1 | 2 | 'tie'

export interface StatComparison {
	label: string
	value1: string
	value2: string
	winner: StatWinner
}

export interface CompareResult {
	username1: string
	username2: string
	overallWinner: string | 'tie'
	stats: StatComparison[]
	score: { player1: number; player2: number }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCount(n: number): string {
	return n === 0 ? 'N/A' : n.toLocaleString()
}

function fmtMoney(n: number): string {
	return n === 0 ? 'N/A' : `$${n.toLocaleString()}`
}

function fmtPct(n: number): string {
	return n === 0 ? 'N/A' : `${n.toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// Stat descriptors
// ---------------------------------------------------------------------------

interface StatDescriptor {
	label: string
	extract: (dto: OverallStatsDto) => number
	format: (n: number) => string
	/** Higher value wins when true; lower value wins when false. */
	higherIsBetter: boolean
}

const STAT_DESCRIPTORS: StatDescriptor[] = [
	{
		label: 'Total Bets',
		extract: (d) => d.totalBets,
		format: fmtCount,
		higherIsBetter: true,
	},
	{
		label: 'Wins',
		extract: (d) => d.totalWins,
		format: fmtCount,
		higherIsBetter: true,
	},
	{
		label: 'Losses',
		extract: (d) => d.totalLosses,
		format: fmtCount,
		higherIsBetter: false,
	},
	{
		label: 'Win Rate',
		extract: (d) => d.winRate,
		format: fmtPct,
		higherIsBetter: true,
	},
	{
		label: 'Highest Bet',
		extract: (d) => d.highestBetAmount,
		format: fmtMoney,
		higherIsBetter: true,
	},
	{
		label: 'Total Won',
		extract: (d) => d.profitLossSummary.totalWon,
		format: fmtMoney,
		higherIsBetter: true,
	},
	{
		label: 'Total Lost',
		extract: (d) => d.profitLossSummary.totalLost,
		format: fmtMoney,
		higherIsBetter: false,
	},
	{
		label: 'Net Profit',
		extract: (d) => d.profitLossSummary.netProfit,
		format: fmtMoney,
		higherIsBetter: true,
	},
]

// ---------------------------------------------------------------------------
// Core comparison logic
// ---------------------------------------------------------------------------

function compareStatPair(
	descriptor: StatDescriptor,
	dto1: OverallStatsDto,
	dto2: OverallStatsDto,
): StatComparison {
	const v1 = descriptor.extract(dto1)
	const v2 = descriptor.extract(dto2)

	let winner: StatWinner
	if (v1 === v2) {
		winner = 'tie'
	} else if (descriptor.higherIsBetter) {
		winner = v1 > v2 ? 1 : 2
	} else {
		winner = v1 < v2 ? 1 : 2
	}

	return {
		label: descriptor.label,
		value1: descriptor.format(v1),
		value2: descriptor.format(v2),
		winner,
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class PlayerCompare {
	private readonly statsWraps = new StatsWraps()

	/**
	 * Fetch stats for both players and produce a head-to-head comparison.
	 */
	async compare(options: CompareOptions): Promise<CompareResult> {
		const { userId1, userId2, username1, username2 } = options

		const [dto1, dto2] = await Promise.all([
			this.statsWraps.getOverallStats({ userId: userId1 }),
			this.statsWraps.getOverallStats({ userId: userId2 }),
		])

		log.info('Comparing players', {
			event: 'player.compare_start',
			userId1,
			userId2,
		})

		const stats = this.buildStatComparisons(dto1, dto2)
		const score = this.tallyScore(stats)
		const overallWinner = this.resolveOverallWinner(score, username1, username2)

		log.info('Player comparison complete', {
			event: 'player.compare_complete',
			userId1,
			userId2,
			score,
			overallWinner,
		})

		return { username1, username2, overallWinner, stats, score }
	}

	private buildStatComparisons(
		dto1: OverallStatsDto,
		dto2: OverallStatsDto,
	): StatComparison[] {
		const comparisons: StatComparison[] = []

		for (const descriptor of STAT_DESCRIPTORS) {
			const result = compareStatPair(descriptor, dto1, dto2)

			// debug — one line per stat pair; kept out of production transports
			// by the configured log level (info in prod, debug in dev/test).
			log.debug('Stat pair compared', {
				label: descriptor.label,
				value1: result.value1,
				value2: result.value2,
				winner: result.winner,
			})

			comparisons.push(result)
		}

		return comparisons
	}

	private tallyScore(
		stats: StatComparison[],
	): { player1: number; player2: number } {
		let p1 = 0
		let p2 = 0
		for (const s of stats) {
			if (s.winner === 1) p1++
			else if (s.winner === 2) p2++
		}
		return { player1: p1, player2: p2 }
	}

	private resolveOverallWinner(
		score: { player1: number; player2: number },
		username1: string,
		username2: string,
	): string | 'tie' {
		if (score.player1 > score.player2) return username1
		if (score.player2 > score.player1) return username2
		return 'tie'
	}
}

export const playerCompare = new PlayerCompare()
