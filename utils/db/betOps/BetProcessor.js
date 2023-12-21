import { SapDiscClient } from '@pluto-core'

import { PlutoLogger } from '@pluto-logger'
import {
	BETSLIPS,
	CURRENCY,
	LIVEBETS,
} from '@pluto-core-config'
import { AttachmentBuilder, EmbedBuilder } from 'discord.js'
import { resolvePayouts } from './resolvePayouts'
import BetNotify from './BetNotify'
import { getBalance } from '../validation/getBalance'
import XPHandler from '../../xp/XPHandler'
import embedColors from '../../../lib/colorsConfig'

export default class BetProcessor {
	constructor(dbTrans) {
		this.dbTrans = dbTrans
	}

	async closeBets(winningTeam, losingTeam, matchInfo) {
		try {
			// Log and validation logic here

			const bets = await this.getBets(
				matchInfo.matchid,
			)
			for await (const betslip of bets) {
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
			return false
		}

		return selectedOdds
	}

	/**
	 * @returns {object} `{ payout: number, profit: number}`
	 */
	async getPayoutData(oddsForBet, betAmount) {
		return resolvePayouts(oddsForBet, betAmount)
	}

	async processBet(
		betslip,
		winningTeam,
		losingTeam,
		matchInfo,
	) {
		const betResult = this.determineBetResult(
			betslip.teamid,
			winningTeam,
			losingTeam,
		)
		const oddsForBet = await this.selectOdds(
			matchInfo,
			betslip.teamid,
		)
		const payoutData = await this.getPayoutData(
			oddsForBet,
			betslip.betAmount,
		)
		const oldBalance = await getBalance(betslip.userid)
		if (betResult === 'won') {
			await this.handleBetResult(betslip, payoutData)
		} else if (betResult === 'lost') {
			await this.handleBetResult(betslip)
		}
		const newBalance = await getBalance(betslip.userid)
		const betData = {
			userId: betslip.userid,
			betId: betslip.betid,
			teamBetOn: betslip.teamid,
			opposingTeam: oddsForBet.opposingTeam,
			betAmount: betslip.betAmount,
			payout: payoutData ? payoutData.payout : null,
			profit: payoutData ? payoutData.profit : null,
			currentBalance: newBalance,
			oldBalance,
			betResult,
		}
		await this.notifyUser(betData)
		const isWin = betResult === 'won'
		await this.handleUserXP(betslip.userid, isWin)
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

	async notifyUser(betData) {
		const betNotify = new BetNotify(SapDiscClient)
		return betNotify.notifyUser(betData)
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

	async getBets(matchId) {
		// Logic to retrieve bets from the database
		return this.dbTrans.manyOrNone(
			`SELECT * FROM "${BETSLIPS}" WHERE matchid = $1 and betresult = 'pending'`,
			[matchId],
		)
	}
}
