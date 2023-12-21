import { EmbedBuilder } from 'discord.js'
import accounting from 'accounting'
import db from '@pluto-db'
import {
	embedReply,
	QuickError,
	helpfooter,
} from '@pluto-core-config'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import { guildImgURL } from '@pluto-embed-reply'
import BtnManager from './BtnManager.js'
import AccountManager from './AccountManager.js'
import PendingBetHandler from '../../db/validation/pendingBet.js'
import { TodaysDate } from '../../date/TodaysDate.js'
import embedColors from '../../../lib/colorsConfig.js'

export default class BetManager {
	/**
	 * Constructor function for creating an instance of the class.
	 *
	 * @param {object} tables - The tables object containing BETSLIPS and PROFILES.
	 * @param {string} tables.BETSLIPS - The name of the BETSLIPS table.
	 * @param {string} tables.PROFILES - The name of the PROFILES table.
	 */
	constructor(tables) {
		this.LIVEBETS = tables.LIVEBETS
		this.BETSLIPS = tables.BETSLIPS
		this.PROFILES = tables.PROFILES
		this.CURRENCY = tables.CURRENCY
	}

	async assignUniqueBetId() {
		const generateBetId = () =>
			Math.floor(100000 + Math.random() * 900000)

		// Fetch all existing bet IDs from the database
		const existingBetIdsResult = await db.manyOrNone(
			`SELECT betid FROM "${this.BETSLIPS}"`,
		)
		const existingBetIds = new Set(
			existingBetIdsResult.map((bet) => bet.betid),
		)
		// Generate a unique bet ID
		let uniqueBetId = generateBetId()
		let attempts = 0
		const maxAttempts = 10 // Prevent infinite loop
		while (existingBetIds.has(uniqueBetId)) {
			uniqueBetId = generateBetId()
			attempts += 1
			if (attempts > maxAttempts) {
				throw new Error(
					'Unable to generate a unique bet ID after several attempts.',
				)
			}
		}

		return uniqueBetId
	}

	async currentBets() {
		const bets = await db.manyOrNone(
			`SELECT * FROM "${this.LIVEBETS}"`,
		)
		return bets
	}

	/**
	 * Retrieves all bets from the database.
	 *
	 * @return {Promise<Array>} An array of bet objects.
	 * @example
	 * 
	 * ```js
	   [
	   {
	   betid: number,
	   userid: number,
	   teamid: string,
	   matchid: number,
	   amount: number,
	   dateofbet: string
	   },
	   ...
	   ]
	  ```
	 */
	async allBets() {
		const bets = await db.manyOrNone(
			`SELECT * FROM "${this.BETSLIPS}"`,
		)
		return bets
	}

	async betsViaId(id) {
		const bets = await db.manyOrNone(
			`SELECT * FROM "${this.BETSLIPS}" WHERE id = $1`,
			[id],
		)
		return bets
	}

	async allBettingProfiles() {
		const profiles = await db.manyOrNone(
			`SELECT * FROM "${this.PROFILES}"`,
		)
		return profiles
	}

	async bettingProfilesViaId(id) {
		const profiles = await db.manyOrNone(
			`SELECT * FROM "${this.PROFILES}" WHERE id = $1`,
			[id],
		)
		return profiles
	}

	async matchupIdViaBetId(betid) {
		const matchup = await db.oneOrNone(
			`SELECT matchid FROM "${this.BETSLIPS}" WHERE betid = $1`,
			[betid],
		)
		return matchup
	}

	async cancelBet(interaction, userid, betid) {
		return db.tx('Cancel Bet', async (t) => {
			const getBetCount = await t.manyOrNone(
				`SELECT count(*) FROM "${this.BETSLIPS}" WHERE userid = $1`,
				[userid],
				(c) => c.count,
			)
			const betCount = Number(getBetCount[0].count)
			if (betCount < 1) {
				await QuickError(
					interaction,
					`You have no active bets to cancel.`,
				)
				return
			}
			// Collect bet info
			const betData = await t.oneOrNone(
				`SELECT amount FROM "${this.BETSLIPS}" WHERE userid = $1 AND betid = $2`,
				[userid, betid],
			)
			const { amount: betAmount, matchid } = betData
			// Ensure game is not active
			const isGameActive =
				await MatchupManager.gameIsLive(matchid)
			if (isGameActive) {
				await QuickError(
					interaction,
					`You are unable to cancel this bet because the game has already started!`,
				)
				return
			}
			// Collect current user balance
			const userBal = await t.oneOrNone(
				`SELECT balance FROM "${this.CURRENCY}" WHERE userid = $1`,
				[userid],
			)
			// Restore user balance
			const newBal =
				Number(userBal.balance) + Number(betAmount)
			await t.batch([
				await t.oneOrNone(
					`UPDATE "${this.CURRENCY}" SET balance = $1 WHERE userid = $2`,
					[newBal, userid],
				),
				await t.oneOrNone(
					`DELETE FROM "${this.LIVEBETS}" WHERE userid = $1 AND betid = $2`,
					[userid, betid],
				),
				await t.oneOrNone(
					`DELETE FROM "${this.BETSLIPS}" WHERE userid = $1 AND betid = $2`,
					[userid, betid],
				),
			])
			const embObj = {
				title: `Bet Revoked`,
				description: `Successfully cancelled bet #${betid}\nYour balance has been restored.`,
				color: `#00ff00`,
				thumbnail: `${guildImgURL(
					interaction.client,
				)}`,
				target: `reply`,
			}
			await embedReply(interaction, embObj)
		})
	}

