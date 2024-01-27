import axios from 'axios'
/**
 * @module resolveUsername
 * @summary Resolve a Discord user's username, even if they have left the server.
 */
export async function resolveUsername(userId) {
    let res
    try {
        const response = await axios.get(`https://discord.com/api/users/${userId}`)
        console.log(`Res -> `, response)
        res = response.data.username
    } catch (error) {
        console.error(`Error fetching user name: ${error}`)
        res = false
    }
    return res
}
