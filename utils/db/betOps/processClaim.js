// import { updateclaim } from './addClaimTime.js';
import discord from 'discord.js'
import {
	addHours,
	format,
	formatDistanceStrict,
	fromUnixTime,
	getUnixTime,
	isAfter,
	parseISO,
} from 'date-fns'

import { db } from '#db'
import { CURRENCY } from '#config'
import PlutoLogger from '#PlutoLogger'
import { convertColor } from '../../bot_res/embeds/embedReply.js'
import embedColors from '../../../lib/colorsConfig.js'

const { EmbedBuilder } = discord

export async function processClaim(
	inputuserid,
	interaction,
) {
	const today = new Date()
	// # Convert the current time & last claim time to unix
	const rightNow = await getUnixTime(fromUnixTime(today))
	let embObj
	db.tx('processClaim-Transaction', async (t) => {
		// ? Search for user via their Discord ID in the database
		const findUser = await t.oneOrNone(
			`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
			[inputuserid],
		) //
		if (!findUser) {
			return false
		}
		// ? User exists in the DB, but has never used the claim command.
		// ? Therefor we process the claim request (add 20 dollars to user's balance & save current time to lastclaimtime cell)
		if (findUser.lastclaimtime === null) {
			const updatedBalance =
				Number(findUser.balance) + 20
			await t.any(
				`UPDATE "${CURRENCY}" SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *`,
				[rightNow, updatedBalance, inputuserid],
			)
			embObj = {
				title: 'Daily Claim',
				description: `Welcome to Pluto! You have claimed your daily $20.\nYou can use this command again in 24 hours.\nYour new balance: $${updatedBalance}`,
				color: convertColor(
					embedColors.PlutoBrightGreen,
				),
			}
			await interaction.reply({ embeds: [embObj] })
		}

		// ? Use Case: User has claimed at least once prior to now
		// ? Now we need to determine if the user is on cooldown.
		if (
			findUser.userid === inputuserid &&
			findUser.lastclaimtime !== null
		) {
			const lastClaim = await getUnixTime(
				fromUnixTime(findUser.lastclaimtime),
			)
			// # Format the current time & last claim time
			const formatRightNow = await format(
				rightNow,
				'yyyy-MM-dd HH:mm:ss',
			)
			const formatLastClaim = await format(
				lastClaim,
				'yyyy-MM-dd HH:mm:ss',
			)
			// # Parse the times to ISO to get the difference in hours
			const rightNowISO = await parseISO(
				formatRightNow,
			)
			const lastClaimISO = await parseISO(
				formatLastClaim,
			)
			// # add 24 hours to the last claim time
			const cooldown = addHours(lastClaimISO, 24)
			const passedCooldown = await isAfter(
				rightNowISO,
				cooldown,
			)
			if (passedCooldown === false) {
				const timeLeft = await formatDistanceStrict(
					rightNowISO,
					cooldown,
				)
				await interaction.reply({
					content: `You are on cooldown! You can collect your daily $20 again in **${timeLeft}**`,
					ephemeral: true,
				})
			} else {
				const currentBalance = findUser.balance
				const balance =
					Number(currentBalance) + Number(20)
				await t.any(
					`UPDATE "${CURRENCY}" SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *`,
					[rightNow, balance, inputuserid],
				)
				const cEmb = {
					title: 'Daily Claim',
					description: `Welcome back! You have claimed your daily $20.\nYou can use this command again in 24 hours.\nYour new balance is: **$${balance}**.`,
				}
				const claimedEmb = new EmbedBuilder()
					.setTitle('Daily Claim')
					.setDescription(cEmb.description)
					.setColor(
						convertColor(
							embedColors.PlutoBrightGreen,
						),
					)
				await interaction.reply({
					embeds: [claimedEmb],
					ephemeral: true,
				})
			}
		}
	}).catch(async (error) => {
		await PlutoLogger.log({
			id: 4,
			description: `Error occured when processing claim for => \`${inputuserid}\`\nError: =>\`${
				error?.message || error
			}\``,
		})
	})
}
