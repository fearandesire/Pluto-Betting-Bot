import teamResolver from 'resolve-team'
import { SPORT } from '@pluto-server-config'
import {
	QuickError,
	BETSLIPS,
	CURRENCY,
	PROFILES,
	LIVEBETS,
	findEmoji,
} from '@pluto-core-config'
import PendingBetHandler from '@pluto-validate/pendingBet.js'
import { verifyDupBet } from '@pluto-validate/verifyDuplicateBet.js'
import { resolvePayouts } from '@pluto-betOps/resolvePayouts.js'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import SelectMenuManager from '../../bot_res/classes/SelectMenuManager.js'
import BetManager from '../../bot_res/classes/BetManager.js'
import { sendErrorEmbed } from '../../bot_res/embeds/embedReply.js'
import AccountManager from '../../bot_res/classes/AccountManager.js'

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
	const userId =
		interaction?.author?.id || interaction.user.id

	if (betAmount.toString().match(negativeRgx)) {
		await QuickError(
			interaction,
			`You cannot enter a negative number for your bet amount.`,
			true,
		)
		await PendingBetHandler.deletePending(userId)
		return
	}

	const accountManager = new AccountManager(CURRENCY)
	const currentUserBalance =
		await accountManager.getBalance(userId)
	if (currentUserBalance < Number(betAmount)) {
		await QuickError(
			interaction,
			`You do not have enough money to place this bet.`,
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

	const team = await teamResolver(SPORT, betOnTeam)
	let matchInfo
	const matchupMngr = new MatchupManager()
	// Check if the user is betting on a team that has more than one game in the collected odds
	// Serve the user with a select menu if they are, so they are able to choose the game
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
						value: matchup.id.toString(),
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
						matchup.id === selectedMatchId,
				)
				oddsForTeam =
					await MatchupManager.getOddsViaId(
						matchInfo.id,
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
	const activeCheck = await MatchupManager.gameIsLive(
		matchInfo.id,
	)
	if (activeCheck === true) {
		await QuickError(
			interaction,
			`This match has already started! It's not possible to place a bet on games currently in progress.`,
			true,
		)
		await PendingBetHandler.deletePending(userId)
		return
	}
	const potentialPayout = await resolvePayouts(
		oddsForTeam,
		betAmount,
	)
	const { payout, profit } = potentialPayout
	let teamEmoji
	try {
		// verify if the user already has a bet on this matchup
		await verifyDupBet(
			interaction,
			userId,
			matchInfo.id,
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
				matchId: matchInfo.id,
				matchupDate: matchInfo.dateofmatchup,
				matchupStr: `${matchInfo.teamone} vs ${matchInfo.teamtwo}`,
				betId,
				teamEmoji,
				payout,
				profit,
			},
		)
	} catch (err) {
		console.error(err)
	} finally {
		await PendingBetHandler.deletePending(userId)
	}
}
