/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import {
  container
} from '@sapphire/framework';
import 'dotenv/config';
import express from "express";
import Router from "express-promise-router";
import { nodepool } from '../Database/dbindex.js';
import {
  LogBorder, LogRed, LogYellow
} from './ConsoleLogging.js';
container.dbVal = {};

const app = express();
const router = Router();

//* ACCESSING POSTGRE DB WITH NODE-POSTGRES »»»»»»»»» */
export async function retrieveClaimTimes(userid) {
    container.lastusertime = 0;
    LogBorder()
    LogYellow(`[retrieveClaimTimes.js] Loading User Last Daily Claim Time from Database`)
    // //? A Promise is required to process these kinds of requests.
        const newquery = await nodepool.query(`SELECT * FROM currency WHERE userid = ${userid}`, (err, res) => {
          if (err) {
            LogBorder();
            LogRed(`[retrieveClaimTimes.js] Error: ${err}`)
            LogBorder();
            return;
          } else {
                const dbresp = res.rows[0]
                    // let claimResp = parseInt(dbresp.lastclaimtime)
                    // container.lastuserTime = parseInt(dbresp.lastclaimtime)
                    // let lastusertime = container.lastuserTime
                    // //LogYellow(`[retrieveClaimTimes.js] User ${userid} last claim time is ${container.lastuserTime}`)
                    // //LogYellow(lastusertime)
                    // LogYellow(`[retrieveClaimTimes.js] Collected & Stored Claim Times.`)
                    // container.ClaimTimes[`${userid}`] = claimResp
                    //console.log(dbresp)
                    return  //lastusertime;

            
        }})

}

