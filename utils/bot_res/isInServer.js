import { SapDiscClient } from '#main'

/**
 * @module isInServer
 * Check if a user is in the server
 * @param {string} userID - The user ID to check
 * @returns {boolean} - Returns true if the user is in the server, false if not
 */

export async function isInServer(userid) {
    const server = await SapDiscClient.guilds.cache.get(
        `${process.env.server_ID}`,
    )
    var findCache = await server.members.fetch().then((members) => {
        var member = server.members.cache.get(`${userid}`)
        // # Ensure the user is not a bot
        if (member.user.bot) {
            console.log(`User ${userid} is a bot`)
            return false
        }
        if (member == undefined) {
            console.log(`User ${userid} not found in server`)
            return false
        } else {
            console.log(`User ${userid} found in server`)
            return true
        }
    })
    return findCache
}
