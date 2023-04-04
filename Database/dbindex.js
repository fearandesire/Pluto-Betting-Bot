/* eslint-disable no-undef */

import * as pg from 'pg'

import monitor from 'pg-monitor'
import pgPromise from 'pg-promise'

const initOptions = {
	// options for PG promise using initPromise
	connect: true,
	disconnect: true,
	query: true,
	error: true,
	task: true,
	transact: true,
}
const pgp = pgPromise(initOptions) // initialises options

//* Logging pg-promise events with pg-monitor */
monitor.attach(initOptions) // monitor to log

const dbUser = process.env.SQLusername
const dbIP = process.env.SQLiPAddress
const dbPass = process.env.SQLPass
const dbPort = process.env.SQLPort
const dbName = process.env.SQLdb

const { Pool } = pg.default

export const nodepool = new Pool({
	user: dbUser,
	host: dbIP,
	database: dbName,
	password: dbPass,
	port: dbPort,
})

export { Pool }

//* PG PROMISE SETUP »»»»» */
const cnString = `postgres://${process.env.SQLusername}:${process.env.SQLPass}@${process.env.SQLiPAddress}:${process.env.SQLPort}/${process.env.SQLdb}`
export const db = pgp(cnString)
