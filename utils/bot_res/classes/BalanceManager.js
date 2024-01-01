import accounting from 'accounting'
import _ from 'lodash'
import db from '@pluto-db'
import {
	Log,
	QuickError,
	embedReply,
	CURRENCY,
	helpfooter,
} from '@pluto-core-config'
import { SapDiscClient } from '@pluto-core'
import embedColors from '../../../lib/colorsConfig.js'
import XPHandler from '../../xp/XPHandler.js'

export default class BalanceHandler {
	constructor(interaction) {
		this.interaction = interaction
	}

	async checkBalance(inputUserId, target) {
		const targetId = target?.id
		const queryUserId = target ? targetId : inputUserId

		try {
			const balanceRecord = await this.queryBalance(
				queryUserId,
			)

			if (!balanceRecord) {
				return target
					? this.handleUnregisteredTarget(target)
					: this.registerNewUser(inputUserId)
			}

			return await this.respondWithBalance(
				balanceRecord,
				inputUserId,
				target,
			)
		} catch (error) {
			this.handleTransactionError(error)
		}
	}

	async queryBalance(userId) {
		return db.tx(
			'checkbalance-Transaction',
			async (t) =>
				t.oneOrNone(
					`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
					[userId],
				),
		)
	}

	async registerNewUser(userId) {
		Log.BrightBlue(
			`[BalanceHandler] User ${userId} is not in the database, creating user`,
		)
		this.interaction.reply(
			`I see this is your first time using Pluto, welcome! I've created an account for you and assigned $100 dollars.`,
		)
		return this.createUser(userId)
	}

	async createUser(userId) {
		return db.tx('createUser-Transaction', async (t) =>
			t.any(
				`INSERT INTO "${CURRENCY}" (userid, balance) VALUES ($1, $2) RETURNING *`,
				[userId, 100],
			),
		)
	}

	async respondWithBalance(
		balanceRecord,
		inputUserId,
		target,
	) {
		const balance = accounting.format(
			balanceRecord.balance,
		)
		const xpHandler = new XPHandler(inputUserId)
		const userTier = await xpHandler.getUserTier()
		const { tier, userLevel } = userTier

		const embedData = await this.prepareEmbedData(
			balanceRecord,
			balance,
			userLevel,
			tier,
			inputUserId,
			target,
		)
		embedReply(this.interaction, embedData)
	}

	async prepareEmbedData(
		balanceRecord,
		balance,
		userLevel,
		tier,
		inputUserId,
		target,
	) {
		const userAcc = await this.fetchUserAccount(
			balanceRecord.userid,
		)
		const embedTitle = `:money_with_wings: ${userAcc.tag}'s Profile`
		const description = this.formatDescription(
			balance,
			userLevel,
			tier,
		)

		return {
			title: embedTitle,
			description: target
				? `${description}\n\n*Requested by ${userAcc.nickname}*`
				: description,
			color: embedColors.PlutoBrightGreen,
			footer: helpfooter,
			thumbnail: userAcc.avatarURL(),
		}
	}

	async fetchUserAccount(userId) {
		return SapDiscClient.users.fetch(userId)
	}

	formatDescription(balance, userLevel, tier) {
		return `**💰 Balance: \`$${balance}\`**\n**🔰 Level: \`${userLevel}\`**\n**💫 Tier: ${_.upperFirst(
			tier,
		)}**\n\n*View information on levels & tiers via /faq*`
	}

	async handleUnregisteredTarget() {
		return QuickError(
			this.interaction,
			`This user is not registered with Pluto!`,
		)
	}

	handleTransactionError(error) {
		Log.Red(`[BalanceHandler] Something went wrong...`)
		Log.Red(error)
	}
}
