/**
 * A rendered message as discord-preview's `fromBuilders` accepts it.
 * Builders (EmbedBuilder, ContainerBuilder, ActionRowBuilder) may be passed
 * as-is; the dump serializes anything with `toJSON()`.
 */
export type DumpMessage = {
	content?: string
	embeds?: readonly unknown[]
	components?: readonly unknown[]
	flags?: number
	/** attachment:// targets; url must be a data: URL so renders stay offline. */
	files?: { name: string; url: string }[]
}

/**
 * One migration surface (Appendix A ID). `before` renders today's classic
 * message; `after` is added by the cluster PR that migrates it.
 */
export type Surface = {
	id: string
	name: string
	before?: () => DumpMessage | Promise<DumpMessage>
	after?: () => DumpMessage | Promise<DumpMessage>
}

export type ClusterFixtures = {
	/** Folder name under docs/components-v2/screens/ */
	cluster: string
	surfaces: Surface[]
}

/** Deterministic values every fixture uses. */
export const FIXED = {
	now: new Date('2026-10-04T19:30:00Z'),
	userId: '100000000000000001',
	username: 'Pluto Tester',
	guildId: '200000000000000002',
	channelId: '300000000000000003',
	/** 1×1 transparent PNG */
	pngDataUrl:
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
} as const

/**
 * Remote image URL → file in fixtures/images/. The dump replaces these with
 * data URLs; any other http(s) image URL fails the dump so it gets added here.
 */
export const IMAGE_CACHE: Record<string, string> = {
	'https://i.imgur.com/RWjfjyv.png': 'imgur-RWjfjyv.png',
	'https://i.imgur.com/qG3Mm5t.png': 'imgur-qG3Mm5t.png',
	'https://cdn.discordapp.com/embed/avatars/0.png': 'discord-avatar-0.png',
	'https://cdn.discordapp.com/icons/200000000000000002/0b1c2d3e4f.jpg':
		'discord-guild-icon.png',
}
