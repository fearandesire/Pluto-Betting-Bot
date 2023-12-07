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
	// Take last word if there's spaces
	let emojiSearchName

	if (inputEmojiName.includes(' ')) {
		emojiSearchName = await _.last(
			_.split(inputEmojiName, ' '),
		)
	} else {
		emojiSearchName = inputEmojiName
	}
	// Convert input to lowercase for case-insensitive comparison
	const lowerEmojiName = _.toLower(emojiSearchName)

	// Find an emoji by name, retrieve the closest match
	const emoji = SapDiscClient.emojis.cache.find(
		(foundEmoji) => {
			const lowerEmoji = _.toLower(foundEmoji.name)
			return (
				lowerEmoji.includes(lowerEmojiName) ||
				lowerEmojiName.includes(lowerEmoji)
			)
		},
	)

	// Handle the combination or return the emoji
	if (emoji) {
		return combine
			? `${emoji} ${emojiSearchName}`
			: emoji
	}
	return combine ? emojiSearchName : ''
}
