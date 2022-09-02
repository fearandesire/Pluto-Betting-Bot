import { betSlipLog } from '../../logging.js'

//? not used currently
export class BetSlip {
    constructor(betid, userid, username, bettype, betamount, betodds) {
        this.betid = betid
        this.userid = userid
        this.username = username
        this.bettype = bettype
        this.betamount = betamount
        this.betodds = betodds
        betSlipLog.info(
            `\nNew Bet Slip Created!\nBet ID: ${this.betid}\nUser ID: ${this.userid}\nUsername: ${this.username}\nBet Type: ${this.bettype}\nBet Amount: ${this.betamount}\nBet Odds: ${this.betodds}\n`,
        )
    }
}
