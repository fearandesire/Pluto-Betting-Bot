import { EmbedBuilder } from 'discord.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { LogType } from '../../../../utils/logging/AppLog.interface.js'
import {
	activePropsEmbed,
	activePropsFields,
	appLogEmbed,
	fieldsPaginator,
	footerStatusEmbed,
	guildConfigViewEmbed,
	predictionDeletedEmbed,
	predictionField,
	predictionsTemplateEmbed,
	propsPostedEmbed,
} from '../admin.js'
import { commandErrorLogEmbed } from '../admin-command-error.js'

const NOW = new Date('2026-10-04T19:30:00Z')
const AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
const ts = NOW.toISOString()

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterAll(() => vi.useRealTimers())

describe('admin builders (classic, pre-migration)', () => {
	it('F1 footerStatusEmbed', () => {
		expect(
			footerStatusEmbed({
				lastRefresh: new Date(1_790_000_000_000),
				nextRefresh: null,
				ttl: '60 minutes',
				cacheSize: 3,
				categoryCounts: { core: 3 },
				hasAnnouncement: false,
			}).toJSON(),
		).toEqual({
			title: '📋 Footer Cache Status',
			color: 0xd8b21a,
			fields: [
				{
					name: '⏰ Refresh Information',
					value: '**Last Refresh:** <t:1790000000:R>\n**Next Refresh:** Unknown\n**TTL:** 60 minutes',
					inline: false,
				},
				{
					name: '📊 Statistics',
					value: '**Total Footers:** 3\n**Categories:** 1\n**Announcement Active:** ❌ No',
					inline: false,
				},
				{
					name: '📁 Categories',
					value: '• **core:** 3 footers',
					inline: false,
				},
			],
		})
	})

	it('F2 guildConfigViewEmbed lists every setting type', () => {
		const json = guildConfigViewEmbed({
			guildName: 'G',
			defined: new Map([['BETTING_CHAN', '123']]),
			username: 'u',
			avatarUrl: AVATAR,
		}).toJSON()
		expect(json.title).toBe('G Guild Configuration')
		expect(json.color).toBe(0x3498db)
		expect(json.author).toEqual({ name: 'u', icon_url: AVATAR })
		expect(json.fields?.slice(0, 2)).toEqual([
			// Enum keys are PascalCase, so the title-casing flattens them.
			{ name: 'Gamescategory', value: 'Not set' },
			{ name: 'Bettingchan', value: '123' },
		])
		expect(json.fields).toHaveLength(7)
	})

	it('F3 predictionsTemplateEmbed + predictionField', () => {
		expect(predictionsTemplateEmbed('u', '1', 7).toJSON()).toEqual({
			title: 'Active Predictions | u',
			description: 'Total: `7` active prediction(s)',
			color: 0xc8eefb,
			footer: { text: 'User ID: 1', icon_url: undefined },
		})
		expect(
			predictionField({
				id: 'aaaaaaaa-0000e1f1',
				choice: 'over',
				point: 27.5,
				marketKey: 'player_points',
				outcomeDescription: 'LeBron James',
				match: 'Lakers vs. Celtics',
				date: '10/03/2026',
			}),
		).toEqual({
			name: 'Prediction #0000e1f1',
			value: '**ID:** `0000e1f1`\n\n**Prop Details**\n**Prop:** LeBron James\n**Choice:** OVER 27.5 Points\n\n**Event Details**\n**Match:** Lakers vs. Celtics\n**Date:** 10/03/2026',
			inline: false,
		})
	})

	it('F3/F6 fieldsPaginator: 5 per page, page template is the message template', () => {
		const items = Array.from({ length: 7 }, (_, i) => ({
			name: `n${i}`,
			value: 'v',
			inline: false,
		}))
		const pm = fieldsPaginator(new EmbedBuilder().setTitle('T'), items)
		expect(pm.pages).toHaveLength(2)
		expect(pm.template.embeds?.[0]).toBeInstanceOf(EmbedBuilder)
	})

	it('F4 predictionDeletedEmbed', () => {
		expect(
			predictionDeletedEmbed({
				id: 'xxxx-0000e1f1',
				username: 'u',
				userId: '1',
				match: 'A vs. B',
				choice: 'over',
				date: '10/03/2026',
			}).toJSON(),
		).toEqual({
			title: '✅ Prediction Deleted',
			color: 0x57f287,
			description: 'Successfully deleted prediction for u.',
			fields: [
				{ name: 'Prediction ID', value: '`0000e1f1`', inline: true },
				{ name: 'User', value: 'u (1)', inline: true },
				{ name: 'Match', value: 'A vs. B', inline: false },
				{ name: 'Choice', value: 'over', inline: true },
				{ name: 'Created', value: '10/03/2026', inline: true },
			],
			timestamp: ts,
		})
	})

	it('F5 propsPostedEmbed', () => {
		expect(
			propsPostedEmbed(
				{ total: 10, posted: 1, failed: 2 },
				'<#3>',
			).toJSON(),
		).toEqual({
			title: 'Player Props Posted',
			description:
				'✅ Successfully posted **1** player prop to <#3>\n❌ Failed to post **2** props',
			color: 0x57f287,
			fields: [
				{ name: 'Total Pairs', value: '10', inline: true },
				{ name: 'Posted', value: '1', inline: true },
				{ name: 'Failed', value: '2', inline: true },
			],
			timestamp: ts,
		})
	})

	it('F6 activePropsEmbed + activePropsFields', () => {
		expect(activePropsEmbed(1, 2).toJSON()).toEqual({
			title: 'Active Props - Pending Results',
			description:
				'Found **1** outcome with active predictions across **2** dates.\nManage prop results in the Khronos admin dashboard.',
			color: 0xc8eefb,
			timestamp: ts,
		})
		const fields = activePropsFields([
			{
				date: '2026-10-04T16:00:00Z',
				games: [
					{
						event_id: 'e',
						matchup: 'A @ B',
						home_team: 'B',
						away_team: 'A',
						commence_time: '2026-10-04T23:30:00Z',
						sport_title: 'NBA',
						props: [
							{
								outcome_uuid: 'uuid-1',
								market_key: 'player_points',
								description: 'LeBron James',
								point: 24.5,
								prediction_count: 1,
							},
						],
					},
				],
			},
		])
		expect(fields[0].name).toMatch(/^​\n📅 Sun, Oct 4, 2026$/)
		expect(fields.slice(1)).toEqual([
			{
				name: '🎯 A @ B',
				value: 'Time: <t:1791156600:d> @ <t:1791156600:t> • 1 prediction',
				inline: false,
			},
			{
				name: '  └ 🎯 uuid-1',
				value: '  **Market:** Player Points • **Player:** LeBron James • **Line:** 24.5 • **Predictions:** 1',
				inline: false,
			},
		])
	})

	it('F7 appLogEmbed', () => {
		expect(appLogEmbed('d', LogType.Warning, AVATAR).toJSON()).toEqual({
			description: 'd',
			color: 0xf29831,
			author: { name: 'Pluto', icon_url: AVATAR, url: undefined },
			timestamp: ts,
		})
	})

	it('F8 commandErrorLogEmbed', () => {
		const err = new Error('boom')
		err.stack =
			'Error: boom\n    at a (/cwd/x.js:1:1)\n    at b\n    at c\n    at d'
		expect(
			commandErrorLogEmbed(
				err,
				{
					commandName: 'admin',
					subcommandGroup: null,
					subcommand: 'view',
					userId: '1',
					durationMs: 12,
				},
				'/cwd',
			).toJSON(),
		).toEqual({
			color: 0xaa2d2d,
			title: 'Command Error',
			fields: [
				{ name: 'Command', value: '/admin view', inline: true },
				{ name: 'User', value: '<@1>', inline: true },
				{ name: 'Duration', value: '12ms', inline: true },
				{ name: 'Error', value: '`Error: boom`' },
				{
					name: 'Stack',
					value: '```\nError: boom\nat a (/x.js:1:1)\nat b\nat c\n```',
				},
			],
			timestamp: ts,
		})
	})
})
