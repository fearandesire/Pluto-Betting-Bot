import async from 'async'
import teamResolver from 'resolve-team'
import { QuickError } from '#config'

import { gameActive } from '#dateUtil/gameActive'
import PendingBetHandler from '#utilValidate/pendingBet'
import { setupBet } from '#utilBetOps/setupBet'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'
import { SPORT } from '#env'
import resolveMatchup from '../matchupOps/resolveMatchup.js'

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
			`You must bet at leat $1.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
	if (!matchInfo) {
		QuickError(
			interaction,
			`No match/odds are currently available for this team.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
	const matchupId = Number(matchInfo.matchid)
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
			`This match has already started! It's not possible to place a bet on games currently in progress.`,
			true,
		)
		await PendingBetHandler.deletePending(user)
		return
	}
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
		() => {
			// Error catch handled internally
		},
	)
}
