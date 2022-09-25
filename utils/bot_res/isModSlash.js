import { modRoles } from '#config'

/** 
import { modRoles } from '#config';
* Compare user's roles to mod roles listed in the config file (./lib/PlutoConfig.js)
* @param {object} interaction - The interaction / message object from Discord.
* @return {boolean} Returns true or false if the user is a mod or not
*/
export async function isModSlash(interaction) {
    var userRoles = interaction.member._roles
    console.log(userRoles)
    console.log(modRoles)
    //# compare user's roles to mod roles listed in the config file
    for (var i = 0; i < userRoles.length; i++) {
        if (modRoles.includes(userRoles[i])) {
            return true
        }
        if (i === userRoles.length - 1 && !modRoles.includes(userRoles[i])) {
            return false
        }
    }
}
