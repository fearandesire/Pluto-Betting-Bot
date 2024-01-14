/* eslint-disable no-await-in-loop */
import PlutoLogger from '@pluto-logger'
import {
	BETSLIPS,
	CURRENCY,
	LIVEBETS,
} from '@pluto-server-config'
import { AttachmentBuilder, EmbedBuilder } from 'discord.js'
import { Log } from '@pluto-internal-logger'
import { SapDiscClient } from '@pluto-core'
import { resolvePayouts } from './resolvePayouts.js'
import BetNotify from './BetNotify.js'
import { getBalance } from '../validation/getBalance.js'
import XPHandler from '../../xp/XPHandler.js'
import embedColors from '../../../lib/colorsConfig.js'

export default class BetProcessor {
	constructor(dbTrans) {
		this.dbTrans = dbTrans
	}

	async closeBets(winningTeam, losingTeam, matchInfo) {
		try {
			// Log and validation logic here

			const bets = await this.getBets(matchInfo.id)
			const stringifiedBets = JSON.stringify(
				bets,
				null,
				4,
			)
			await Log.Blue(
				`Bets for match: ${matchInfo.id}: ${stringifiedBets}`,
			)
			for (const betslip of bets) {
				await this.processBet(
					betslip,
					winningTeam,
					losingTeam,
					matchInfo,
				)
			}
		} catch (err) {
			await PlutoLogger.log({
				id: 4,
				description: `An error occured when closing bets.\n${err.message}`,
			})
			console.error(err)
			throw err
		}
	}

	async processBet(
		betslip,
		winningTeam,
		losingTeam,
		matchInfo,
	) {
		try {
			await Log.Magenta(
				`Processing bet for Bet ID: ${
					betslip.betid
				}\n\nMatch Info: ${JSON.stringify(
					matchInfo,
					null,
					4,
				)}`,
			)
			const betResult = await this.determineBetResult(
				betslip.teamid,
				winningTeam,
				losingTeam,
			)
			const oddsForBet = await this.selectOdds(
				matchInfo,
				betslip.teamid,
			)
			await Log.Blue(
				`Amount: ${
					betslip.amount
				}\nOdds for bet: ${JSON.stringify(
					oddsForBet,
				)}\nBet Result: ${betResult}`,
			)
			const { odds } = oddsForBet
			const payoutData = await this.getPayoutData(
				odds,
				betslip.amount,
			)
			const oldBalance = await getBalance(
				betslip.userid,
			)

			await this.updateBetResult(
				betslip,
				betResult,
				payoutData,
			)
			await this.updateUserBalance(
				betslip,
				betResult,
				payoutData,
			)
			await this.cleanUpBet(betslip)
			const newBalance = await getBalance(
				betslip.userid,
			)
			await this.notifyBetResult(
				betslip,
				betResult,
				{ currentBalance: newBalance, oldBalance },
				payoutData,
			)
			await this.handleUserXP(
				betslip.userid,
				betResult === 'won',
			)
		} catch (err) {
			console.error(
				`Error processing bet: ${err.message}`,
			)
			throw err
		}
	}

	/**
	 * Selects the odds for a specific team in a match.
	 *
	 * @param {Object} matchData - The data of the match containing team names and their odds.
	 * @param {string} team - The team to select odds for.
	 * @return {Object|null} An object containing the odds for the team and the opposing team, or null if team not found.
	 *
	 * `{ odds: number, opposingTeam: string }`
	 */
	async selectOdds(matchupData, team) {
		const {
			teamone,
			teamtwo,
			teamoneodds,
			teamtwoodds,
		} = matchupData
		await Log.Yellow(
			`Selecting odds for ${team}\nMatchup Data:\n${JSON.stringify(
				matchupData,
				null,
				4,
			)}`,
		)
		// Mapping teams to their odds and opponents
		const oddsMapping = {
			[teamone]: {
				odds: teamoneodds,
				opposingTeam: teamtwo,
			},
			[teamtwo]: {
				odds: teamtwoodds,
				opposingTeam: teamone,
			},
		}

		// Selecting odds based on the team
		const selectedOdds = oddsMapping[team]

		if (!selectedOdds) {
			throw new Error(
				`Unable to resolve odds for ${team} when closing a bet.`,
			)
		}

		return selectedOdds
	}

	/**
	 * @returns {object} `{ payout: number, profit: number}`
	 */
	async getPayoutData(oddsForBet, betAmount) {
		return resolvePayouts(oddsForBet, betAmount)
	}

