import { describe, expect, it } from 'vitest'
import { changelogEmbed } from '../changelog.js'

describe('changelogEmbed (classic, pre-migration)', () => {
	const published_at = new Date('2026-10-02T17:00:00Z')

	it('pins the /changelog embed and unescapes \\n', () => {
		expect(
			changelogEmbed(
				{
					version: '4.12.4',
					title: 'Big\\nday',
					content: 'a\\nb',
					published_at,
				},
				'42',
			).toJSON(),
		).toEqual({
			title: 'Pluto Update v4.12.4',
			description: '**Big\nday**\n\na\nb\n\nMade by <@42>',
			color: 0xc8eefb,
			fields: [
				{
					name: '📅 Published',
					value: '<t:1790960400:R>',
					inline: true,
				},
				{ name: 'Docs', value: 'https://docs.pluto.fearandesire.com' },
			],
			footer: {
				text: 'Use `/help` for more information on Pluto',
				icon_url: undefined,
			},
			timestamp: published_at.toISOString(),
		})
	})

	it('leaves markdown-header titles unbolded', () => {
		const json = changelogEmbed(
			{ version: '1', title: '# Hi', content: 'c', published_at },
			'42',
		).toJSON()
		expect(json.description).toBe('# Hi\n\nc\n\nMade by <@42>')
	})
})