	/**
	 * Setup a bet in the DB.
	 * @param {Object} interaction - The message object from the discord.js library
	 * @param {number} userId - The ID of the user
	 * @param {object} betDetails - The details of the bet
	 * @prop {string} betDetails.teamName - The team the user wishes to bet on
	 * @prop {number} betDetails.betAmount - The amount of money the user wishes to bet
	 * @prop {number} betDetails.betId - The ID of the bet
	 * @prop {number} betDetails.matchid - The ID of the match
	 * @returns {Promise<boolean>} - True if bet setup is successful, otherwise false
	 */
	async setupBet(
		interaction,
		userId,
		userAvatar,
		betDetails,
	) {
		try {
			const {
				teamName,
				betAmount,
				matchId,
				betId,
				matchupDate,
				matchupStr,
				teamEmoji,
				profit,
				payout,
			} = betDetails
			const userBalance = await new AccountManager(
				this.CURRENCY,
			).getBalance(userId)

			if (userBalance < betAmount) {
				await PendingBetHandler.deletePending(
					userId,
				)
				await embedReply(interaction, {
					title: 'Insufficient Funds',
					description: `You do not have enough money for this bet! Your current balance is **$${userBalance}**`,
					color: embedColors.PlutoRed,
					target: `reply`,
					followUp: true,
				})
			}

			const betslip = {
				userid: userId,
				amount: betAmount,
				teamid: teamName,
				payout,
				profit,
				matchId,
				betId,
				matchupDate,
				matchupStr,
				teamEmoji,
			}

			const confirmStatus = await this.confirmBetMsg(
				interaction,
				betslip,
				userAvatar,
			)
			if (confirmStatus) {
				await this.storeNewBet(interaction, betslip)
			}
		} catch (err) {
			await PendingBetHandler.deletePending(userId)
			console.error(err)
			throw err
		}
	}

	/**
	 * Sends a confirmation message for the bet with options to confirm or cancel.
	 * @param {Object} interaction - The interaction object from Discord
	 * @param {Object} betslip - The betslip containing bet details
	 * @returns {Promise<boolean>} - True if bet is confirmed, false otherwise
	 */
	async confirmBetMsg(interaction, betslip, userAvatar) {
		const btnManager = new BtnManager(interaction)
		const betDetails = `${betslip.matchupStr}\n*${betslip.matchupDate}*\n\`$${betslip.amount}\` on the **${betslip.teamid}** ${betslip.teamEmoji}\n**Potential payout:** \`$${betslip.payout}\`\n**Potential profit:** \`$${betslip.profit}\``
		const betConfirmationEmbed = new EmbedBuilder()
			.setTitle('Pending Betslip')
			.setDescription(betDetails)
			.setThumbnail(userAvatar)
			.setColor(embedColors.warning)
			.setFooter({ text: helpfooter })

		await interaction.editReply({
			embeds: [betConfirmationEmbed],
		})

		await btnManager.createButtons(
			`**⚠️ Your bet is pending confirmation below**`,
		)

		const { format } = accounting
		const amount = format(betslip.amount)
		const profit = format(betslip.profit)
		const payout = format(betslip.payout)
		const successEmb = {
			title: `Bet confirmed! :ticket:`,
			description: `## **__Betslip__**\n**${betslip.teamid}** ${betslip.teamEmoji}\n**Amount:** **\`$${amount}\`**\n**Profit:** **\`$${profit}\`** ➞ **Payout:** **\`$${payout}\`**\n\n*View more commands via \`/commands\`*\n*Betslip ID: \`${betslip.betId}\`*`,
			color: embedColors.PlutoBrightGreen,
			thumbnail: `${userAvatar}`,
		}

		const cancelEmb = {
			title: 'Bet Cancelled',
			description: 'You have cancelled your bet.',
		}

		const confirmationResult =
			await btnManager.waitForConfirmation(
				successEmb,
				cancelEmb,
			)

		if (confirmationResult) {
			return true
		}
	}

	async storeNewBet(interaction, betslip) {
		/*
	Querying DB using db.tx since we are handling multiple transactions
	First query: Selecting the 'matchid' as its required for us to store the betslip information in the DB.
	*/
		const date = await TodaysDate()
		return db.tx('createNewBet', async (t) => {
			await t.none(
				`UPDATE "${this.CURRENCY}" SET balance = balance - $1 WHERE userid = $2`,
				[betslip.amount, betslip.userid],
			)
			await t.none(
				`INSERT INTO "${this.BETSLIPS}" (userid, teamid, betid, amount, matchid, dateofbet, betresult, profit, payout) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[
					betslip.userid,
					betslip.teamid,
					betslip.betId,
					betslip.amount,
					betslip.matchId,
					date,
					'pending',
					betslip.profit,
					betslip.payout,
				], // ? Insert betslip information into the database
			)
			await t.none(
				`INSERT INTO "${this.LIVEBETS}" (betid, userid, teamid, matchid, amount, dateofbet) VALUES ($1, $2, $3, $4, $5, $6)`,
				[
					betslip.betId,
					betslip.userid,
					betslip.teamid,
					betslip.matchId,
					betslip.amount,
					date,
				], // ? Insert betslip information into the database
			)
		})
	}
}
