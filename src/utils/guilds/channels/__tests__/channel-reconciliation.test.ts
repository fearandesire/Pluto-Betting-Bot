import { describe, expect, it } from 'vitest'
import {
	findExistingGameChannel,
	type GameChannelCandidate,
} from '../channel-reconciliation.js'

describe('game channel reconciliation', () => {
	it('creates two same-name game channels for consecutive game intents', () => {
		const channels: GameChannelCandidate[] = []
		const categoryId = 'category-1'
		const channelName = 'away-at-home'
		const intents = [
			{ channelName, marker: 'pluto-game:game-1' },
			{ channelName, marker: 'pluto-game:game-2' },
		]

		for (const intent of intents) {
			const existing = findExistingGameChannel(
				channels,
				intent,
				categoryId,
			)
			if (!existing) {
				channels.push({
					id: `channel-${channels.length + 1}`,
					name: intent.channelName,
					parentId: categoryId,
					topic: intent.marker,
				})
			}
		}

		expect(channels).toHaveLength(2)
	})

	it('does not use another game marker as a same-name fallback', () => {
		const previousGame = {
			id: 'channel-1',
			name: 'away-at-home',
			parentId: 'category-1',
			topic: 'pluto-game:game-1',
		}

		expect(
			findExistingGameChannel(
				[previousGame],
				{ channelName: 'away-at-home', marker: 'pluto-game:game-2' },
				'category-1',
			),
		).toBeNull()
	})
})
