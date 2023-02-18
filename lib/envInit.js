/**
 * @fileoverview
 * This file is used to initialize the environment for the application.
 */

import * as dotenv from 'dotenv'
import { teamList } from "./teamList.js"

// # SERVERNAME is declared in the package.json `npm run` scripts
console.log(`[Server] ${process.env[`SERVERNAME`]}`)

// ? This enables the ability to switch the .env files based on the npm script ran aka the distro selected to launch.
let envPath = process.env.SERVERNAME === 'nfl' ? './.env.nflc' : process.env.SERVERNAME === 'nba' ? './.env.nbac' : './.env.dev'
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
        console.log(`[Startup]: Init Express Server\nPort: ${process.env.EXP_PORT}!`)
    })
     
}



// ? Exporting env variable constants since dotenv is used here

// # Team list for either team
export const teams = process.env.SERVERNAME === 'nfl' ? teamList.nfl : process.env.SERVERNAME === 'nba' ? teamList.nba : teamList.nba



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