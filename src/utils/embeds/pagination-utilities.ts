import { CommandInteraction, EmbedBuilder, User } from 'discord.js'

export default class PaginationUtilities {
	paginateArray<T>(array: T[], page: number, pageSize: number): T[] {
		const start = (page - 1) * pageSize
		const end = start + pageSize
		return array.slice(start, end)
	}

	async displayLeaderboardPage(
		interaction: CommandInteraction,
		formattedLbData: any[],
		currentPage: number,
	): Promise<void> {
		console.debug({
			formattedLbData,
		})
		const usersPerPage = 10 // Customize this value as needed
		const paginationUtilities = new PaginationUtilities()
		const pagesTotal = Math.ceil(formattedLbData.length / usersPerPage)

		if (currentPage < 1 || currentPage > pagesTotal) {
			throw new Error('Invalid page number')
		}

		const pageData = paginationUtilities.paginateArray(
			formattedLbData,
			currentPage,
			usersPerPage,
		)

		let description = pageData
			.map((entry, index) => {
				const position = (currentPage - 1) * usersPerPage + index + 1
				return `**${position}.** ${entry.memberTag}: **\`$${entry.balance}\`**`
			})
			.join('\n')

		if (!description) description = 'No entries to display.'

		const embed = new EmbedBuilder()
			.setTitle(`Leaderboard | Page ${currentPage} of ${pagesTotal}`)
			.setDescription(description)
			.setColor(0xffac33) // Customizable
			.setFooter({ text: `Page ${currentPage} of ${pagesTotal}` })

		const message = await interaction.followUp({
			embeds: [embed],
			fetchReply: true,
		})

		// If only one page, no need to add pagination
		if (pagesTotal <= 1) return

		const emojis = ['⬅️', '➡️']
		await Promise.all(emojis.map((emoji) => message.react(emoji)))

		const filter = (reaction: any, user: User) =>
			emojis.includes(reaction.emoji.name) &&
			user.id === interaction.user.id
		const collector = message.createReactionCollector({
			filter,
			time: 60000,
		})

		collector.on('collect', async (reaction: any, user: User) => {
			if (reaction.emoji.name === '⬅️' && currentPage > 1) {
				currentPage--
			} else if (
				reaction.emoji.name === '➡️' &&
				currentPage < pagesTotal
			) {
				currentPage++
			} else {
				return
			}

			// Generate and edit message with new leaderboard page
			const newPageData = paginationUtilities.paginateArray(
				formattedLbData,
				currentPage,
				usersPerPage,
			)
			const newDescription = newPageData
				.map((entry, index) => {
					const position =
						(currentPage - 1) * usersPerPage + index + 1
					return `**${position}.** ${entry.memberTag}: **\`$${entry.balance}\`**`
				})
				.join('\n')
			const newEmbed = new EmbedBuilder()
				.setTitle(`Leaderboard | Page ${currentPage} of ${pagesTotal}`)
				.setDescription(newDescription)
				.setColor(0xffac33) // Customizable
				.setFooter({ text: `Page ${currentPage} of ${pagesTotal}` })
			await message.edit({ embeds: [newEmbed] })
			// Remove user's reaction to prevent rate limiting
			await reaction.users.remove(user.id)
		})
		collector.on('end', () => message.reactions.removeAll())
	}
}
