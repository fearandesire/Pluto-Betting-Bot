import discord from 'discord.js'
import {
	fromUnixTime,
	getUnixTime,
	isAfter,
	isBefore,
	addHours,
	formatDistanceStrict,
} from 'date-fns'
import db from '@pluto-db'
import { CURRENCY } from '@pluto-core-config'
import { QuickError } from '@pluto-embed-reply'
import { convertColor } from '../../bot_res/embeds/embedReply.js'
import embedColors from '../../../lib/colorsConfig.js'

const { EmbedBuilder } = discord

async function formatTime(unixTime) {
	return new Date(fromUnixTime(unixTime))
}

/**
 * Check if the cooldown period has passed for the user.
 * @param {number} lastClaimTime - The Unix timestamp of the last claim.
 * @returns {boolean} - True if cooldown has passed, false otherwise.
 */
async function checkCooldown(lastClaimTime) {
	// Convert the Unix timestamp to a Date object
	const lastClaimDate = fromUnixTime(lastClaimTime)

	// Add 24 hours to the last claim date to get the end of the cooldown
	const cooldownEnd = addHours(lastClaimDate, 24)

	// Check if the current time is after the cooldown end
	return isBefore(new Date(), cooldownEnd)
}

export default checkCooldown

async function updateUserBalance(
	userId,
	balance,
	transaction,
) {
	const rightNow = await getUnixTime(new Date())
	await transaction.any(
		`UPDATE "${CURRENCY}" SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *`,
		[rightNow, balance, userId],
	)
}

function createEmbed(title, description, color) {
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor(convertColor(color))
}

export async function processClaim(
	inputUserId,
	interaction,
) {
	try {
		const user = await db.oneOrNone(
			`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
			[inputUserId],
		)

		if (!user) return false

		const cooldownStatus = await checkCooldown(
			user.lastclaimtime,
		)
		if (
			user.lastclaimtime === null ||
			!cooldownStatus
		) {
			const newBalance = Math.round(
				Number(user.balance || 0) + 20,
			)

			await updateUserBalance(
				inputUserId,
				newBalance,
				db,
			)
			const embed = createEmbed(
				'Daily Claim',
				`You have claimed your daily $20.\nYou can use this command again in 24 hours.\nYour new balance: $${newBalance}`,
				embedColors.PlutoBrightGreen,
			)
			return interaction.followUp({ embeds: [embed] })
		}
		const rightNow = new Date()
		const lastClaimTime = await formatTime(
			user.lastclaimtime,
		)
		const cooldownEnd = addHours(lastClaimTime, 24)
		if (rightNow < cooldownEnd) {
			const timeLeft = formatDistanceStrict(
				cooldownEnd,
				rightNow,
			)
			return interaction.followUp({
				content: `You are on cooldown! You can collect your daily $20 again in **${timeLeft}**`,
				ephemeral: true,
			})
		}
	} catch (error) {
		console.error(error)
		return QuickError(
			interaction,
			`Something went wrong when processing your daily claim.`,
		)
	}
}
