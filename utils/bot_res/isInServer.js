import { SapDiscClient } from '#main'

/**
 * @module isInServer
 * Check if a user is in the server
 */

export async function isInServer(userid) {
    const server = SapDiscClient.guilds.cache.get(`${process.env.server_ID}`)
    var member = server.members.cache.get(`${userid}`)
    if (!member) {
        console.log(`User ${userid} not found in server`)
        return false
    } else {
        console.log(`User ${userid} found in server`)
        return true
    }
}
