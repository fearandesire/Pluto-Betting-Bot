import { SapDiscClient } from '#main'
import { deleteBetFromArray } from '#utilBetOps/deleteBetArr'
import { dmLog } from '../../logging.js'
import { isInServer } from '../../bot_res/isInServer.js'
import { quickBalance } from '../validation/quickBalance.js'
import { removeFromActive } from './removeFromActive.js'

//import { removeUserProfile } from './removeUserProfile.js'

/**
 * @module wonDm
 * Send a DM to the user who won the bet
 */

export async function wonDm(message, betInformation) {
    var userid = betInformation?.userId
    var betid = betInformation?.betId
    var teamBetOn = betInformation?.teamBetOn
    var opposingTeam = betInformation?.opposingTeam
    var betAmount = betInformation?.betAmount
    var payoutAmount = betInformation?.payout
    var profitAmount = betInformation?.profit
    //# verify user is still in the server
    var verifyUser = await isInServer(userid)
    if (verifyUser == false) {
        await dmLog.info(
            `User ${userid} is no longer in the server. Removing bet ${betid} from the database.`,
        )
        // await msgBotChan(
        //     `User ${userid} is no longer in the server. Removing bet ${betid} from the database.`,
        // )
        await removeFromActive(userid, betid)
        //await removeUserProfile(userid)
        await deleteBetFromArray(message, userid, betid, true)
        return
    }
    var newUserBal = await quickBalance(userid)
    var embObj = {
        title: `${teamBetOn} vs. ${opposingTeam}`,
        description: `You won your bet on the ${teamBetOn}!\nHere's your payout info\n\n**You had bet:** $${betAmount}\n**Profit:** $${profitAmount}\n**Payout:** $${payoutAmount}\n**:moneybag: Updated Balance**: $${newUserBal.toFixed(
            2,
        )}`,
        footer: {
            text: `See an issue here? Please contact FENIX#7559 | Bet ID: ${betid}`,
        },
        color: `#3abc2c`,
    }
    //# DM the user the result of their bet
    await SapDiscClient.users.fetch(`${userid}`).then((user) => {
        if (!user) {
            dmLog.error(
                `Failed to send DM to user ${userid} is no longer in the server.`,
            )
            return
        }
        user.send({ embeds: [embObj] })
        dmLog.info(`DM'd ${userid} successfully`)
    })
}