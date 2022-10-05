/* eslint-disable no-undef */

import 'dotenv/config'

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
const pgp = pgPromise(initOptions) //initialises options

//* Logging pg-promise events with pg-monitor */
monitor.attach(initOptions) // monitor to log

var dbUser = process.env.SQLusername
var dbIP = process.env.SQLiPAddress
var dbPass = process.env.SQLPass
var dbPort = process.env.SQLPort

//? node post-gres connection [deprecated]
const { Pool } = pg.default

export const nodepool = new Pool({
    user: dbUser,
    host: dbIP,
    database: 'plutodb',
    password: dbPass,
    port: dbPort,
})

export { Pool }

//* PG PROMISE SETUP »»»»» */
const cnString = `postgres://${process.env.SQLusername}:${process.env.SQLPass}@${process.env.SQLiPAddress}:${process.env.SQLPort}/plutodb`
export const db = pgp(cnString)
