export interface GameChannelCandidate {
	id: string
	name: string
	parentId?: string | null
	topic?: string | null
}

export interface GameChannelLookupIntent {
	channelName: string
	marker: string
}

export function findExistingGameChannel<T extends GameChannelCandidate>(
	channels: Iterable<T>,
	intent: GameChannelLookupIntent,
	gameCategoryId: string,
): T | null {
	const candidates = [...channels]
	const marked = candidates.find(
		(candidate) => candidate.topic === intent.marker,
	)
	if (marked) return marked

	return (
		candidates.find(
			(candidate) =>
				candidate.parentId === gameCategoryId &&
				!candidate.topic?.includes('pluto-game:') &&
				candidate.name.toLowerCase() ===
					intent.channelName.toLowerCase(),
		) ?? null
	)
}
