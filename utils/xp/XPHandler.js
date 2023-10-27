import _ from 'lodash'
import { AttachmentBuilder, EmbedBuilder } from 'discord.js'
import { packageDirectory } from 'pkg-dir'
import { db } from '#db'
import { SPORT } from '#env'
import { SapDiscClient } from '#main'
import { helpfooter, EXPERIENCE } from '#config'
import { levelTiers, levelIcons } from './XPLevels.js'
import embedColors from '../../lib/colorsConfig.js'

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

	/**
	 * Query database to get user's current XP & level
	 * Assigns XP and level to class instance
	 */
	async get_XP_Profile() {
		// Query database to get user's current XP
		const xpProfile = await db.oneOrNone(
			`SELECT * FROM "${this.xpTable}" WHERE userid = $1`,
			[this.userId],
		)
		const { xp, level } = xpProfile
		this.userXP = xp
		this.userLevel = level
		return this
	}

	/**
	 * Creates a new user if they don't already exist in the database.
	 *
	 */
	async createNewUser() {
		// Check if user exists
		const exists = await db.oneOrNone(
			`SELECT * FROM "${this.xpTable}" WHERE userid = $1`,
			[this.userId],
		)

		// If not, insert them with default XP
		if (!exists) {
			await db.none(`
			INSERT INTO "${this.xpTable}" (userId, xp, level)
			VALUES (${this.userId}, 0, 0)
		  `)
		}
	}

	/**
	 * Updates user XP, checks if they have leveled up up
	 *
	 * @param {object} options - The options to update the user XP with.
	 * @property {boolean} options.isWin - Whether the bet result is a win or loss
	 * @return {Promise<void>} Promise that resolves when the XP is updated.
	 */
	async updateUserXP(options) {
		const { isWin } = options
		// Check for user
		await this.createNewUser()

		// Collect XP & level
		await this.get_XP_Profile()

		// Apply default XP
		const xp = isWin
			? this.XP_WIN_BET
			: this.XP_LOSE_BET

		// Update XP
		const newXP = this.userXP + xp
		await this.updateXP(newXP)

		// Check if the user has to level up!
		const level = await this.fetchLevel(newXP)
		if (level > this.userLevel) {
			await this.updateUserLevel(level)
			await this.notifyOfLevelUp()
		}
	}

	/**
	 * Update XP value for user in the database
	 *
	 * @param {number} xp - The new XP value to update.
	 * @return {Promise<void>} - A promise that resolves when the XP has been updated.
	 */
	async updateXP(xp) {
		const newXP = this.restrictUnderMax(xp)
		await db.oneOrNone(
			`UPDATE "${this.xpTable}" SET xp = ${newXP} WHERE userid = $1`,
			[this.userId],
		)
		this.userXP = newXP
	}

	/**
	 * Restrict the given XP value to be under the maximum threshold.
	 *
	 * @param {number} xp - The XP value to be restricted.
	 * @return {number} The restricted XP value.
	 */
	restrictUnderMax(xp) {
		// Get last level XP amount
		let newXP = xp
		const lastLVL = _.last(this.LEVEL_THRESHOLDS)
		if (newXP > lastLVL) {
			// eslint-disable-next-line no-param-reassign
			newXP = lastLVL
		}
		return newXP
	}

	/**
	 * Checks if the user's XP exceeds any of the level thresholds and updates the user's level accordingly.
	 *
	 * @param {type} paramName - description of parameter
	 * @return {type} description of return value
	 */
	fetchLevel(userXP) {
		let left = 0
		let right =
			Object.keys(this.LEVEL_THRESHOLDS).length - 1

		while (left <= right) {
			const mid = Math.floor((left + right) / 2)
			const midXP = this.LEVEL_THRESHOLDS[mid]

			if (userXP < midXP) {
				right = mid - 1
			} else if (userXP > midXP) {
				left = mid + 1
			} else {
				// User's XP matches exactly with a level
				return mid
			}
		}

		// If userXP is not exactly matching any level, return the previous level
		return right
	}

	/**
	 * Updates the user's level in the database and updates the cached level.
	 *
	 * @param {number} newLevel - The new level to update the user to.
	 * @return {Promise<void>} - A promise that resolves when the user's level has been updated.
	 */
	async updateUserLevel(newLevel) {
		// Update user's level in database
		await db.none(
			`UPDATE "${this.xpTable}" SET level = ${newLevel} WHERE userid = $1`,
			[this.userId],
		)
		this.userLevel = newLevel // Update cached level
	}

	/**
	 * Sends a direct message to the user to notify them of a level up.
	 *
	 * @return {Promise<void>} - A promise that resolves when the message is sent.
	 */
	async notifyOfLevelUp() {
		const userTier = await this.getUserTier()
		const { tierImg, tier } = userTier
		this.usersLevelTier = _.upperFirst(tier)
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
				`**You've reached level ${this.userLevel} 👏**\n**Current Tier: ${this.usersLevelTier}**`,
			)
			.setThumbnail(`attachment://${tier}.png`)
			.setColor(`${embedColors.Gold}`)
			.setFooter({ text: helpfooter })
		try {
			await SapDiscClient.users.send(this.userId, {
				embeds: [embed],
				files: [imageAttachment],
			})
		} catch (err) {
			// Failed to DM User, likely to privacy settings or blocked
		}
	}

	/**
	 * Asynchronously retrieves the user's tier information.
	 *
	 * @return {Object} An object containing the user's tier and tier image.
	 */
	async getUserTier() {
		await this.createNewUser()
		const tier = await this.matchLevelToTier(
			this.userLevel,
		)
		const tierImg = await this.fetchTierImg(tier)
		return {
			tier,
			tierImg,
		}
	}

	/**
	 * Lists the max level for each tier
	 * E.g, Bronze at 15 would mean any user between 0-15 is in the Bronze Tier
	 *
	 * @param {number} level - the user's level
	 * @return {string} tier - the tier that the user belongs to
	 */
	async matchLevelToTier(level) {
		/**
		 * Lists the max level for each tier
		 * E.g, Bronze at 15 would mean any user between 0-15 is in the Bronze Tier
		 */
		// Identify which tier the user is in by checking which tier value is closest to the user's level
		const tier = Object.keys(this.tiers).find(
			(t) => this.tiers[t] >= level,
		)
		return tier
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
