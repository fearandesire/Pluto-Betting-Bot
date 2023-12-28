import db from '@pluto-db'
import {
	QuickError,
	accounting,
	BETSLIPS,
} from '@pluto-core-config'

import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'

/**
 * Fetch history of a users bets from the db table in the DB.
 * @param {object} interaction - The Discord Object message object
 * @param {integer} userid - The user id of the user who's bet history is being requested.
 * @return {object} - Embed object of user bet history
 */

export async function fetchBetHistory(interaction, userid) {
	const entriesPerPage = 10 // Number of entries per page

	// Function to generate a single page of bet history
	async function generateBetHistoryPage(page) {
		const offset = (page - 1) * entriesPerPage
		const findings = await db.manyOrNone(
			`SELECT * FROM "${BETSLIPS}" WHERE userid = $1 AND betresult <> 'pending' ORDER BY dateofbet LIMIT $2 OFFSET $3`,
			[userid, entriesPerPage, offset],
		)

		if (!findings || findings.length === 0) {
			return {
				betHistory: [],
				totalPages: 0,
				currentPage: page,
			}
		}

		const totalEntries = await db.one(
			`SELECT COUNT(*) FROM "${BETSLIPS}" WHERE userid = $1 AND betresult <> 'pending'`,
			[userid],
		)

		let wonCount = 0
		let lostCount = 0
		const betHistory = findings.map((entry) => {
			const amount = accounting.format(entry.amount)
			const profit = accounting.format(entry.profit)
			const payout = accounting.format(entry.payout)

			if (entry.betresult === 'won') {
				wonCount += 1
				return {
					name: `:white_check_mark: ${entry.dateofbet} `,
					value: `**Team:** ${entry.teamid}\n**Bet:** \`${amount}\`\n**Profit:** \`$${profit}\` | **Payout:** \`$${payout}\``,
					inline: true,
				}
			}
			if (entry.betresult === 'lost') {
				lostCount += 1
				return {
					name: `:x: ${entry.dateofbet}`,
					value: `**Team:** ${entry.teamid}\n**Bet:** \`$${amount}\``,
					inline: true,
				}
			}
			return null
		})

		return {
			betHistory,
			totalPages: Math.ceil(
				Number(totalEntries.count) / entriesPerPage,
			),
			currentPage: page,
		}
	}

	// Fetch the initial page
	const initialPageData = await generateBetHistoryPage(1)
	if (initialPageData.totalPages === 0) {
		QuickError(
			interaction,
			'You have no betting history to view.',
		)
		return
	}

	let currentPage = 1 // Moved currentPage outside the collector

	// Create the initial embed
	const embed = new EmbedBuilder()
		.setTitle(
			`${interaction.user.username}'s Bet History | Page 1`,
		)
		.setColor(embedColors.PlutoBrightGreen)
		.addFields(initialPageData.betHistory)
		.setFooter({
			text: `Page 1 of ${initialPageData.totalPages}`,
		})

	const msg = await interaction.followUp({
		embeds: [embed],
	})

	// Define reaction emojis for navigation
	const emojis = ['⬅️', '➡️']

	// Add reactions to the message
	for (const emoji of emojis) {
		await msg.react(emoji)
	}

	// Create a filter to listen for reactions from the interaction user
	const filter = (reaction, user) =>
		emojis.includes(reaction.emoji.name) &&
		user.id === interaction.user.id

	// Create a collector for reactions
	const collector = msg.createReactionCollector({
		filter,
		time: 60000,
	}) // 60 seconds timeout

	collector.on('collect', async (reaction, user) => {
		if (
			reaction.emoji.name === '⬅️' &&
			currentPage > 1
		) {
			currentPage -= 1
		} else if (
			reaction.emoji.name === '➡️' &&
			currentPage < initialPageData.totalPages
		) {
			currentPage += 1
		} else {
			return
		}

		const newPageData = await generateBetHistoryPage(
			currentPage,
		)

		const newEmbed = new EmbedBuilder()
			.setTitle(
				`${interaction.user.username}'s Bet History | Page ${currentPage}`,
			)
			.setColor(embedColors.PlutoBrightGreen)
			.addFields(newPageData.betHistory)
			.setFooter({
				text: `Page ${currentPage} of ${newPageData.totalPages}`,
			})

		await msg.edit({ embeds: [newEmbed] })

		// Remove the user's reaction
		await reaction.users.remove(user)
	})

	collector.on('end', () => {
		msg.reactions
			.removeAll()
			.catch((error) =>
				console.error(
					'Failed to clear reactions: ',
					error,
				),
			)
	})

	return true
}
