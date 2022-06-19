/* eslint-disable no-undef */
import 'dotenv/config';
import * as pg from 'pg';
//? Importing pg-promise -- this is how it is done for ES6
import monitor from 'pg-monitor';
import pgPromise from 'pg-promise';
const initOptions = {
    connect: true,
    disconnect: true,
    query: true,
    error: true,
    task: true,
    transact: true,
};
const pgp = pgPromise(initOptions);

//* Logging pg-promise events with pg-monitor */
monitor.attach(initOptions);

var dbUser = process.env.SQLusername
var dbIP = process.env.SQLiPAddress
var dbPass = process.env.SQLPass
var dbPort = process.env.SQLPort

//? node post-gres connection [depricated]
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

export {
    Pool
};


/* ««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««««« */

//* PG PROMISE SETUP »»»»» */
// const cn = {
//     host: process.env.SQLiPAddress,
//     port: process.env.SQLPort,
//     database: 'plutodb',
//     user: process.env.SQLusername,
//     password: process.env.SQLPass,
//     max: 30 // use up to 30 connections

//     // "types" - in case you want to set custom type parsers on the pool level
// };

const cnString = `postgres://${process.env.SQLusername}:${process.env.SQLPass}@${process.env.SQLiPAddress}:${process.env.SQLPort}/plutodb`;

export const db = pgp(cnString);