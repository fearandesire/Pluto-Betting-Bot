import Promise from 'bluebird'
import _ from 'lodash'
import { SapDiscClient } from '#main'

/**
 * Find an emoji by name and retrieve the closest match.
 *
 * @param {string} inputEmojiName - The name of the emoji to search for.
 * @param {boolean} combine - Whether to combine the emoji with the inputEmojiName.
 * @return {Promise<string>} A promise that resolves to the closest match emoji or a combined string.
 */
export async function findEmoji(inputEmojiName, combine) {
	return new Promise(async (resolve, reject) => {
		let res
		// Find an emoji by name, retrieve the closest match
		const emoji =
			(await SapDiscClient.emojis.cache.find(
				(foundEmoji) => {
					const lowerEmojiName =
						_.toLower(inputEmojiName)
					const lowerEmoji = _.toLower(
						foundEmoji.name,
					)
					return (
						lowerEmoji.includes(
							lowerEmojiName,
						) ||
						lowerEmojiName.includes(lowerEmoji)
					)
				},
			)) || null

		if (emoji === null && combine) {
			res = inputEmojiName
		} else if (combine) {
			res = `${emoji} ${inputEmojiName}`
		} else {
			res = emoji
		}
		resolve(res)
	})
}
