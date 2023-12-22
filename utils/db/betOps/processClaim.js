import discord from 'discord.js'
import {
	fromUnixTime,
	getUnixTime,
	isAfter,
	parseISO,
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

async function checkCooldown(lastClaimTime) {
	const lastClaim = await getUnixTime(
		fromUnixTime(lastClaimTime),
	)
	const rightNow = await getUnixTime(new Date())
	const rightNowISO = await parseISO(
		await formatTime(rightNow),
	)
	const lastClaimISO = await parseISO(
		await formatTime(lastClaim),
	)
	const cooldown = addHours(lastClaimISO, 24)
	return isAfter(rightNowISO, cooldown)
}

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

		if (
			user.lastclaimtime === null ||
			(await checkCooldown(user.lastclaimtime))
		) {
			const newBalance =
				Number(user.balance || 0) + 20
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
			await interaction.followUp({ embeds: [embed] })
		} else {
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
				await interaction.followUp({
					content: `You are on cooldown! You can collect your daily $20 again in **${timeLeft}**`,
					ephemeral: true,
				})
			}
		}
	} catch (error) {
		console.error(error)
		return QuickError(
			interaction,
			`Something went wrong when processing your daily claim.`,
		)
	}
}
