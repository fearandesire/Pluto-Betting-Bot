/* eslint-disable no-undef */
import 'dotenv/config';
import * as pg from 'pg';
var dbUser = process.env.SQLusername
var dbIP = process.env.SQLiPAddress
var dbPass = process.env.SQLPass
var dbPort = process.env.SQLPort

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

export { Pool };

