import _ from 'lodash';
import { SapDiscClient } from '../../index.js';

/**
 * Find an emoji by name and retrieve the closest match.
 *
 * @param {string} inputEmojiName - The name of the emoji to search for.
 * @param {boolean} combine - Whether to combine the emoji with the inputEmojiName.
 * @return {Promise<string>} A promise that resolves to the closest match emoji or a combined string.
 */
export async function findEmoji(inputEmojiName: string, combine?: boolean) {
	// Normalize the input name
	const emojiSearchName = normalizeEmojiName(inputEmojiName);

	// Convert input to lowercase for case-insensitive comparison
	const lowerEmojiName = emojiSearchName.toLowerCase();

	// First, try to find an emoji with an exact match
	let emoji = SapDiscClient.emojis.cache.find((foundEmoji) => {
		if (!foundEmoji?.name) return false;
		return foundEmoji.name.toLowerCase() === lowerEmojiName;
	});

	// If no exact match is found, try matching with numbers
	if (!emoji && /\d/.test(lowerEmojiName)) {
		emoji = SapDiscClient.emojis.cache.find((foundEmoji) => {
			if (!foundEmoji?.name) return false;
			// Special handling for numeric team names (e.g. 76ers)
			return (
				foundEmoji.name.toLowerCase().replace(/[\s_-]/g, '') ===
				lowerEmojiName.replace(/[\s_-]/g, '')
			);
		});
	}

	// If still no match, try partial matches
	if (!emoji) {
		emoji = SapDiscClient.emojis.cache.find((foundEmoji) => {
			if (!foundEmoji?.name) return false;
			const lowerEmoji = foundEmoji.name.toLowerCase();
			return (
				lowerEmoji.includes(lowerEmojiName) ||
				lowerEmojiName.includes(lowerEmoji)
			);
		});
	}

	// Handle the combination or return the emoji
	if (emoji) {
		return combine ? `${emoji} ${inputEmojiName}` : emoji.toString();
	}
	return combine ? inputEmojiName : '';
}

/**
 * Normalizes an emoji name by handling special cases and removing unnecessary characters
 * @param name The emoji name to normalize
 * @returns The normalized emoji name
 */
function normalizeEmojiName(name: string): string {
	let normalizedName = name;

	// If name contains spaces, take the last part (e.g. "Toronto Raptors" -> "Raptors")
	if (normalizedName.includes(' ')) {
		normalizedName = _.last(_.split(normalizedName, ' ')) || normalizedName;
	}

	// Remove any colons that might be in the name
	normalizedName = normalizedName.replace(/:/g, '');

	// Handle special cases for team names with numbers
	if (/\d/.test(normalizedName)) {
		normalizedName = normalizedName.replace(/[\s_-]/g, '').toLowerCase();
	}

	return normalizedName;
}
