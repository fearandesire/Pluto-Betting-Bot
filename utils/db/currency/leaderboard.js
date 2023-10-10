import Promise from 'bluebird'
import { EmbedBuilder } from 'discord.js'
import { SapDiscClient } from '#main'
import { reqLeaderboard } from './reqLeaderboard.js'

/**
 * Retrieve the data from the currency/profile table in the DB - sort by the highest values to the lowest.
 * @param {message} interaction - The Discord interaction object
 * @returns {object} - Returns an embed containing the leaderboard information with user tags and their balances.
 */

// Use a Map to store memberCache instead of reassigning it
const memberCache = new Map()

export async function leaderboard(interaction) {
	const lb = await reqLeaderboard()
	const server = SapDiscClient.guilds.cache.get(
		`${process.env.server_ID}`,
	)
	const interactionUserId = interaction?.user?.id

	const lbArray = []
	let usersIndex = 0

	// Pre-fetch all members at once
	const lbUserIds = lb.map((lbEntry) => lbEntry.userid)
	const lbMembers = await server.members.fetch({
		user: lbUserIds,
	})

	for await (const lbEntry of lb) {
		const lbUserId = lbEntry.userid
		const lbUserBal = lbEntry.balance

		if (lbUserId === interactionUserId) {
			usersIndex = lb.indexOf(lbEntry) + 1
		}

		const member = lbMembers.get(lbUserId)
		if (member) {
			await memberCache.set(lbUserId, member)
		}

		const mappedUserCache =
			(await memberCache.get(lbUserId)) || null
		const formatId =
			mappedUserCache?.user?.tag || `<@${lbUserId}>`

		const humanIndex = lb.indexOf(lbEntry) + 1
		const formattedEntry = `**${humanIndex}.** ${formatId}: **\`$${lbUserBal}\`**`
		lbArray.push(formattedEntry)
	}

	const lbString = lbArray.join('\n')
	const lbLength = lbString.length

	if (lbLength === 0) {
		return false
	}

	// Define the number of users to display per page
	const usersPerPage = 20

	// Calculate the total number of pages based on the number of users
	const pages = Math.ceil(lbArray.length / usersPerPage)

	// Initial page
	let currentPage = 1

	// Function to generate the leaderboard string for a specific page
	function generateLeaderboardPage(page) {
		const startIndex = (page - 1) * usersPerPage
		const endIndex = startIndex + usersPerPage
		return lbArray
			.slice(startIndex, endIndex)
			.join('\n')
	}

	const embColor = 16760832 // #ffc000
	const embObj = {
		title: `💹 Betting Leaderboard | Page ${currentPage}`,
		description: generateLeaderboardPage(currentPage),
		color: embColor,
		footer: {
			text: `You're #${usersIndex} on the Leaderboard! | Pg. ${currentPage}`,
		},
	}

	const embed = new EmbedBuilder()
		.setTitle(embObj.title)
		.setDescription(embObj.description)
		.setColor(embColor)
		.setFooter(embObj.footer) // Pass the object directly

	const msg = await interaction.followUp({
		embeds: [embed],
	})

	// Define reaction emojis
	const emojis = ['⬅️', '➡️']

	// Add reactions to the message
	await Promise.all(
		emojis.map((emoji) => msg.react(emoji)),
	)

	// Create a filter to listen for reactions
	const filter = (reaction, user) =>
		emojis.includes(reaction.emoji.name) &&
		user.id === interactionUserId

	// Create a collector for reactions
	const collector = msg.createReactionCollector(filter)

	collector.on('collect', async (reaction) => {
		if (
			reaction.emoji.name === '⬅️' &&
			currentPage > 1
		) {
			// Move to the previous page
			currentPage -= 1
		} else if (
			reaction.emoji.name === '➡️' &&
			currentPage < pages
		) {
			// Move to the next page
			currentPage += 1
		}

		// Update the embed with the new page
		embObj.title = `Betting Leaderboard | Page ${currentPage}`
		embObj.description =
			generateLeaderboardPage(currentPage)
		embObj.footer = {
			text: `You are currently #${usersIndex} on the Leaderboard! | Page ${currentPage}`,
		}

		// Edit the message to update the embed
		await msg.edit({ embeds: [embObj] })

		// Remove the user's reaction
		await reaction.users.remove(interaction.user)
	})

	collector.on('end', () => {
		// Remove all reactions when the collector ends
		msg.reactions.removeAll()
	})

	return true
}
