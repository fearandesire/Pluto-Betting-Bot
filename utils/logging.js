/**
 * @file Winston Logging
 */

import fs from 'fs'
import winston, { addColors } from 'winston'
import stringifyObject from 'stringify-object'
import DailyRotateFile from 'winston-daily-rotate-file'

const logDir = 'logs'
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir)
}

const levels = {
    emerg: 0,
    alert: 1,
    crit: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7,
}
const { json, combine, splat, printf, colorize, prettyPrint } = winston.format

addColors({
    info: 'bold blue', // fontStyle color
    warn: 'italic yellow',
    error: 'bold red',
    debug: 'green',
})

// # arrow function to quick-create label + msg object
export const labelMsg = (label, msg) => ({ label, message: msg })

const timestamp = winston.format.timestamp({
    format: 'MM-DD HH:mm:ss',
})

const customWinstonFormat = printf(
    ({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp}: --------    -------- \n${message}\n--------    --------`
        if (JSON.stringify(metadata).length > 2) {
            msg += ` ${JSON.stringify(metadata)}`
        }
        return msg
    },
)

function customTransport(options) {
    const { dirPath, name, combine: joinDate } = options
    let res
    if (dirPath) {
        switch (true) {
            case name !== undefined:
                res = new DailyRotateFile({
                    filename: `logs/${dirPath}/${name}-%DATE%.log`,
                    datePattern: 'YYYY-MM-DD',
                })
                break
            default:
                break
        }
    }
    if (!dirPath) {
        res = new DailyRotateFile({
            filename: `logs/${name}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
        })
    }
    return res
}

// # Console Format
const consoleFormat = combine(
    splat(),
    colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:MM:SS' }),
    printf((...args) => {
        const data = args[0]
        let msg
        const dataLabel = data?.label
            ? `[${data.level}: ${data.label}]`
            : `[${data.level}]`
        // # Check if data.message contains an object and stringify it
        if (typeof data.message === 'object') {
            msg = `${dataLabel} [${data.timestamp}]\nContext: ->\n${stringifyObject(
                data.message,
                {
                    indent: '  ',
                    singleQuotes: true,
                },
            )}`
        } else {
            msg = `${dataLabel} [${data.timestamp}]\nContext: ->\n${data.message}`
        }
        return msg
    }),
)

const consoleTransport = new winston.transports.Console({
    format: combine(consoleFormat),
})

// # Global Format Config
const FORMAT = combine(
    splat(),
    prettyPrint({
        colorize: true,
        depth: 5,
    }),
    timestamp,
    json(),
)

export const debugLog = winston.createLogger({
    levels: winston.config.syslog.levels,
    format: FORMAT,
    transports: [
        new winston.transports.File({
            filename: 'logs/debug/error/globalDebugErrors.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/debug/globalDebug.log',
            format: FORMAT,
        }),
        consoleTransport,
    ],
})

export const gameChanImg = winston.createLogger({
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
            filename: 'logs/faError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/gameChanImg.log' }),
    ],
})

export const overallLog = winston.createLogger({
    levels: winston.config.syslog.levels,
    format: FORMAT,
    transports: [
        new winston.transports.File({
            filename: 'logs/global/error/testing.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/global/testing.log' }),
        consoleTransport,
    ],
})

export const memLog = winston.createLogger({
    levels: winston.config.syslog.levels,
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
            filename: 'logs/system/error.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/system/memory.log' }),
        consoleTransport,
    ],
})

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
export const allClosingLogs = winston.createLogger({
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
            filename: 'logs/closeBetOp/err/closeBetLog.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/allClosingLogs.log',
        }),
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
    levels,
    format: FORMAT,
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/err/2. checkCompletedErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/0. allClosingInfo.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/2. checkCompleted.log',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/0. allClosingInfo.log',
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
            filename: 'logs/closeBetOp/err/5. deleteBetArrErr.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/5. deleteBetArr.log',
        }),
    ],
})
export const collectOddsLog = winston.createLogger({
    levels,
    format: FORMAT,
    transports: [
        new winston.transports.File({
            filename: 'logs/collectOddsErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/collectOdds.log' }),
    ],
})
export const storeMatchupsLog = winston.createLogger({
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
            filename: 'logs/storeMatchupsErr.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/storeMatchups.log' }),
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
    levels: winston.config.syslog.levels,
    format: FORMAT,
    transports: [
        customTransport({
            dirPath: `dailyOps`,
            name: 'completedReq',
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
            filename: 'logs/closeBetOp/err/3.5 betsFromIdErr.log',
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
            filename: 'logs/closeBetOp/locateMatchupId.log',
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

export const completedDebug = winston.createLogger({
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
            filename: 'logs/closeBetOp/err/completedDebug.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/0. allClosingInfo.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/completedDebug.log',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/0. allClosingInfo.log',
        }),
    ],
})

export const closeBetLog = winston.createLogger({
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
            filename: 'logs/closeBetOp/err/closeBet.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/closeBet.log',
        }),
    ],
})
export const apiReqLog = winston.createLogger({
    level: 'info',
    format: FORMAT,
    transports: [
        new winston.transports.File({
            filename: 'logs/closeBetOp/err/apiReq.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/closeBetOp/apiReq.log',
        }),
    ],
})
