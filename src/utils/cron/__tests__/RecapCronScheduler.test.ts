import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

import {
	matchesCronExpression,
	RecapCronScheduler,
} from '../RecapCronScheduler.js'

describe('matchesCronExpression', () => {
	it('matches the Monday 09:00 UTC default', () => {
		expect(
			matchesCronExpression(
				'0 9 * * 1',
				new Date('2026-07-13T09:00:00.000Z'),
			),
		).toBe(true)
		expect(
			matchesCronExpression(
				'0 9 * * 1',
				new Date('2026-07-13T09:01:00.000Z'),
			),
		).toBe(false)
	})
})

describe('RecapCronScheduler', () => {
	it('runs once for a matching minute despite duplicate polls', async () => {
		const runWeeklyRecap = vi.fn(async () => ({
			posted: 1,
			skipped: 0,
			failed: 0,
		}))
		const scheduler = new RecapCronScheduler(
			{ runWeeklyRecap },
			'0 9 * * 1',
		)
		const now = new Date('2026-07-13T09:00:15.000Z')

		expect(await scheduler.tick(now)).toBe(true)
		expect(await scheduler.tick(new Date('2026-07-13T09:00:45.000Z'))).toBe(
			false,
		)
		expect(runWeeklyRecap).toHaveBeenCalledTimes(1)
	})

	it('catches up when the bot starts after the scheduled minute', async () => {
		const runWeeklyRecap = vi.fn(async () => ({
			posted: 1,
			skipped: 0,
			failed: 0,
		}))
		const scheduler = new RecapCronScheduler(
			{ runWeeklyRecap },
			'0 9 * * 1',
		)

		expect(
			await scheduler.tick(new Date('2026-07-13T10:15:00.000Z'), true),
		).toBe(true)
		expect(runWeeklyRecap).toHaveBeenCalledTimes(1)
		expect(runWeeklyRecap).toHaveBeenCalledWith(
			new Date('2026-07-13T10:15:00.000Z'),
			true,
		)
	})
})

describe('period winners crons', () => {
	const run = () => vi.fn(async () => ({ posted: 0, skipped: 0, failed: 0 }))

	it('matches the weekly and monthly defaults', () => {
		const monday = new Date('2026-07-13T09:30:00.000Z')
		const firstOfMonth = new Date('2026-08-01T09:30:00.000Z')
		expect(matchesCronExpression('30 9 * * 1', monday)).toBe(true)
		expect(matchesCronExpression('30 9 * * 1', firstOfMonth)).toBe(false)
		expect(matchesCronExpression('30 9 1 * *', firstOfMonth)).toBe(true)
		expect(matchesCronExpression('30 9 1 * *', monday)).toBe(false)
	})

	it('catches up the weekly cron later on Monday only', async () => {
		const runWeeklyRecap = run()
		const scheduler = new RecapCronScheduler(
			{ runWeeklyRecap },
			'30 9 * * 1',
			undefined,
			'PERIOD_WINNERS_WEEKLY_CRON',
		)

		expect(
			await scheduler.tick(new Date('2026-07-14T10:00:00.000Z'), true),
		).toBe(false)
		expect(
			await scheduler.tick(new Date('2026-07-13T09:29:00.000Z'), true),
		).toBe(false)
		expect(
			await scheduler.tick(new Date('2026-07-13T14:00:00.000Z'), true),
		).toBe(true)
		expect(runWeeklyRecap).toHaveBeenCalledTimes(1)
	})

	it('catches up the monthly cron later on the 1st only', async () => {
		const runWeeklyRecap = run()
		const scheduler = new RecapCronScheduler(
			{ runWeeklyRecap },
			'30 9 1 * *',
			undefined,
			'PERIOD_WINNERS_MONTHLY_CRON',
		)

		expect(
			await scheduler.tick(new Date('2026-08-02T10:00:00.000Z'), true),
		).toBe(false)
		expect(
			await scheduler.tick(new Date('2026-08-01T20:00:00.000Z'), true),
		).toBe(true)
		expect(runWeeklyRecap).toHaveBeenCalledWith(
			new Date('2026-08-01T20:00:00.000Z'),
			true,
		)
	})
})
