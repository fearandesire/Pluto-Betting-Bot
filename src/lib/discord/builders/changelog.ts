import type { Changelog } from '@pluto-khronos/api-client'
import { EmbedBuilder } from 'discord.js'
import embedColors from '../../colorsConfig.js'

/** Classic embed for /changelog (surface G3). */
export function changelogEmbed(
	changelog: Pick<
		Changelog,
		'version' | 'title' | 'content' | 'published_at'
	>,
	ownerId: string,
) {
	const publishedTimestamp = Math.floor(
		changelog.published_at.getTime() / 1000,
	)

	// Process content to ensure escaped newlines become actual newlines
	const processedContent = changelog.content.replace(/\\n/g, '\n')
	// Title may contain markdown headers, so don't wrap in bold if it starts with #
	const processedTitle = changelog.title.startsWith('#')
		? changelog.title.replace(/\\n/g, '\n')
		: `**${changelog.title.replace(/\\n/g, '\n')}**`

	return new EmbedBuilder()
		.setTitle(`Pluto Update v${changelog.version}`)
		.setDescription(
			`${processedTitle}\n\n${processedContent}\n\nMade by <@${ownerId}>`,
		)
		.setColor(embedColors.PlutoBlue)
		.addFields({
			name: '📅 Published',
			value: `<t:${publishedTimestamp}:R>`,
			inline: true,
		})
		.addFields({
			name: 'Docs',
			value: 'https://docs.pluto.fearandesire.com',
		})
		.setFooter({
			text: 'Use `/help` for more information on Pluto',
		})
		.setTimestamp(changelog.published_at)
}
