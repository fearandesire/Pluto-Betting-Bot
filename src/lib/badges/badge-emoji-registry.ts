import { BADGE_EMOJI_NAMES } from './badge-presentation.js'

const SNOWFLAKE = /^\d{17,20}$/

export interface EmojiItem {
	name: string | null
	id: string
}

export interface BadgeEmojiRegistry {
	format(emojiName: string): string | null
	/** CDN image of the emoji, for a section thumbnail. */
	url(emojiName: string): string | null
	readonly size: number
}

export const EMPTY_BADGE_EMOJI_REGISTRY: BadgeEmojiRegistry = {
	format: () => null,
	url: () => null,
	size: 0,
}

export function buildBadgeEmojiRegistry(
	items: Iterable<EmojiItem>,
): BadgeEmojiRegistry {
	const ids = new Map<string, string>()
	for (const { name, id } of items) {
		if (name && BADGE_EMOJI_NAMES.has(name) && SNOWFLAKE.test(id))
			ids.set(name, id)
	}
	return {
		format: (emojiName) => {
			const id = ids.get(emojiName)
			return id ? `<:${emojiName}:${id}>` : null
		},
		url: (emojiName) => {
			const id = ids.get(emojiName)
			return id
				? `https://cdn.discordapp.com/emojis/${id}.png?size=128`
				: null
		},
		size: ids.size,
	}
}

export const BADGE_EMOJI_REFRESH_MS = 6 * 60 * 60 * 1000

/** Ids come from the running application's own inventory, so dev and prod bots each resolve theirs. */
export class BadgeEmojiService {
	private registry = EMPTY_BADGE_EMOJI_REGISTRY
	private timer: NodeJS.Timeout | undefined

	constructor(
		private readonly fetchEmojis: () => Promise<Iterable<EmojiItem>>,
		private readonly onError: (error: unknown) => void = () => undefined,
	) {}

	get current(): BadgeEmojiRegistry {
		return this.registry
	}

	async refresh(): Promise<void> {
		try {
			this.registry = buildBadgeEmojiRegistry(await this.fetchEmojis())
		} catch (error) {
			this.onError(error)
		}
	}

	async start(): Promise<void> {
		if (this.timer) return
		this.timer = setInterval(
			() => void this.refresh(),
			BADGE_EMOJI_REFRESH_MS,
		)
		this.timer.unref()
		await this.refresh()
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = undefined
	}
}

let service: BadgeEmojiService | undefined

export const getBadgeEmojiRegistry = (): BadgeEmojiRegistry =>
	service?.current ?? EMPTY_BADGE_EMOJI_REGISTRY

export async function startBadgeEmojiRegistry(opts: {
	enabled: boolean
	fetchEmojis: () => Promise<Iterable<EmojiItem>>
	onError?: (error: unknown) => void
}): Promise<void> {
	if (!opts.enabled || service) return
	service = new BadgeEmojiService(opts.fetchEmojis, opts.onError)
	await service.start()
}

export function resetBadgeEmojiRegistry(): void {
	service?.stop()
	service = undefined
}
