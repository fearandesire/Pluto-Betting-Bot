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
import { createuser } from './createuser.js';
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

export function useridentity() {
    const userid = '208016830491525120'
    LogBorder()
    LogYellow(`[useridentity.js] Loading User Identity from Database`)

    /**
     - @QueryDB - settings to query the postgreSQL server
     SELECT * FROM currency -- queries database for all rows in currency table
     */
    const QueryDB = {
        name: 'currencydb',
        text: `SELECT userid FROM currency WHERE userid = '${userid}'`,

    }
    //? A Promise is required to process these kinds of requests.
    const nodepoolPromise = new Promise((err, res) => {

        nodepool.query(QueryDB, (err, res) => {
            //? If DB fails to connect to requested table
            if (err) {
                LogBorder()
                LogRed(`[useridentity.js] Error: ${err}`)
                console.log(err)
            } else {
                //? If DB connects, but the user ID was not found in the user identity table
                const dbresp = res.rows[0]
                if (dbresp == undefined || dbresp == null) {
                    LogBorder()
                    LogRed(`[useridentity.js] No User Found in Database -- Creating User`)
                    createuser(userid)
                    return;
                } else {
                    //? User existing in DB
                    LogBorder()
                    LogGreen(`[useridentity.js] User Found in Database`)
                    LogGreen(JSON.stringify(dbresp))
                }
            }


        })
    })
}