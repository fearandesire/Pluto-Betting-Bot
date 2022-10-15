/**
 * @file Winston Logging
 */

import fs from 'fs'
import winston from 'winston'

var logDir = 'log' // directory path you want to set
if (!fs.existsSync(logDir)) {
    // Create the directory if it does not exist
    fs.mkdirSync(logDir)
}

const { level, combine, splat, printf } = winston.format

let timestamp = winston.format.timestamp({
    format: 'MM-DD HH:mm:ss',
})
const customWinstonFormat = printf(
    ({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp}: - Logging - \n${message}`
        if (JSON.stringify(metadata).length > 2) {
            msg += ` ${JSON.stringify(metadata)}`
        }
        return msg
    },
)

export const addNewBetLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/addNewBotError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/addNewBet.log' }),
    ],
})
export const validateExistingUserLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/validateExistingUserError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/validateExistingUser.log' }),
    ],
})
export const processDailyClaimLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/processDailyClaimError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/processDailyClaim.log' }),
    ],
})
export const globalLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/globalLogError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/global.log' }),
    ],
})
export const fileRunLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/fileRunLogError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/fileRun.log' }),
    ],
})
export const registerUserLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/registerUserLogError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/registerUser.log' }),
    ],
})
export const betSlipLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/betSlipLogError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/betSlip.log' }),
    ],
})

export const checkCompletedLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/err/2. checkCompletedErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/2. checkCompleted.log',
        }),
    ],
})
export const initCloseBetLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/err/3. initCloseBetErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/3. initCloseBet.log',
        }),
    ],
})
export const closeMatchupsLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/4. closeMatchups.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/4. closeMatchups.log',
        }),
    ],
})
export const deleteBetArrLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/Err/5. deleteBetArrErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/5. deleteBetArr.log',
        }),
    ],
})
export const collectOddsLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/collectOddsErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/collectOdds.log' }),
    ],
})
export const createMatchupsLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/createMatchupsErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/createMatchups.log' }),
    ],
})
export const gatherOddsLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/gatherOddsErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/gatherOdds.log' }),
    ],
})

export const scheduleReqLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/scheduleReqErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/scheduleReq.log' }),
    ],
})
export const completedReqLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/Err/completedReqErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/1. completedReq.log',
        }),
    ],
})
export const resolveMatchupLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/resolveMatchupErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/resolveMatchup.log' }),
    ],
})
export const resolveOddsLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/resolveOddsErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/resolveOdds.log' }),
    ],
})
export const resolveTeamLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/resolveTeam/resolveTeamErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/resolveTeam/resolveTeam.log',
        }),
    ],
})
export const betsFromIdLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/Err/3.5 betsFromIdErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/3.5 betsFromId.log',
        }),
    ],
})

export const giveMoneyLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/giveMoneyErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/giveMoney.log',
        }),
    ],
})
export const setupBetLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/setupBetErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/setupBe.log',
        }),
    ],
})
export const valUserLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/valUserErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/valUserLog.log',
        }),
    ],
})
export const removeMatchLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/removeMatchErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/removeMatchLog.log',
        }),
    ],
})
export const trackProgressLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/trackProgressErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/trackProgres.log',
        }),
    ],
})
export const dmLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/err/dmErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/dmLog.log',
        }),
    ],
})
export const locateMatchupIdLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/err/locateMatchupId.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/locateMatchupId.log',
        }),
    ],
})
export const createChanLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/gameChan/err/createChannel.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/gameChan/createChannel.log',
        }),
    ],
})
export const scheduleChanLog = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        splat(),
        winston.format.prettyPrint({
            colorize: true,
            depth: 5,
        }),
        timestamp,
        customWinstonFormat,
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/gameChan/err/scheduleChan.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/gameChan/scheduleChan.log',
        }),
    ],
})
