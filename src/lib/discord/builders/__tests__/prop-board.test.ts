import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import { assertV2Budget } from '../../v2/kit.js'
import {
	boardBrowseLines,
	decodePropsBrowseCustomId,
	propBoardPayload,
	propsBrowseCustomId,
} from '../prop-board.js'

const prop = {
	event_id: 'evt-bills-chiefs',
	commence_time: '2026-10-04T20:25:00Z',
	home_team: 'Kansas City Chiefs',
	away_team: 'Buffalo Bills',
	sport_title: 'NFL',
	market_key: 'player_pass_yds',
	description: 'Patrick Mahomes',
	point: 274.5,
	over: { outcome_uuid: 'over-1', outcome_name: 'Over', price: -115 },
	under: { outcome_uuid: 'under-1', outcome_name: 'Under', price: 105 },
} as ProcessedPropDto

const second = {
	...prop,
	description: 'Josh Allen',
	market_key: 'player_pass_tds',
	point: 1.5,
	over: { outcome_uuid: 'over-2', outcome_name: 'Over', price: 120 },
	under: { outcome_uuid: 'under-2', outcome_name: 'Under', price: -140 },
} as ProcessedPropDto

const teams = { homeAbbrev: ['KC'], awayAbbrev: ['BUF'], homeColor: 0xe31837 }

describe('propBoardPayload', () => {
	it('renders one text block and its own choice row per pair, in order', () => {
		const payload = propBoardPayload({
			props: [prop, second],
			sport: 'nfl',
			teams,
		})
		// container + heading + matchup + 2×(text + row + 2 buttons) + footer
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 12,
		})
		expect(payload.allowedMentions).toEqual({ parse: [] })
		const [container] = toJsonComponents(payload) as Array<{
			accent_color?: number
			components: Array<{
				type: number
				content?: string
				components?: Array<{
					custom_id?: string
					label?: string
					disabled?: boolean
				}>
			}>
		}>
		expect(container.accent_color).toBe(0xe31837)
		expect(container.components.map((c) => c.type)).toEqual([
			10, 10, 10, 1, 10, 1, 10,
		])
		expect(container.components[0].content).toBe('## 🎯 Accuracy Challenge')
		expect(container.components[1].content).toContain('BUF vs. KC')
		expect(container.components[2].content).toContain('Patrick Mahomes')
		expect(container.components[4].content).toContain('Josh Allen')
		expect(
			container.components
				.filter((c) => c.type === 1)
				.map((row) =>
					row.components?.map((button) => button.custom_id),
				),
		).toEqual([
			['prop_over-1', 'prop_under-1'],
			['prop_over-2', 'prop_under-2'],
		])
		expect(container.components[6].content).toContain(
			'Each prop grades in place',
		)
	})

	it('caps a board at four pairs', () => {
		const many = Array.from({ length: 6 }, (_, i) => ({
			...prop,
			over: { ...prop.over, outcome_uuid: `over-${i}` },
			under: { ...prop.under, outcome_uuid: `under-${i}` },
		})) as ProcessedPropDto[]
		const payload = propBoardPayload({
			props: many,
			sport: 'nfl',
			teams,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{ type: number }>
		}>
		expect(container.components.filter((c) => c.type === 1)).toHaveLength(4)
	})

	it('falls back to a label instead of an invalid timestamp', () => {
		const payload = propBoardPayload({
			props: [{ ...prop, commence_time: 'not-a-date' }],
			sport: 'nfl',
			teams,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{ content?: string }>
		}>
		expect(container.components[1].content).toContain('Player props')
		expect(container.components[1].content).not.toContain('<t:')
	})
})

