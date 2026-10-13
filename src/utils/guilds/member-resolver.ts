import type { Guild, GuildMember } from 'discord.js'

export const LEADERBOARD_MEMBER_LOOKUP_LIMIT = 50
const MEMBER_LOOKUP_CONCURRENCY = 4

/** Single-ID fetch uses REST; fetching an ID array requests privileged gateway chunks. */
export async function resolveLeaderboardMembers(
	guild: Guild,
	userIds: string[],
) {
	const members = new Map<string, GuildMember>()
	const missing: string[] = []
	for (const id of new Set(userIds)) {
		const cached = guild.members.cache.get(id)
		if (cached) members.set(id, cached)
		else if (missing.length < LEADERBOARD_MEMBER_LOOKUP_LIMIT)
			missing.push(id)
	}
	for (
		let offset = 0;
		offset < missing.length;
		offset += MEMBER_LOOKUP_CONCURRENCY
	) {
		await Promise.all(
			missing
				.slice(offset, offset + MEMBER_LOOKUP_CONCURRENCY)
				.map(async (id) => {
					const member = await guild.members
						.fetch(id)
						.catch(() => null)
					if (member) members.set(id, member)
				}),
		)
	}
	return members
}
