import {
	type AllUserPredictionsDto,
	GetAllPredictionsFilteredStatusEnum,
	type ProcessedPropDto,
} from '@pluto-khronos/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	leaderboardScore,
	predictionDeprecationEmbed,
	predictionHistoryField,
	predictionHistoryPaginator,
	predictionHistoryTemplate,
	predictionLeaderboardEmbed,
	predictionStatsEmbed,
	propPostButtons,
	propPostEmbed,
	propSettlementEmbed,
} from '../props.js'

const NOW = '2026-10-04T19:30:00.000Z'

const prop = {
	commence_time: '2026-10-04T20:25:00Z',
	market_key: 'player_pass_yds',
	description: 'Patrick Mahomes',
	point: 274.5,
	over: { outcome_uuid: 'over-uuid', outcome_name: 'Over', price: -115 },
	under: { outcome_uuid: 'under-uuid', outcome_name: 'Under', price: 105 },
} as ProcessedPropDto

const teams = { homeAbbrev: ['KC'], awayAbbrev: ['BUF'], homeColor: 0xe31837 }

describe('props builders (classic, pre-migration)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(NOW))
	})
	afterEach(() => vi.useRealTimers())

	it('pins the prop post embed and prop_<uuid> buttons (C1)', () => {
		const json = propPostEmbed(prop, 'nfl', teams).toJSON()
		expect(json).toMatchObject({
			title: '🎯 Accuracy Challenge',
			description:
				'### **Patrick Mahomes** • O/U **`274.5`** Passing Yards\n\n**Market:** Passing Yards\n**Over**: -115\n**Under**: +105',
			color: 0xe31837,
			timestamp: NOW,
		})
		expect(json.fields?.[0]).toEqual({
			name: 'Match',
			value: '🏈 KC vs. BUF',
			inline: true,
		})
		expect(json.fields?.[1]?.name).toBe('Game Time')
		expect(json.fields?.[1]?.value).toMatch(/^⏰ Sun, \d{1,2}:25 PM$/)

		expect(propPostButtons(prop).toJSON()).toEqual({
			type: 1,
			components: [
				{
					type: 2,
					custom_id: 'prop_over-uuid',
					label: 'Over',
					emoji: { name: '⬆️', animated: false },
					style: 3,
				},
				{
					type: 2,
					custom_id: 'prop_under-uuid',
					label: 'Under',
					emoji: { name: '⬇️', animated: false },
					style: 4,
				},
			],
		})
	})

	it('appends result + tally fields, then replaces them in place (C2)', () => {
		const original = {
			title: 't',
			fields: [{ name: 'Match', value: 'm', inline: true }],
		}
		const data = {
			outcome_uuid: 'over-uuid',
			result: 'won' as const,
			winning_side_display: 'Over',
			actual_value: 301,
			market_key: 'player_pass_yds',
			description: 'Patrick Mahomes',
			tallies: { correct: 14, incorrect: 9, total: 23 },
			messages: [{ guild_id: 'g', channel_id: 'c', message_id: 'm' }],
		}
		const settled = propSettlementEmbed(original, data).toJSON()
		expect(settled.fields).toEqual([
			{ name: 'Match', value: 'm', inline: true },
			{
				name: '🎯 Result',
				value: '**Result: Over ✅ — 301**',
				inline: false,
			},
			{
				name: '📊 Prediction results',
				value: '61% of 23 predictors got it right (14 correct, 9 incorrect).',
				inline: false,
			},
		])

		const resettled = propSettlementEmbed(settled, {
			...data,
			result: 'void',
			winning_side_display: undefined,
			actual_value: null,
			tallies: { correct: 0, incorrect: 0, total: 1 },
		}).toJSON()
		expect(resettled.fields?.slice(1)).toEqual([
			{
				name: '🎯 Result',
				value: '**Result: Voided 🚫**',
				inline: false,
			},
			{
				name: '📊 Prediction results',
				value: '0% of 1 predictor got it right (0 correct, 0 incorrect).',
				inline: false,
			},
		])
	})

	it('pins the history template, field and page 1 (C5)', async () => {
		expect(
			predictionHistoryTemplate('Pluto Tester', 'pending').toJSON(),
		).toEqual({
			title: 'Prediction History | Pluto Tester',
			color: 0xc8eefb,
			description: 'Filtered by: `pending`',
		})
		const field = predictionHistoryField({
			prediction: {
				choice: 'OVER',
				status: GetAllPredictionsFilteredStatusEnum.Completed,
				is_correct: true,
				description: 'Josh Allen',
			} as AllUserPredictionsDto,
			matchLabel: 'Bills vs. Chiefs',
			date: '10/04/2026',
			point: 1.5,
			marketKey: 'player_pass_tds',
		})
		expect(field).toEqual({
			name: 'Bills vs. Chiefs',
			value: '**Date**: 10/04/2026\n**Status**: Correct ✅\n**Choice**: `Over 1.5`\n**Market**: Pass Tds\n**Player:** Josh Allen',
			inline: false,
		})

		const pager = predictionHistoryPaginator(
			predictionHistoryTemplate('Pluto Tester', null),
			Array.from({ length: 11 }, () => field),
		)
		expect(pager.pages).toHaveLength(2)
		const page = await pager.resolvePage(
			{ channel: { guild: null } } as never,
			{ id: 'u' } as never,
			0,
		)
		const embed = page.embeds?.[0] as {
			title?: string
			footer?: { text: string }
		}
		expect(embed.title).toBe('Prediction History | Pluto Tester')
		expect(embed.footer?.text).toBe('1 / 2')
		expect(
			page.components?.flatMap((row) =>
				(
					JSON.parse(JSON.stringify(row)) as {
						components: { custom_id: string }[]
					}
				).components.map((c) => c.custom_id),
			),
		).toEqual([
			'@sapphire/paginated-messages.firstPage',
			'@sapphire/paginated-messages.previousPage',
			'@sapphire/paginated-messages.nextPage',
			'@sapphire/paginated-messages.goToLastPage',
			'@sapphire/paginated-messages.stop',
			'@sapphire/paginated-messages.goToPage',
		])
	})

	it('pins the stats embed (C6)', () => {
		const json = predictionStatsEmbed({
			username: 'Pluto Tester',
			totalPredictions: 47,
			correctPredictions: 30,
			incorrectPredictions: 17,
			winRate: 63.83,
			pendingCount: 3,
			currentStreak: 4,
			bestStreak: 9,
			statsAvailable: true,
			badgeTier: 3,
		}).toJSON()
		expect(json).toMatchObject({
			title: '📊 Prediction Statistics',
			color: 0xc8eefb,
			description:
				'Server stats for Pluto Tester\n\nCurrent Streak: **4** · Best: **9**',
			footer: {
				text: "Use /predictions leaderboard to compare your streak • voids/pushes don't break streaks.",
			},
			timestamp: NOW,
		})
		expect(json.fields?.map((f) => f.value)).toEqual([
			'`47`',
			'`63.8%`',
			'​',
			'`30`',
			'`17`',
			'`3`',
			'`4`',
			'`9`',
			'`🔥3`',
		])
	})

	it('pins the leaderboard page (C7)', () => {
		expect(leaderboardScore(30, 10)).toBe(280)
		expect(
			predictionLeaderboardEmbed(
				[
					{
						position: 1,
						username: 'Pluto Tester',
						score: 280,
						correctPredictions: 30,
						incorrectPredictions: 10,
						currentStreak: 6,
						badgeTier: null,
					},
				],
				1,
				24,
			).toJSON(),
		).toEqual({
			title: 'Prediction Accuracy Leaderboard',
			color: 0xc8eefb,
			description: '1. Pluto Tester 🔥5 - **`280`** *(30/40)*',
			footer: {
				text: 'Page 1 of 2 | Total Entries: 24 | 🔥3/5/10 = streak badge',
				icon_url: undefined,
			},
		})
	})

	it('pins the deprecated alias notice (C8)', () => {
		expect(
			predictionDeprecationEmbed('/predictions history').toJSON(),
		).toEqual({
			color: 0x3498db,
			title: 'Prediction command moved',
			description:
				'This command is kept for one release as an alias. Use **/predictions history** instead.',
			footer: {
				text: 'Legacy aliases will be removed after the migration window.',
				icon_url: undefined,
			},
		})
	})
})
