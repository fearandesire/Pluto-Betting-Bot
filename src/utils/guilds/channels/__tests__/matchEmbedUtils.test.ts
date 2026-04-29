import { buildRecordsStr } from '../matchEmbedUtils.js'

const base = { awayTeamShortName: 'Lakers', homeTeamShortName: 'Celtics' }

const regularSeasonRecords = {
	home_team: { total_record: '48-24' },
	away_team: { total_record: '42-30' },
}

const playoffRecords = {
	home_team: { total_record: '48-24', playoff_record: '4-3' },
	away_team: { total_record: '42-30', playoff_record: '3-4' },
	series: {
		round: 'Conference Finals',
		summary: 'BOS leads series 3-2',
		home_wins: 3,
		away_wins: 2,
		total_games: 7,
		completed: false,
	},
}

describe('buildRecordsStr', () => {
	it('returns empty string when records is null', () => {
		expect(buildRecordsStr({ ...base, records: null })).toBe('')
	})

	it('returns empty string when records is undefined', () => {
		expect(buildRecordsStr({ ...base })).toBe('')
	})

	describe('regular season (no series)', () => {
		it('shows total_record for both teams', () => {
			const result = buildRecordsStr({
				...base,
				records: regularSeasonRecords,
			})
			expect(result).toContain('Lakers: 42-30')
			expect(result).toContain('Celtics: 48-24')
		})

		it('does not include a playoff series section', () => {
			const result = buildRecordsStr({
				...base,
				records: regularSeasonRecords,
			})
			expect(result).not.toContain('Playoff Series')
		})

		it('uses Team Records header without playoff subtext', () => {
			const result = buildRecordsStr({
				...base,
				records: regularSeasonRecords,
			})
			expect(result).toContain('🔵 **Team Records**')
			expect(result).not.toContain('Teams Playoff Record')
			expect(result).not.toContain('Current Playoffs')
		})

		it('shows — for a null total_record', () => {
			const result = buildRecordsStr({
				...base,
				records: {
					home_team: { total_record: null },
					away_team: { total_record: null },
				},
			})
			expect(result).toContain('Lakers: —')
			expect(result).toContain('Celtics: —')
		})
	})

	describe('playoffs (series present)', () => {
		it('shows playoff_record instead of total_record', () => {
			const result = buildRecordsStr({ ...base, records: playoffRecords })
			expect(result).toContain('🔵 **Teams Playoff Record**')
			expect(result).toContain('-# *Current Playoffs*')
			expect(result).toContain('Lakers: 3-4')
			expect(result).toContain('Celtics: 4-3')
			expect(result).not.toContain('*(playoff)*')
			expect(result).not.toContain('42-30')
			expect(result).not.toContain('48-24')
		})

		it('falls back to total_record when playoff_record is absent', () => {
			const records = {
				home_team: { total_record: '48-24' },
				away_team: { total_record: '42-30' },
				series: { round: 'First Round', summary: 'LAL leads 2-0' },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('🔵 **Teams Playoff Record**')
			expect(result).toContain('-# *Current Playoffs*')
			expect(result).toContain('Lakers: 42-30')
			expect(result).toContain('Celtics: 48-24')
			expect(result).not.toContain('*(playoff)*')
		})

		it('appends a Playoff Series block with series.summary', () => {
			const result = buildRecordsStr({ ...base, records: playoffRecords })
			expect(result).toContain(
				'🏆 **Playoff Series — Conference Finals**',
			)
			expect(result).toContain('BOS leads series 3-2')
		})

		it('falls back to wins-based string when series.summary is absent', () => {
			const records = {
				...playoffRecords,
				series: { home_wins: 3, away_wins: 2, total_games: 7 },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('Lakers 2 – 3 Celtics')
		})

		it('omits the series block when summary and wins are both absent', () => {
			const records = {
				...playoffRecords,
				series: { round: 'Finals', completed: false },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).not.toContain('🏆')
		})

		it('omits round label from series header when round is absent', () => {
			const records = {
				...playoffRecords,
				series: { summary: 'LAL leads 3-2' },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('🏆 **Playoff Series**')
			expect(result).not.toContain('—')
		})

		it('does not append playoff label when the record is null', () => {
			const records = {
				home_team: { total_record: '48-24', playoff_record: null },
				away_team: { total_record: '42-30', playoff_record: null },
				series: { round: 'First Round', summary: 'BOS leads 1-0' },
			}
			const result = buildRecordsStr({ ...base, records })
			// Falls back to total_record; playoff context is in header/subtext only
			expect(result).toContain('🔵 **Teams Playoff Record**')
			expect(result).toContain('-# *Current Playoffs*')
			expect(result).toContain('Lakers: 42-30')
			expect(result).toContain('Celtics: 48-24')
			expect(result).not.toContain('*(playoff)*')
		})

		it('does not append playoff label when both record and fallback are null', () => {
			const records = {
				home_team: { total_record: null, playoff_record: null },
				away_team: { total_record: null, playoff_record: null },
				series: { summary: 'Series underway' },
			}
			const result = buildRecordsStr({ ...base, records })
			// Null record → shows — without the *(playoff)* label
			expect(result).toContain('🔵 **Teams Playoff Record**')
			expect(result).toContain('-# *Current Playoffs*')
			expect(result).toContain('Lakers: —')
			expect(result).toContain('Celtics: —')
			expect(result).not.toContain('*(playoff)*')
		})
	})
})
