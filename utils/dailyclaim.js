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

export function dailyclaim() {
    const ClaimCooldown = 86400000 //* 24 hours in milliseconds
    LogBorder()
    LogYellow(`[dailyclaim.js] Loading User Daily Claim Status from Database`)

    /**
     - @QueryDB - settings to query the postgreSQL server
     ////SELECT * FROM currency -- queries database for all rows in currency table
     */
    const QueryDB = {
        name: 'dailyclaimDB',
        text: `SELECT dailyclaim FROM currency WHERE userid = '208016830491525120'`,

    }
    //? A Promise is required to process these kinds of requests.
    const nodepoolPromise = new Promise((err, res) => {

        nodepool.query(QueryDB, (err, res) => {
            if (err) {
                LogBorder()
                LogRed(`[dailyclaim.js] Error: ${err}`)
                console.log(err)
            } else {
                const dbresp = res.rows[0]
                if (dbresp == false) {
                    LogBorder()
                    LogRed(`[dailyclaim.js] Daily Claim Status for user is false.`)
                    return;
                } else {
                    LogBorder()
                    LogGreen(`[dailyclaim.js] User Found in Database`)
                    LogGreen(JSON.stringify(dbresp))
                }
            }


        })
    })
}