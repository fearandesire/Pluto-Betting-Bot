import { Log, QuickError, container } from '#config'

import async from 'async'
import { gameActive } from '#dateUtil/gameActive'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { setupBet } from '#utilBetOps/setupBet'
import { setupBetLog } from '#winstonLogger'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'

export async function newBet(
	interaction,
	betOnTeam,
	betAmount,
	interactionEph,
) {
	var user = interaction?.author?.id || interaction.user.id
	var userName = interaction?.author?.tag || interaction.user.username
	betOnTeam = await resolveTeam(betOnTeam)
	var matchInfo = await resolveMatchup(betOnTeam, null)
	if (!matchInfo) {
		QuickError(interaction, `Unable to locate a match for ${betOnTeam}`, true)
		return
	}
	var matchupId = parseInt(matchInfo.matchid)
	var activeCheck = await gameActive(betOnTeam, matchupId)
	if (!betOnTeam) {
		//# failure to match team
		QuickError(interaction, 'Please enter a valid team or match id', true)
		return
	}
	if (activeCheck == true) {
		QuickError(
			interaction,
			`This match has already started. You are unable to place a bet on active games.`,
			true,
		)
		container.userIsBetting[`${user}`] = false
		return
	}
	await setupBetLog.info(
		`User ${userName} (${user}) is getting a bet ready!\nBet Slip:\nAmount: ${betAmount}\nTeam: ${betOnTeam}`,
	)
	async.series(
		[
			async function valUser() {
				await validateUser(interaction, user, true)
				return
			},
			async function verDup() {
				await verifyDupBet(interaction, user, matchupId)
				return
			},
			async function setBet() {
				await setupBet(
					interaction,
					betOnTeam,
					betAmount,
					user,
					matchupId,
					interactionEph,
				)
				return
			},
		],
		function (err) {
			if (err) {
				Log.Red(err)
				setupBetLog.error(`Error: ${err}`)
				return
			}
		},
	)
}
