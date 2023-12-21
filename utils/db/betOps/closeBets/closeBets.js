import _ from 'lodash'
import { AttachmentBuilder, EmbedBuilder } from 'discord.js'
import db from '@pluto-db'
import {
	BETSLIPS,
	LIVEBETS,
	CURRENCY,
} from '@pluto-core-config'

import { resolvePayouts } from '@pluto-betOps/resolvePayouts.js'
import { SapDiscClient } from '@pluto-core'
import logClr from '@pluto-internal-color-logger'
import PlutoLogger from '@pluto-logger'
import { getBalance } from '../../validation/getBalance.js'
import BetNotify from '../BetNotify.js'
import XPHandler from '../../../xp/XPHandler.js'
import embedColors from '../../../../lib/colorsConfig.js'

async function getBets(matchid, dbCnx) {
	return dbCnx.manyOrNone(
		`SELECT * FROM "${BETSLIPS}" WHERE matchid = $1 and betresult = 'pending'`,
		[matchid],
	)
}

/**
 * Selects the odds for a specific team in a match.
 *
 * @param {Object} matchData - The data of the match.
 * @param {string} team - The team to select odds for.
 * @return {Object} An object containing the odds for the team and the opposing team.
 */

async function selectOdds(matchData, team) {
	const { teamone, teamtwo, teamoneodds, teamtwoodds } =
		matchData
	// Match team to teamone or teamtwo and return odds for the match
	if (team === teamone) {
		return {
			odds: teamoneodds,
			opposingTeam: teamtwo,
		}
	}
	if (team === teamtwo) {
		return {
			odds: teamtwoodds,
			opposingTeam: teamone,
		}
	}
	await PlutoLogger.log({
		id: 4,
		description: `An error occured when closing bets.\nUnable to find matchup in database: ${teamone} vs ${teamtwo}`,
	})
	throw new Error(`Unable to process bets for ${team}`)
}

/**
 * Handle DB operation for closing a bet
 */

