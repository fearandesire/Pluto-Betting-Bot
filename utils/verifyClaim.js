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
} from './ConsoleLogging.js';
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

export function verifyClaim(userid) {

    LogBorder()
    LogYellow(`[verifyClaim.js] Loading User Last Daily Claim Time from Database`)

    /**
     - @QueryDB - settings to query the postgreSQL server
     ////SELECT * FROM currency -- queries database for all rows in currency table
     */
    const QueryDB = {
        name: 'claimTimeStatus',
        text: `SELECT lastclaimtime FROM currency WHERE userid = '${userid}'`,

    }
    //? A Promise is required to process these kinds of requests.
    const nodepoolPromise = new Promise((err, res) => {

        nodepool.query(QueryDB, (err, res) => {
            if (err) {
                LogBorder()
                LogRed(`[verifyClaim.js] Error: ${err}`)
                console.log(err)
            } else {
                const dbresp = res.rows[0]
                if (dbresp == false || dbresp == undefined || dbresp == null) {
                    LogBorder()
                    LogRed(`[verifyClaim.js] User ${userid} has no record of using the claim command in the databse.`)
                    return false;
                } else {
                    LogBorder()
                    LogGreen(`[verifyClaim.js] User [${userid}] has used the claim command prior!`)
                    LogGreen(`DB Response: ${dbresp.lastclaimtime}`)
                    return true;
                }
            }


        })
    })
}