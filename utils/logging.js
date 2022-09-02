//? convert this to ES6 import

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
        let msg = `${timestamp}: ${message}`
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
export const deleteBetLog = winston.createLogger({
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
            filename: 'logs/deleteBetLogError.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/deleteBetLog.log' }),
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
        new winston.transports.File({ filename: 'logs/globalLog.log' }),
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
        new winston.transports.File({ filename: 'logs/fileRunLog.log' }),
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
        new winston.transports.File({ filename: 'logs/registerUserLog.log' }),
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
        new winston.transports.File({ filename: 'logs/betSlipLog.log' }),
    ],
})
