import { describe, expect, it, vi } from 'vitest'

vi.mock('../../KhronosInstances.js', () => ({ KH_API_CONFIG: {} }))

import RecapWrapper, {
	type PeriodWinnersResponse,
	type WeeklyRecapResponse,
} from '../recap-wrapper.js'

const recap = (sport?: 'nfl' | 'nba'): WeeklyRecapResponse => ({
	window: {
		start_date: '2026-07-06T00:00:00.000Z',
		end_date: '2026-07-12T23:59:59.999Z',
		week_number: 28,
		season_year: 2026,
		...(sport ? { sport } : {}),
	},
	total_predictions: 0,
	correct_predictions: 0,
	incorrect_predictions: 0,
	accuracy: 0,
	accuracy_delta: 0,
	top_predictors: [],
	biggest_single_win: null,
	biggest_parlay_win: null,
})

const winners: PeriodWinnersResponse = {
	sport: 'nba',
	period: 'weekly',
	window: {
		start_date: '2026-07-06T00:00:00.000Z',
		end_date: '2026-07-12T23:59:59.999Z',
		label: 'Jul 6 – Jul 12',
	},
	participants: 0,
	unresolved_events: 0,
	winners: [],
	leaderboard: [],
}

describe('RecapWrapper', () => {
	it('forwards sport only when requested', async () => {
		const getWeeklyRecap = vi.fn(
			async (_g: string, _o?: number, s?: 'nfl' | 'nba') => recap(s),
		)
		const wrapper = new RecapWrapper({ getWeeklyRecap })

		await wrapper.getWeeklyRecap('g1', -1)
		await wrapper.getWeeklyRecap('g1', -1, 'nba')

		expect(getWeeklyRecap).toHaveBeenNthCalledWith(1, 'g1', -1, undefined)
		expect(getWeeklyRecap).toHaveBeenNthCalledWith(2, 'g1', -1, 'nba')
	})

	it('rejects a recap whose window sport does not match the request', async () => {
		const wrapper = new RecapWrapper({
			getWeeklyRecap: vi.fn(async () => recap()),
		})

		await expect(wrapper.getWeeklyRecap('g1', -1, 'nba')).rejects.toThrow(
			/requested sport nba/,
		)
	})

	it('passes period winner requests through and checks the echo', async () => {
		const getPeriodWinners = vi.fn(async () => winners)
		const wrapper = new RecapWrapper({
			getWeeklyRecap: vi.fn(async () => recap()),
			getPeriodWinners,
		})
		const request = {
			guildId: 'g1',
			sport: 'nba' as const,
			period: 'weekly' as const,
			periodOffset: -1,
		}

		expect(await wrapper.getPeriodWinners(request)).toEqual(winners)
		expect(getPeriodWinners).toHaveBeenCalledWith(request)
		await expect(
			wrapper.getPeriodWinners({ ...request, period: 'monthly' }),
		).rejects.toThrow(/requested nba\/monthly/)
	})

	it('throws a clear error when the client lacks getPeriodWinners', async () => {
		const wrapper = new RecapWrapper({
			getWeeklyRecap: vi.fn(async () => recap()),
		})

		await expect(
			wrapper.getPeriodWinners({
				guildId: 'g1',
				sport: 'nfl',
				period: 'weekly',
			}),
		).rejects.toThrow(/getPeriodWinners is unavailable/)
	})
})
