/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import {
    container
} from '@sapphire/framework';
import 'dotenv/config';
import {
    LogBorder, LogRed,
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

export async function retrieveClaimTime(userid) {

    LogBorder()
    LogYellow(`[retrieveClaimTime.js] Loading User Last Daily Claim Time from Database`)
    /**
     - @QueryDB - settings to query the postgreSQL server
     - @text SELECT cell lastclaimtime in the currency table via the userid -> so we can check if the user has ever used claim
     */
    const QueryDB = {
        name: 'retrieveClaimTime',
        text: `SELECT lastclaimtime FROM currency WHERE userid = '${userid}'`,

    }
    //? A Promise is required to process these kinds of requests.
    const nodepoolPromise = new Promise((err, res) => {

        nodepool.query(QueryDB, (err, res) => {
            if (err) {
                LogBorder()
                LogRed(`[retrieveClaimTime.js] Error: ${err}`)
                console.log(err)
            } else {
                const dbresp = res.rows[0]
                    container.lastuserTime = parseInt(dbresp.lastclaimtime)
                    var lastusertime = container.lastuserTime
                    LogYellow(`[retrieveClaimTime.js] User ${userid} last claim time is ${lastusertime}`)
                    //return;
                }
            
        });
    })

}