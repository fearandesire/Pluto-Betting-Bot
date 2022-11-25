import { SapDiscClient } from '#main'

/**
 * @module findEmoji
 * @summary Find an emoji by name; The matchups usually have an emoji named after each participant.
 * @param {string} emojiName - The name of the emoji to find
 * @var SapDiscClient - The Discord client; Used to cache Discord and locate our emoji's here.
 * @returns {object | null} - The emoji object if found, null if not.
 */

export async function findEmoji(emojiName) {
    console.log(`searching for emoji: ${emojiName}`)
    // Find an emoji by name
    var emoji = SapDiscClient.emojis.cache.find(
        (e) => e.name === emojiName.toLowerCase(),
    )
    if (!emoji) {
        return null
    }
    return emoji
}
