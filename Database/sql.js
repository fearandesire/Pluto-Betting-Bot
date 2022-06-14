/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import {
  container
} from '@sapphire/framework';
import 'dotenv/config';
import { LogBorder, LogGreen, LogYellow } from './../utils/ConsoleLogging.js';
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
  
  
  export async function LoadDBs() {
    LogBorder()
    LogYellow(`[LoadDB.js] Loading Daily Schedule from Database`)
  /**
   - @QueryDB - settings to query the postgreSQL server
  
   */


    const QueryDB = {
        name:'accessdb',
        text: 'SELECT * FROM test1',

    }
    //? A Promise is required to process these kinds of requests.
    const nodepoolPromise = new Promise((err, res) => {
  
      nodepool.query(QueryDB, (err, res) => {
        if (err) {
        LogGreen(`[LoadDB.js] Error: ${err}`)
          console.log(err)
        } else {
            const dbre = res.rows[0].botName
            LogGreen(dbre)   
            const dbres = res.rows[1].botName
            LogGreen(dbres)  
        }
        
  
      })
    })
  }