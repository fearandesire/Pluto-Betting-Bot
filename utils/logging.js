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
		new winston.transports.File({ filename: 'logs/deleteBetLog.' }),
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
			filename: 'logs/checkCompletedErr.log',
			level: 'error',
		}),
		new winston.transports.File({ filename: 'logs/checkCompleted.log' }),
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
			filename: 'logs/initCloseBetErr.log',
			level: 'error',
		}),
		new winston.transports.File({ filename: 'logs/initCloseBet.log' }),
	],
})
export const closeBetsLog = winston.createLogger({
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
			filename: 'logs/closeBetsErr.log',
			level: 'error',
		}),
		new winston.transports.File({ filename: 'logs/closeBets.log' }),
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
			filename: 'logs/deleteBetArrErr.log',
			level: 'error',
		}),
		new winston.transports.File({ filename: 'logs/deleteBetArr.log' }),
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
			filename: 'logs/completedReqErr.log',
			level: 'error',
		}),
		new winston.transports.File({ filename: 'logs/completedReq.log' }),
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
