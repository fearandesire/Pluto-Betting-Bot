/* eslint-disable no-undef */

import 'dotenv/config'

import monitor from 'pg-monitor'
import pgPromise from 'pg-promise'
import { packageDirectory } from 'pkg-dir'

const rootDir = await packageDirectory()
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

const initOptions2 = {
    query(e) {
        // monitor.query(e) // monitor the event;
    },
    error(err, e) {
        monitor.error(err, e) // monitor the event;
    },
}
monitor.attach(initOptions2) // monitor to log

const { SQLStr } = process.env

//* PG PROMISE SETUP »»»»» */

const sslrootcert = `${rootDir}/ca-certificate.crt`

const cnString = `${SQLStr}sslrootcert=${sslrootcert}`

export const db = pgp(cnString)
