/**
 * @module isMod
 * Check user permissions for the guild and verify if they are a moderator [Kick members permission]
 * @param {object} interaction - The Discord interaction object - we use it here to collect the user permissions via their ID
 */

export async function isMod(interaction) {
    var userid = interaction.user.id
    //# get user permissions via the guild
    var userPerms = interaction.guild.members.cache.get(userid).permissions
    //# check if the user has permission to kick members aka Mod Requirement
    if (userPerms.has('KICK_MEMBERS')) {
        return true
    } else {
        return false
    }
}
