import _ from 'lodash'
import { SapDiscClient } from '../../Pluto.js'

/**
 * Find an emoji by name and retrieve the closest match.
 *
 * @param {string} inputEmojiName - The name of the emoji to search for.
 * @param {boolean} combine - Whether to combine the emoji with the inputEmojiName.
 * @return {Promise<string>} A promise that resolves to the closest match emoji or a combined string.
 */
export async function findEmoji(inputEmojiName: string, combine?: boolean) {
	let emojiSearchName
	if (inputEmojiName.includes(' ')) {
		emojiSearchName = _.last(_.split(inputEmojiName, ' '))
	} else {
		emojiSearchName = inputEmojiName
	}
	// Convert input to lowercase for case-insensitive comparison
	const lowerEmojiName = _.toLower(emojiSearchName)

	// First, try to find an emoji with an exact match
	let emoji = SapDiscClient.emojis.cache.find((foundEmoji) => {
		if (!foundEmoji?.name) return false
		return _.toLower(foundEmoji.name) === lowerEmojiName
	})

	// If no exact match is found, retrieve the closest match
	if (!emoji) {
		emoji = SapDiscClient.emojis.cache.find((foundEmoji) => {
			if (!foundEmoji?.name) return false
			const lowerEmoji = _.toLower(foundEmoji.name)
			return (
				lowerEmoji.includes(lowerEmojiName) ||
				lowerEmojiName.includes(lowerEmoji)
			)
		})
	}

	// Handle the combination or return the emoji
	if (emoji) {
		return combine ? `${emoji} ${emojiSearchName}` : emoji
	}
	return combine ? emojiSearchName : ''
}