	determineBetResult(teamBetOn, winningTeam, losingTeam) {
		// Bet result determination logic
		if (teamBetOn === winningTeam) {
			return 'won'
		}
		if (teamBetOn === losingTeam) {
			return 'lost'
		}
	}

	async updateBetResult(betslip, betResult, payoutData) {
		console.log(
			`Updating bet result for betslip: ${betslip.betid}`,
		)
		if (betResult === 'won') {
			await this.dbTrans.none(
				`UPDATE "${BETSLIPS}" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
				[
					payoutData.payout,
					payoutData.profit,
					betslip.betid,
				],
			)
		} else if (betResult === 'lost') {
			await this.dbTrans.none(
				`UPDATE "${BETSLIPS}" SET betresult = 'lost', payout = 0, profit = 0 WHERE betid = $1`,
				[betslip.betid],
			)
		}
	}

	async updateUserBalance(
		betslip,
		betResult,
		payoutData,
	) {
		console.log(
			`Updating user balance for user: ${betslip.userid}`,
		)
		if (betResult === 'won') {
			// Ensure the user has not already been paid
			await this.dbTrans.none(
				`UPDATE "${CURRENCY}" SET balance = balance + $1 WHERE userid = $2`,
				[payoutData.payout, betslip.userid],
			)
		}
		// Note: Balance update logic for a lost bet (if any) would go here
	}

	async cleanUpBet(betslip) {
		console.log(
			`Cleaning up bet for betslip: ${betslip.betid}`,
		)
		await this.dbTrans.none(
			`DELETE FROM "${LIVEBETS}" WHERE betid = $1`,
			[betslip.betid],
		)
	}

	async handleBetResult(betslip, payoutData = null) {
		const { userid, betId, betResult } = betslip
		if (betResult === `won`) {
			const { payout, profit } = payoutData
			await this.dbTrans.none(
				`UPDATE "${BETSLIPS}" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
				[payout, profit, betId],
			)
			return this.dbTrans.none(
				`UPDATE "${CURRENCY}" SET balance = balance + $1 WHERE userid = $2`,
				[payout, userid],
			)
		}
		if (betResult === `lost`) {
			await this.dbTrans.none(
				`UPDATE "${BETSLIPS}" SET betresult = 'lost' WHERE betid = $1`,
				[betId],
			)
		}
		return this.dbTrans.none(
			`DELETE FROM "${LIVEBETS}" WHERE betid = $1`,
			[betId],
		)
	}

	async notifyBetResult(
		betslip,
		betResult,
		balanceChanges = null,
		payoutData = null,
	) {
		console.log(
			`Notifying user about bet result for user: ${betslip.userid}`,
		)
		const betNotify = new BetNotify(SapDiscClient)
		// Construct the notification data
		const notificationData = {
			userId: betslip.userid,
			betId: betslip.betid,
			betResult,
			currentBalance: balanceChanges
				? balanceChanges.currentBalance
				: null,
			newBalance: balanceChanges
				? balanceChanges.newBalance
				: null,
			payout: payoutData ? payoutData.payout : null,
			profit: payoutData ? payoutData.profit : null,
		}
		await betNotify.notifyUser(notificationData)
	}

	async handleUserXP(userId, isWin) {
		// XP Handling
		const xpHandler = new XPHandler(userId)
		const tierInfo = await xpHandler.handleBetXp({
			userId,
			isWin,
		})
		if (tierInfo.leveledUp === true) {
			const { tierImg, tier, userLevel } = tierInfo
			const imageAttachment = new AttachmentBuilder(
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
				.setThumbnail(`attachment://${tier}.png`)
				.setColor(`${embedColors.Gold}`)
				.setFooter({
					text: `XP Tiers have been fixed - You may have jumped a tier or two!`,
				})
			try {
				await SapDiscClient.users.send(
					this.userId,
					{
						embeds: [embed],
						files: [imageAttachment],
					},
				)
			} catch (err) {
				console.error(err)
				return false
				// Failed to DM User, likely to privacy settings or blocked
			}
		}
	}

	async getBets(id) {
		// Logic to retrieve bets from the database
		return this.dbTrans.manyOrNone(
			`SELECT * FROM "${BETSLIPS}" WHERE matchid = $1 and betresult = 'pending'`,
			[id],
		)
	}
}
