import teamResolver from 'resolve-team'
import {
	QuickError,
	BETSLIPS,
	CURRENCY,
	PROFILES,
	LIVEBETS,
	findEmoji,
} from '#config'
import PendingBetHandler from '#utilValidate/pendingBet'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'
import { SPORT } from '#env'
import { AssignBetID } from '#botUtil/AssignIDs'
import { MatchupManager } from '#MatchupManager'
import SelectMenuManager from '../../bot_res/classes/SelectMenuManager.js'
import BetManager from '../../bot_res/classes/BetManager.js'
import { sendErrorEmbed } from '../../bot_res/embeds/embedReply.js'

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
	const userAvatar = interaction.user.displayAvatarURL()
	const negativeRgx = /-/g
	if (betAmount.toString().match(negativeRgx)) {
		await QuickError(
			interaction,
			`You cannot enter a negative number for your bet amount.`,
			true,
		)
		await PendingBetHandler.deletePending(userId)
		return
	}

	if (Number(betAmount) < 1) {
		await QuickError(
			interaction,
			`You must bet at least $1.`,
			true,
		)
		await PendingBetHandler.deletePending(userId)
		return
	}

	const userId =
		interaction?.author?.id || interaction.user.id
	const team = await teamResolver(SPORT, betOnTeam)
	let matchInfo
	const matchupMngr = new MatchupManager()
	const repeatTeamsMatchups =
		await matchupMngr.repeatTeamCheck(team)
	let oddsForTeam
	try {
		if (repeatTeamsMatchups !== false) {
			const matchupSelectionMenu =
				new SelectMenuManager(interaction)

			// Prepare options for the select menu
			const selectOptions =
				await repeatTeamsMatchups.map(
					(matchup) => ({
						label: `${matchup.teamone} vs ${matchup.teamtwo}`,
						value: matchup.matchid.toString(),
						description: `Date: ${matchup.dateofmatchup}`,
					}),
				)

			// Create and send the select menu
			await matchupSelectionMenu.createSelectMenu(
				selectOptions,
				'Choose a matchup to bet on',
			)
			// Handle user selection
			const selectedMatchId =
				await matchupSelectionMenu.waitForSelection()

			if (selectedMatchId) {
				matchInfo = repeatTeamsMatchups.find(
					(matchup) =>
						matchup.matchid === selectedMatchId,
				)
				oddsForTeam =
					await MatchupManager.getOddsViaId(
						matchInfo.matchid,
						team,
					)
			} else {
				await sendErrorEmbed(
					interaction,
					`Your bet has timed out since you did not select a matchup in time.`,
					1,
				)
				await PendingBetHandler.deletePending(
					userId,
				)
				return
			}
		} else if (repeatTeamsMatchups === false) {
			// Find matchp
			const match = await matchupMngr.getMatchViaTeam(
				team,
			)
			matchInfo = match.matchInfo
			oddsForTeam = match.oddsForTeam
		}
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err)
		throw err
	}
	// const activeCheck = await MatchupManager.gameIsLive(
	// 	matchupId,
	// )
	// if (activeCheck === true) {
	// 	await QuickError(
	// 		interaction,
	// 		`This match has already started! It's not possible to place a bet on games currently in progress.`,
	// 		true,
	// 	)
	// 	await PendingBetHandler.deletePending(user)
	// 	return
	// }

	let teamEmoji
	try {
		// verify if the user already has a bet on this matchup
		await verifyDupBet(
			interaction,
			userId,
			matchInfo.matchid,
			true,
		)

		teamEmoji = await findEmoji(team)
		const betManager = new BetManager({
			BETSLIPS,
			CURRENCY,
			PROFILES,
			LIVEBETS,
		})
		const betId = await betManager.assignUniqueBetId()
		// setup the bet
		await betManager.setupBet(
			interaction,
			userId,
			userAvatar,
			{
				teamName: team,
				betAmount,
				oddsForTeam,
				matchId: matchInfo.matchid,
				matchupDate: matchInfo.dateofmatchup,
				matchupStr: `${matchInfo.teamone} vs ${matchInfo.teamtwo}`,
				betId,
				teamEmoji,
			},
		)
	} catch (err) {
		console.error(err)
	} finally {
		await PendingBetHandler.deletePending(userId)
	}
}
