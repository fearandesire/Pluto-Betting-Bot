import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn() },
}))

import {
	DEFAULT_GAME_CHANNEL_TOPIC,
	gameChannelTopic,
} from '../game-channel-topic.js'

const topic = (gameChannelTopic_: string | null | undefined) =>
	gameChannelTopic({ guildId: 'guild', gameChannelTopic: gameChannelTopic_ })

describe('game channel topic', () => {
	it('defaults to a friendly message', () => {
		expect(DEFAULT_GAME_CHANNEL_TOPIC).toBe('Enjoy the game!')
		expect(topic(undefined)).toBe('Enjoy the game!')
		expect(topic(null)).toBe('Enjoy the game!')
		expect(topic('   ')).toBe('Enjoy the game!')
	})

	it("uses the guild's configured text", () => {
		expect(topic('  Talk the game here  ')).toBe('Talk the game here')
	})

	it.each([
		'pluto-game:6f42878d1a792f6d810fd55e',
		'pluto-game:abc | pluto-presentation:v2:unsent',
		'x'.repeat(1025),
	])('never shows internal state or an invalid topic: %s', (value) => {
		expect(topic(value)).toBe('Enjoy the game!')
	})
})
