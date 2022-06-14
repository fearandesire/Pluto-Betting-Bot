/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import {
    container
} from '@sapphire/framework';
import 'dotenv/config';
import {
    LogBorder,
    LogGreen,
    LogRed,
    LogYellow
} from './../utils/ConsoleLogging.js';
container.dbVal = {};

var dbUser = process.env.SQLusername
var dbIP = process.env.SQLiPAddress
var dbPass = process.env.SQLPass
var dbPort = process.env.SQLPort


//* ACCESSING POSTGRE DB WITH NODE-POSTGRES »»»»»»»»» */

import * as pg from 'pg';
const {
    Pool
} = pg.default
export const nodepool = new Pool({
    user: dbUser,
    host: dbIP,
    database: 'plutodb',
    password: dbPass,
    port: dbPort
})

export function updateclaim(userid, lastTime) {

    LogBorder()
    LogYellow(`[updateclaim.js] Creating User Identity`)

    /**
     - @QueryDB - settings to query the postgreSQL server
     - @text INSERT query -- inserts a new row into the currency table
     */
    const QueryDB = {
        name: 'updateDB',
        text: `UPDATE currency SET lastclaimtime = '${lastTime}' WHERE userid = '${userid}'`}
    //? A Promise is required to process these kinds of requests.
    const nodepoolPromise = new Promise((err, res) => {

        nodepool.query(QueryDB, (err, res) => {
            //? If DB connects, but an error in the query occurs
            if (err) {
                LogBorder()
                LogRed(`[updateclaim.js] Error: ${err}`)
                console.log(err)
            } else {
                //? If DB connects, and the user ID was not found in the user identity table, creates a new user
                LogGreen(`[updateclaim.js] User ID: ${userid}`)
                LogGreen(`[updateclaim.js] User Claim Time: ${lastTime}`)
            }


        })
    })
}