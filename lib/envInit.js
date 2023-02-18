/**
 * @fileoverview
 * This file is used to initialize the environment for the application.
 */

import * as dotenv from 'dotenv'
import { teamList } from "./teamList.js"

console.log(`[Server] ${process.env[`SERVERNAME`]}`)
let envPath = process.env.SERVERNAME === 'nfl' ? './.env.nflc' : './.env.nbac'
dotenv.config({ path: envPath, override: true }, )

import bodyParser from 'body-parser'
import express from 'express'
import { createRequire } from 'module'
// use require in ES6
const require = createRequire(import.meta.url)

const app = express()
console.log(`[Startup]: Initializing Pluto\nEnv Path: ${envPath}`)
export async function startExpress() {
    app.use(require('express-status-monitor')())
    app.use(bodyParser.json()) // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
    
    app.listen(process.env.EXP_PORT, () => {
        console.log(`[Startup]: Express Server listening on port ${process.env.EXP_PORT}!`)
    })
     
}


// # Team list for either team
export const teams = process.env.SERVERNAME = 'nfl' ? teamList.nfl : teamList.nba

let SCHEDULE_TIMER = process.env.SCHEDULE_TIMER
let CHECK_COMPLETED_TIMER = process.env.CHECK_COMPLETED_TIMER
let LIVEMATCHUPS = process.env.LIVEMATCHUPS
let LIVEBETS = process.env.LIVEBETS
let BETSLIPS = process.env.BETSLIPS
let PROFILE = process.env.PROFILE
let PENDING = process.env.PENDING
let SCORE = process.env.SCORE
let ODDS = process.env.ODDS
let CURRENCY = process.env.CURRENCY
export {
    SCHEDULE_TIMER,
    CHECK_COMPLETED_TIMER,
    LIVEMATCHUPS,
    LIVEBETS,
    BETSLIPS,
    PROFILE,
    PENDING,
    SCORE,
    ODDS,
    CURRENCY,
}