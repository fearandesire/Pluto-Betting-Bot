import Promise from 'bluebird'
import _ from 'lodash'
import { SapDiscClient } from '#main'

/**
 * @module findEmoji
 * @summary Find an emoji by name; The matchups usually have an emoji named after each participant.
 * @param {string} inputEmojiName - The name of the emoji to find
 * @var SapDiscClient - The Discord client; Used to cache Discord and locate our emoji's here.
 * @returns {object | null} - The emoji object if found, null if not.
 */

export async function findEmoji(inputEmojiName, combine) {
	return new Promise(async (resolve, reject) => {
		let res
		// Find an emoji by name, retrieve the closest match
		const emoji =
			(await SapDiscClient.emojis.cache.find((foundEmoji) => {
				const lowerEmojiName = _.toLower(inputEmojiName)
				const lowerEmoji = _.toLower(foundEmoji.name)
				return (
					lowerEmoji.includes(lowerEmojiName) ||
					lowerEmojiName.includes(lowerEmoji)
				)
			})) || null

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
