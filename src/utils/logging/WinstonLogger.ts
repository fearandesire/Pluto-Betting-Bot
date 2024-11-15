import winston, { format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from '../../lib/startup/env.js';
import { WinstonTransport as AxiomTransport } from '@axiomhq/winston';
const isProduction = env.NODE_ENV === 'production';
const { AXIOM_DATASET, AXIOM_API_TOKEN, AXIOM_ORG_ID } = env;

// Core Winston Config
const coreWinstonConfig = {
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.metadata({
			fillExcept: ['message', 'level', 'timestamp', 'stack'],
		}),
		winston.format.json(),
	),
};

// Shared Config between Winston Transports
const baseWinstonConfig = {
	...coreWinstonConfig,
	datePattern: 'YYYY-MM-DD',
	zippedArchive: false,
	maxFiles: '14d',
	maxSize: '80MB',
};

const winstonConsoleConfig = {
	format: winston.format.combine(
		winston.format.cli(),
		winston.format.colorize({
			all: true,
		}),
		winston.format.timestamp(),
		winston.format.printf(
			({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`,
		),
	),
};

const createDailyRotateFileTransport = (level: string, filename: string) => {
	return new DailyRotateFile({
		level,
		filename: `logs/%DATE%-${filename}.log`,
		...baseWinstonConfig,
	});
};

const consoleTransport = new winston.transports.Console({
	...winstonConsoleConfig,
});

const transports: winston.transport[] = [
	createDailyRotateFileTransport('error', 'error'),
	createDailyRotateFileTransport('info', 'standard'),
	consoleTransport,
];

if (!isProduction) {
	transports.push(createDailyRotateFileTransport('debug', 'debug'));
}

const axiomTransport = new AxiomTransport({
	dataset: AXIOM_DATASET,
	token: AXIOM_API_TOKEN,
	orgId: AXIOM_ORG_ID,
	...coreWinstonConfig,
});

// Create and export the Winston logger instance
export const WinstonLogger = winston.createLogger({
	defaultMeta: {
		source_application: `PLUTO_${env.NODE_ENV.toUpperCase()}`,
		environment: env.NODE_ENV,
	},
	transports: [axiomTransport, ...transports],
	exitOnError: false,
});
