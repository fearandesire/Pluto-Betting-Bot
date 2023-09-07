import async from 'async'
import teamResolver from 'resolve-team'
import { Log, QuickError } from '#config'

import { gameActive } from '#dateUtil/gameActive'
import PendingBetHandler from '#utilValidate/pendingBet'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { setupBet } from '#utilBetOps/setupBet'
import { setupBetLog } from '#winstonLogger'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'
import { SPORT } from '#env'
/**
 * @module newBet - This module is used to setup a bet in the DB.
 * Runs checks to validate the user, their bet, and then operations to get the bet setup.
 * @param {obj} interaction - Discord Message object
 * @param {string} team - The team the user is betting on
 * @param {integer} betAmount - The amount of money the user is betting
 *
 */
export async function newBet(
	interaction,
	betOnTeam,
	betAmount,
) {
	const interactionObj = interaction
	const user =
		interaction?.author?.id || interaction.user.id
	const team = await teamResolver(SPORT, betOnTeam)

	const matchInfo = await resolveMatchup(team, null)
	const negativeRgx = /-/g
	if (betAmount.toString().match(negativeRgx)) {
		await QuickError(
			interaction,
			`You cannot enter a negative number for your bet amount.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}

	if (Number(betAmount) < 1) {
		await QuickError(
			interaction,
			`You must bet an amount greater than 0.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
	if (!matchInfo) {
		QuickError(
			interaction,
			`Unable to locate a match for ${team}\nPlease check currently available matchups with \`/odds\`\nMatchups will become available as DraftKings provides them.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
	const matchupId = parseInt(matchInfo.matchid)
	const activeCheck = await gameActive(team, matchupId)
	if (!team) {
		await QuickError(
			interaction,
			'Please enter a valid team',
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
	if (activeCheck === true) {
		await QuickError(
			interaction,
			`This match has already started. You are unable to place a bet on active games.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
	await setupBetLog.info(`New Betslip Created`, {
		user,
		team,
		amount: betAmount,
		matchupId,
	})
	// # using an async series to catch the errors and stop the process if any of the functions fail
	async.series(
		[
			// verify if the user already has a bet on this matchup
			async function verDup() {
				await verifyDupBet(
					interaction,
					user,
					matchupId,
					true,
				)
			},
			// setup the bet
			async function setBet() {
				await setupBet(
					interactionObj,
					team,
					betAmount,
					user,
					matchupId,
				)
			},
		],
		(err) => {
			if (err) {
				Log.Red(err)
				setupBetLog.error({ errorMsg: err })
				QuickError(
					interaction,
					`Unable to place your bet.`,
				)
			}
		},
	)
}
