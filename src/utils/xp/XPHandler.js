import _ from 'lodash'
import { packageDirectory } from 'pkg-dir'
import db from '@pluto-db'
import { EXPERIENCE, SPORT } from '@pluto-server-config'
import { levelTiers, levelIcons } from './XPLevels.js'

/**
 * Class that handles all interactions with the experience system.
 */

export default class XPHandler {
	/**
	 * Initializes a new instance of the Constructor class.
	 *
	 * @param {type} userId - The user ID.
	 * @return {void}
	 */
	constructor(userId) {
		this.userId = userId
		this.userXP = null
		this.userLevel = null
		this.xpTable = `${EXPERIENCE}`
		this.XP_WIN_BET = 50
		this.XP_LOSE_BET = 20
		this.defaultXP = 1
		this.LEVEL_THRESHOLDS = levelTiers(`${SPORT}`)
		this.LEVELS_ICONS = levelIcons
		this.usersLevelTier = null
		this.usersTierObj = null
		this.tiers = {
			bronze: 15,
			silver: 30,
			gold: 50,
			emerald: 75,
			diamond: 100,
		}
	}

	async createStarterProfile() {
		return db.none(
			`INSERT INTO "${this.xpTable}" (userId, xp, level) VALUES ($1, 0, 0)`,
		)
	}

	async userExists() {
		const user = await db.oneOrNone(
			`SELECT 1 FROM "${this.xpTable}" WHERE userid = $1`,
			[this.userId],
		)
		return !!user
	}

	async xpProfileValidation() {
		if (!(await this.userExists())) {
			await db.none(
				`INSERT INTO "${this.xpTable}" (userId, xp, level) VALUES ($1, 0, 0)`,
				[this.userId],
			)
		}
		return this
	}

	async getXpProfile() {
		const xpProfile = await db.oneOrNone(
			`SELECT xp, level FROM "${this.xpTable}" WHERE userid = $1`,
			[this.userId],
		)

		const userXP = xpProfile?.xp ?? 0
		const userLevel = xpProfile?.level ?? 0
		return {
			userXP,
			userLevel,
		}
	}

	async handleBetXp(userId, isWin) {
		await this.xpProfileValidation()
		const xpProfile = await this.getXpProfile()
		const { userLevel, userXP } = xpProfile
		const currentLevel = userLevel
		const xpGain = isWin
			? this.XP_WIN_BET
			: this.XP_LOSE_BET
		const newXP = this.restrictUnderMax(userXP + xpGain)

		await this.updateXP(newXP)
		const level = this.calculateLevel(newXP)
		const hasIncreasedLevel = level > currentLevel

		if (hasIncreasedLevel) {
			await this.updateUserLevel(level)
			return this.sendTierInfo()
		}
		return {
			leveledUp: false,
		}
	}

	/**
	 * Update XP value for user in the database
	 *
	 * @param {number} xp - The new XP value to update.
	 * @return {Promise<void>} - A promise that resolves when the XP has been updated.
	 */
	async updateXP(userXp) {
		await db.oneOrNone(
			`UPDATE "${this.xpTable}" SET xp = ${userXp} WHERE userid = $1`,
			[this.userId],
		)
		return this
	}

	restrictUnderMax(xp) {
		const lastLVL = _.last(this.LEVEL_THRESHOLDS)
		return xp > lastLVL ? lastLVL : xp
	}

	calculateLevel(userXP) {
		const level = _.findLastKey(
			this.LEVEL_THRESHOLDS,
			(xp) => userXP >= xp,
		)
		return parseInt(level, 10)
	}

	async updateUserLevel(newLevel) {
		await db.none(
			`UPDATE "${this.xpTable}" SET level = $1 WHERE userid = $2`,
			[newLevel, this.userId],
		)
		this.userLevel = newLevel
	}

	/**
	 * Sends a direct message to the user to notify them of a level up.
	 *
	 * @return {Promise<void>} - A promise that resolves when the message is sent.
	 */
	async sendTierInfo(userId) {
		const userTier = await this.getUserTier(userId)
		const { tierImg, tier, userLevel } = userTier
		this.usersLevelTier = _.upperFirst(tier)
		return {
			leveledUp: true,
			tierImg,
			tier,
			userLevel,
		}
	}

	/**
	 * Asynchronously retrieves the user's tier information.
	 *
	 * @return {Object} An object containing the user's tier and tier image.
	 */
	async getUserTier(userId) {
		const hasXP = await this.xpProfileValidation()
		if (!hasXP) {
			await this.xpProfileValidation()
			return {
				tier: 'Bronze',
				tierImg: this.LEVELS_ICONS.Bronze,
			}
		}
		const xpProfile = await this.getXpProfile()
		const { userLevel } = xpProfile
		if (userLevel === undefined || userLevel === null) {
			throw new Error(
				`Failed to retrieve user's (${userId}) XP Level.`,
			)
		}
		const tier = await this.matchLevelToTier(userLevel)
		const tierImg = await this.fetchTierImg(tier)
		return {
			tier,
			tierImg,
			userLevel,
		}
	}

	/**
	 * Lists the max level for each tier
	 * E.g, Bronze at 15 would mean any user between 0-15 is in the Bronze Tier
	 *
	 * @param {number} level - the user's level
	 * @return {string} tier - the tier that the user belongs to
	 */
	/**
	 * Maps the user's level to the appropriate tier.
	 *
	 * @param {number} level - The user's level.
	 * @return {string} - The tier that the user belongs to.
	 */
	async matchLevelToTier(level) {
		// Define the level range for each tier
		const tierRanges = {
			bronze: { min: 0, max: 15 },
			silver: { min: 16, max: 30 },
			gold: { min: 31, max: 50 },
			emerald: { min: 51, max: 75 },
			diamond: { min: 76, max: 100 },
		}

		// Find the tier that the user's level falls into
		for (const [tier, range] of Object.entries(
			tierRanges,
		)) {
			if (level >= range.min && level <= range.max) {
				return tier
			}
		}

		// Default tier if level does not match any range
		return 'Bronze' // Or any other default tier you want to set
	}

	/**
	 * Retrieves the image path for a given tier.
	 *
	 * @param {string} tier - The tier for which to retrieve the image path.
	 * @return {string} The image path for the specified tier.
	 */

	async fetchTierImg(tier) {
		const rootDir = await packageDirectory()
		const tierImg = `${rootDir}/lib/xptierimages/${tier.toLowerCase()}.png`
		return tierImg
	}

	/**
	 * Generates XP levels for a character.
	 * @return {object} The XP levels for each level up to 100.
	 */
	generateXPLevels() {
		const LEVELS = {
			0: 0,
			1: 100,
		}

		let xp = 100 // Level 1 XP

		const level100XP = 6150

		// Calculate growth rate needed to reach level 100 XP
		const growthRate = (level100XP / xp) ** (1 / 99)

		for (let level = 2; level <= 100; level += 1) {
			xp *= growthRate

			LEVELS[level] = Math.floor(xp)
		}

		return LEVELS
	}
}
