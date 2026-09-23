import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IMatchupAggregated } from '../../../../utils/api/common/interfaces/kh-pluto/kh-pluto.interface.js'
import {
	dailyScheduleEmbed,
	matchPostEmbed,
	scheduleGameLine,
} from '../odds.js'

const game = {
	sport_title: 'NFL',
	commence_time: '2026-10-04T20:25:00Z',
	home_team: 'Kansas City Chiefs',
	away_team: 'Buffalo Bills',
	teamRecords: ['3-1', '4-0'],
} as IMatchupAggregated

describe('odds builders (classic, pre-migration)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-10-04T16:00:00Z'))
	})
	afterEach(() => vi.useRealTimers())

	it('pins the daily schedule embed (B2)', () => {
		expect(dailyScheduleEmbed('line\n').toJSON()).toEqual({
			description: '## Daily Schedule | 10/04/2026\nline\n',
			color: 0xaa2d2d,
			footer: { text: 'dev. fenixforever', icon_url: undefined },
		})
	})

	it('falls back to the sport emoji when no guild emoji is found (B2)', () => {
		expect(scheduleGameLine(game, { home: undefined, away: null })).toBe(
			'**🏈 Bills *(4-0)*** *`at`* **🏈 Chiefs *(3-1)*** @ *<t:1791145500:t>*',
		)
		expect(
			scheduleGameLine(game, { home: '<:Chiefs:1>', away: '<:Bills:2>' }),
		).toBe(
			'**<:Bills:2> Bills *(4-0)*** *`at`* **<:Chiefs:1> Chiefs *(3-1)*** @ *<t:1791145500:t>*',
		)
	})

	it('pins the game-channel match post (B3)', () => {
		expect(
			matchPostEmbed(
				{
					favored: 'Kansas City Chiefs',
					favoredTeamClr: '#E31837',
					home_team: 'Kansas City Chiefs',
					homeTeamShortName: 'Chiefs',
					away_team: 'Buffalo Bills',
					awayTeamShortName: 'Bills',
					bettingChanId: '300',
					header: '',
					sport: 'nfl',
					records: {
						home_team: { total_record: '3-1' },
						away_team: { total_record: '4-0' },
					},
				},
				'',
			).toJSON(),
		).toEqual({
			color: 0xe31837,
			description:
				'# Bills @ Chiefs\n\n>   **Kansas City Chiefs** opens as the favorite.\n\n### Records\n` Bills `  4-0\n` Chiefs `  3-1\n\n**Place your bets** → `/commands` in <#300>',
			footer: {
				text: 'Pluto | Created by fenixforever',
				icon_url: undefined,
			},
		})
	})
})
