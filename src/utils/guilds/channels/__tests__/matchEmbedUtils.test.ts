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
			expect(result).toContain('Lakers')
			expect(result).toContain('42-30')
			expect(result).toContain('Celtics')
			expect(result).toContain('48-24')
		})

		it('does not include a playoff series section', () => {
			const result = buildRecordsStr({
				...base,
				records: regularSeasonRecords,
			})
			expect(result).not.toContain('🏆')
		})

		it('uses Records header without playoff subtext', () => {
			const result = buildRecordsStr({
				...base,
				records: regularSeasonRecords,
			})
			expect(result).toContain('### Records')
			expect(result).not.toContain('Playoff')
		})

		it('shows — for a null total_record', () => {
			const result = buildRecordsStr({
				...base,
				records: {
					home_team: { total_record: null },
					away_team: { total_record: null },
				},
			})
			expect(result).toContain('—')
		})
	})

	describe('playoffs (series present)', () => {
		it('shows playoff series with round and leader info', () => {
			const result = buildRecordsStr({ ...base, records: playoffRecords })
			expect(result).toContain('### 🏆 Conference Finals')
			expect(result).toContain('Celtics')
			expect(result).toContain('lead the series')
			expect(result).toContain('3–2')
		})

		it('shows series with summary when wins are present', () => {
			const records = {
				home_team: { total_record: '48-24' },
				away_team: { total_record: '42-30' },
				series: { round: 'First Round', summary: 'LAL leads 2-0' },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('### 🏆 First Round')
			expect(result).toContain('LAL leads 2-0')
		})

		it('appends a Playoff Series block with series.summary', () => {
			const result = buildRecordsStr({ ...base, records: playoffRecords })
			expect(result).toContain('### 🏆 Conference Finals')
			expect(result).toContain('lead the series 3–2')
		})

		it('falls back to wins-based string when series.summary is absent', () => {
			const records = {
				...playoffRecords,
				series: { home_wins: 3, away_wins: 2, total_games: 7 },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('lead the series 3–2')
		})

		it('omits the series state line when summary and wins are both absent', () => {
			const records = {
				...playoffRecords,
				series: { round: 'Finals', completed: false },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('### 🏆 Finals')
			// Just the header, no state line
		})

		it('shows Playoff Series when round is absent', () => {
			const records = {
				...playoffRecords,
				series: { summary: 'LAL leads 3-2' },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('### 🏆 Playoff Series')
		})

		it('shows series header when the record is null', () => {
			const records = {
				home_team: { total_record: '48-24', playoff_record: null },
				away_team: { total_record: '42-30', playoff_record: null },
				series: { round: 'First Round', summary: 'BOS leads 1-0' },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('### 🏆 First Round')
			expect(result).toContain('BOS leads 1-0')
		})

		it('shows series header when both record and fallback are null', () => {
			const records = {
				home_team: { total_record: null, playoff_record: null },
				away_team: { total_record: null, playoff_record: null },
				series: { summary: 'Series underway' },
			}
			const result = buildRecordsStr({ ...base, records })
			expect(result).toContain('### 🏆 Playoff Series')
			expect(result).toContain('Series underway')
		})
	})
})
