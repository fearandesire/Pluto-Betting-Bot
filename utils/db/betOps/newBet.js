import async from 'async'
import { Log, QuickError } from '#config'

import { gameActive } from '#dateUtil/gameActive'
import { pendingBet } from '#utilValidate/pendingBet'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { setupBet } from '#utilBetOps/setupBet'
import { setupBetLog } from '#winstonLogger'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'

/**
 * @module newBet - This module is used to setup a bet in the DB.
 * Runs checks to validate the user, their bet, and then operations to get the bet setup.
 * @param {obj} interaction - Discord Message object
 * @param {string} betOnTeam - The team the user is betting on
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
	betOnTeam = await resolveTeam(betOnTeam)
	const matchInfo = await resolveMatchup(betOnTeam, null)
	const negativeRgx = /-/g
	if (betAmount.toString().match(negativeRgx)) {
		await QuickError(
			interaction,
			`You cannot enter a negative number for your bet amount.`,
			true,
		)
		// # delete from pending
		await new pendingBet().deletePending(user)
		return
	}

	if (!matchInfo) {
		QuickError(
			interaction,
			`Unable to locate a match for ${betOnTeam}\nPlease check currently available matchups with \`/odds\`\nMatchups will become available as DraftKings provides them.`,
			true,
		)
		// # delete from pending
		await new pendingBet().deletePending(user)
		return
	}
	const matchupId = parseInt(matchInfo.matchid)
	const activeCheck = await gameActive(
		betOnTeam,
		matchupId,
	)
	if (!betOnTeam) {
		// # failure to locate match
		await QuickError(
			interaction,
			'Please enter a valid team',
			true,
		)
		// # delete from pending
		await new pendingBet().deletePending(user)
		return
	}
	if (activeCheck == true) {
		await QuickError(
			interaction,
			`This match has already started. You are unable to place a bet on active games.`,
			true,
		)
		// # delete from pending
		await new pendingBet().deletePending(user)
		return
	}
	await setupBetLog.info(`New Betslip Created`, {
		user,
		team: betOnTeam,
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
					betOnTeam,
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