describe('board header emojis and game lines', () => {
	type Node = {
		type: number
		content?: string
		items?: Array<{ media: { url: string } }>
		components?: Array<{ custom_id?: string; label?: string }>
	}
	const nodes = (payload: ReturnType<typeof propBoardPayload>) =>
		(toJsonComponents(payload) as Array<{ components: Node[] }>)[0]
			.components
	const game = {
		h2h: {
			away: {
				outcome_uuid: 'h2h-away',
				outcome_name: 'Buffalo Bills',
				price: 150,
			},
			home: {
				outcome_uuid: 'h2h-home',
				outcome_name: 'Kansas City Chiefs',
				price: -180,
			},
		},
		totals: {
			point: 47.5,
			over: {
				outcome_uuid: 'total-over',
				outcome_name: 'Over',
				price: -110,
			},
			under: {
				outcome_uuid: 'total-under',
				outcome_name: 'Under',
				price: -105,
			},
		},
	}

	it('puts a real team emoji next to each abbreviation, and plain text otherwise', () => {
		const withEmojis = propBoardPayload({
			props: [prop],
			sport: 'nfl',
			teams: {
				...teams,
				awayEmoji: '<:bills:1>',
				homeEmoji: '<:chiefs:2>',
			},
		})
		expect(nodes(withEmojis)[1].content).toMatch(
			/^### 🏈 <:bills:1> BUF vs\. <:chiefs:2> KC\n/,
		)
		const oneEmoji = propBoardPayload({
			props: [prop],
			sport: 'nfl',
			teams: { ...teams, homeEmoji: '<:chiefs:2>' },
		})
		expect(nodes(oneEmoji)[1].content).toMatch(
			/^### 🏈 BUF vs\. <:chiefs:2> KC\n/,
		)
	})

	it('renders both logos, then the winner and total rows above the props', () => {
		const payload = propBoardPayload({
			props: [prop],
			sport: 'nfl',
			teams,
			game,
		})
		// container + heading + matchup + gallery + 2×(text + row + 2 buttons)
		// + divider + pair (text + row + 2 buttons) + footer
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 18,
		})
		const [
			,
			header,
			logos,
			winner,
			winnerRow,
			total,
			totalRow,
			,
			propText,
		] = nodes(payload)
		expect(header.content).toContain('Game lines and player props')
		expect(logos.items?.map((item) => item.media.url)).toEqual([
			'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
			'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
		])
		expect(winner.content).toBe('**Game winner**\nBUF +150 • KC -180')
		expect(
			winnerRow.components?.map((button) => [
				button.custom_id,
				button.label,
			]),
		).toEqual([
			['prop_h2h-away', 'BUF'],
			['prop_h2h-home', 'KC'],
		])
		expect(total.content).toBe(
			'**Game total** • O/U `47.5`\nOver -110 • Under -105',
		)
		expect(totalRow.components?.map((button) => button.custom_id)).toEqual([
			'prop_total-over',
			'prop_total-under',
		])
		expect(propText.content).toContain('Patrick Mahomes')
	})

	it('keeps a full four-pair board with game lines inside the V2 budget', () => {
		const pairs = [0, 1, 2, 3].map((n) => ({
			...prop,
			description: 'P'.repeat(700),
			over: { ...prop.over, outcome_uuid: `over-${n}` },
			under: { ...prop.under, outcome_uuid: `under-${n}` },
		}))
		const payload = propBoardPayload({
			props: pairs,
			sport: 'nfl',
			teams,
			game,
			browseToken: 'a'.repeat(16),
		})
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 32,
		})
		assertV2Budget(payload)
		const ids = nodes(payload).flatMap(
			(node) => node.components?.map((button) => button.custom_id) ?? [],
		)
		expect(ids).toContain('prop_over-3')
		expect(ids).toContain('props.browse.v1.aaaaaaaaaaaaaaaa')
	})

	it('shows only the market it has, and drops logos it cannot resolve', () => {
		const payload = propBoardPayload({
			props: [prop],
			sport: 'nfl',
			teams: { ...teams, awayAbbrev: [] },
			game: { totals: game.totals },
		})
		const types = nodes(payload).map((node) => node.type)
		expect(types).not.toContain(12)
		expect(nodes(payload).map((node) => node.content ?? '')).not.toContain(
			expect.stringContaining('Game winner'),
		)
	})
})

describe('Browse more', () => {
	it('adds a Browse more row only when a token is available', () => {
		const token = '0123456789abcdef'
		const withBrowse = propBoardPayload({
			props: [prop],
			sport: 'nfl',
			teams,
			browseToken: token,
		})
		const withoutBrowse = propBoardPayload({
			props: [prop],
			sport: 'nfl',
			teams,
		})
		const buttonIds = (payload: unknown) =>
			toJsonComponents(payload as never)
				.flatMap((container) => container.components ?? [])
				.flatMap((row) => row.components ?? [])
				.map((button) => (button as { custom_id?: string }).custom_id)
				.filter(Boolean)
		expect(buttonIds(withBrowse)).toContain(propsBrowseCustomId(token))
		expect(buttonIds(withoutBrowse)).not.toContain(
			propsBrowseCustomId(token),
		)
	})

	it('round-trips a valid token and rejects anything else', () => {
		const token = '0123456789abcdef'
		expect(decodePropsBrowseCustomId(propsBrowseCustomId(token))).toBe(
			token,
		)
		expect(decodePropsBrowseCustomId('props.browse.v1.SHORT')).toBeNull()
		expect(
			decodePropsBrowseCustomId('props.browse.v2.0123456789abcdef'),
		).toBeNull()
		expect(decodePropsBrowseCustomId('pg.v1.h-owned.1.next')).toBeNull()
	})

	it.each(['SHORT', '0123456789ABCDEF', '0123456789abcdeg', ''])(
		'refuses to encode the token %j instead of emitting a dead button id',
		(token) => {
			expect(() => propsBrowseCustomId(token)).toThrow(
				'invalid props browse token',
			)
		},
	)

	it('lists every pair under its game in tip-off order', () => {
		const late = {
			...prop,
			event_id: 'late',
			commence_time: '2026-10-05T23:00:00Z',
			home_team: 'Late Home',
			away_team: 'Late Away',
			description: 'Zed',
			over: { ...prop.over, outcome_uuid: 'over-late' },
			under: { ...prop.under, outcome_uuid: 'under-late' },
		} as ProcessedPropDto
		const lines = boardBrowseLines([late, prop, second], 'nfl')
		expect(lines[0]).toContain('Buffalo Bills vs. Kansas City Chiefs')
		expect(lines[1]).toContain('Josh Allen')
		expect(lines[2]).toContain('Patrick Mahomes')
		expect(lines[3]).toContain('Late Away vs. Late Home')
		expect(lines[4]).toContain('Zed')
		expect(lines[1]).toContain('Passing Touchdowns O/U `1.5`')
	})
})