async function handleClosingBet(
	/**
	 * Handles the closing of a bet.
	 * @param {string} userid - The ID of the user placing the bet.
	 * @param {string} betResult - The result of the bet ("won" or "lost").
	 * @param {string} betId - The ID of the bet.
	 * @param {object} betInfo - Information about the bet.
	 * @param {number} betInfo.payoutAmount - The amount to be paid out if the bet is won.
	 * @param {number} betInfo.profitAmount - The profit amount of the bet.
	 */
	userid,
	betResult,
	betId,
	betInfo,
) {
	if (betResult === `won`) {
		const { payoutAmount, profitAmount } = betInfo
		await db.none(
			`UPDATE "${BETSLIPS}" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
			[payoutAmount, profitAmount, betId],
		)
		await db.none(
			`UPDATE "${CURRENCY}" SET balance = balance + $1 WHERE userid = $2`,
			[payoutAmount, userid],
		)
	} else if (betResult === `lost`) {
		await db.none(
			`UPDATE "${BETSLIPS}" SET betresult = 'lost' WHERE betid = $1`,
			[betId],
		)
	}
	await db.none(
		`DELETE FROM "${LIVEBETS}" WHERE betid = $1`,
		[betId],
	)
}

/**
 * Closes the bets for a given match result.
 *
 * @param {string} winningTeam - The team that won the match.
 * @param {string} losingTeam - The team that lost the match.
 * @param {Object} matchInfo - The match information (Odds, etc)
 * @return {boolean} Returns false if an error occurred, otherwise nothing is returned.
 */
async function closeBets(
	winningTeam,
	losingTeam,
	matchInfo,
	dbCnx,
) {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve) => {
		const betNotify = new BetNotify(SapDiscClient)
		;(async () => {
			try {
				if (!matchInfo || _.isEmpty(matchInfo)) {
					await PlutoLogger.log({
						id: 4,
						description: `An error occured when closing bets.\nUnable to find matchup in database: ${winningTeam} vs ${losingTeam}`,
					})
					return false
				}

				const bets = await getBets(
					matchInfo.matchid,
					dbCnx,
				)

				if (_.isEmpty(bets)) {
					return
				}

				for await (const betslip of bets) {
					const betAmount = betslip.amount
					const betId = betslip.betid
					const { userid: userId } = betslip

					const teamBetOn = betslip.teamid
					const { odds: betOdds, opposingTeam } =
						await selectOdds(
							matchInfo,
							teamBetOn,
						)

					let betResult

					if (teamBetOn === winningTeam) {
						betResult = 'won'
					} else if (teamBetOn === losingTeam) {
						betResult = 'lost'
					}

					if (betResult === 'won') {
						const { payout, profit } =
							await resolvePayouts(
								betOdds,
								betAmount,
							)
						const payoutAmount = Number(payout)
						const profitAmount = Number(profit)
						const oldBalance = await getBalance(
							userId,
						)
						await handleClosingBet(
							userId,
							betResult,
							betId,
							{
								payoutAmount,
								profitAmount,
							},
						)
						const updatedBalance =
							await getBalance(userId)
						await betNotify.notifyUser(userId, {
							betId,
							teamBetOn,
							opposingTeam,
							betAmount,
							payout,
							profit,
							currentBalance: updatedBalance,
							oldBalance,
							betResult,
						})
						// XP Handling
						const xpHandler = new XPHandler(
							userId,
						)
						const tierInfo =
							await xpHandler.handleBetXp({
								userId,
								isWin: true,
							})
						if (tierInfo.leveledUp === true) {
							const {
								tierImg,
								tier,
								userLevel,
							} = tierInfo
							const imageAttachment =
								new AttachmentBuilder(
									tierImg,
									{
										name: `${tier}.png`,
									},
								)
							// DM user that they leveled up
							const embed = new EmbedBuilder()
								.setTitle(`🔰 Level Up!`)
								.setDescription(
									`**You've reached level ${userLevel} 👏**\n**Current Tier: ${tier}**`,
								)
								.setThumbnail(
									`attachment://${tier}.png`,
								)
								.setColor(
									`${embedColors.Gold}`,
								)
								.setFooter({
									text: `XP Tiers have been fixed - You may have jumped a tier or two!`,
								})
							try {
								await SapDiscClient.users.send(
									this.userId,
									{
										embeds: [embed],
										files: [
											imageAttachment,
										],
									},
								)
							} catch (err) {
								console.error(err)
								return false
								// Failed to DM User, likely to privacy settings or blocked
							}
						}
					} else if (betResult === 'lost') {
						await handleClosingBet(
							userId,
							betResult,
							betId,
						)
						await betNotify.notifyUser(userId, {
							betId,
							teamBetOn,
							opposingTeam,
							betAmount,
							betResult,
						})
						// XP Handling
						const xpHandler = new XPHandler(
							userId,
						)
						const tierInfo =
							await xpHandler.handleBetXp({
								userId,
								isWin: true,
							})
						if (tierInfo.leveledUp === true) {
							const {
								tierImg,
								tier,
								userLevel,
							} = tierInfo
							const imageAttachment =
								new AttachmentBuilder(
									tierImg,
									{
										name: `${tier}.png`,
									},
								)
							// DM user that they leveled up
							const embed = new EmbedBuilder()
								.setTitle(`🔰 Level Up!`)
								.setDescription(
									`**You've reached level ${userLevel} 👏**\n**Current Tier: ${tier}**`,
								)
								.setThumbnail(
									`attachment://${tier}.png`,
								)
								.setColor(
									`${embedColors.Gold}`,
								)
								.setFooter({
									text: `XP Tiers have been fixed - You may have jumped a tier or two!`,
								})
							// Msg user
							try {
								await SapDiscClient.users.send(
									this.userId,
									{
										embeds: [embed],
										files: [
											imageAttachment,
										],
									},
								)
							} catch (err) {
								console.error(err)
								return false
								// Failed to DM User, likely to privacy settings or blocked
							}
						}
					}
				}
			} catch (err) {
				await logClr({
					text: `An error occured when closing bets.\nError: \`${err.message}\``,
					color: `red`,
					status: `error`,
				})
				await PlutoLogger.log({
					id: 4,
					description: `An error occured when closing bets.\nError: \`${err.message}\``,
				})
				console.error(err)
				return false
			}
		})().then(resolve)
	})
}

export { closeBets }
