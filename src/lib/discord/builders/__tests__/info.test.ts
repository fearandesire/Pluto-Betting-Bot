import { describe, expect, it } from 'vitest'
import { infoEmbed } from '../info.js'

describe('infoEmbed (classic, pre-migration)', () => {
	it('pins the current /help embed shape', () => {
		expect(
			infoEmbed({
				title: 'Pluto Documentation',
				description: 'desc',
				color: '#c8eefb',
				thumbnail: 'https://i.imgur.com/RWjfjyv.png',
				footer: 'foot',
			}).toJSON(),
		).toEqual({
			title: 'Pluto Documentation',
			description: 'desc',
			color: 0xc8eefb,
			thumbnail: { url: 'https://i.imgur.com/RWjfjyv.png' },
			footer: { text: 'foot', icon_url: undefined },
		})
	})

	it('adds the docs URL for /commands', () => {
		const json = infoEmbed({
			title: 't',
			description: 'd',
			color: '#000000',
			footer: 'f',
			url: 'https://docs.example',
		}).toJSON()
		expect(json.url).toBe('https://docs.example')
		expect(json.thumbnail).toBeUndefined()
	})
})
