import {
    container
} from '@sapphire/framework';
import express from 'express';
import { nodepool } from '../Database/dbindex.js';
import { LogGreen, LogYellow } from './ConsoleLogging.js';
// import {
//     retrieveClaimTimes
// } from "./retrieveClaimTimes.js";
const app = express();
container.completedMath = false;
export async function RouterTest() {

    const userid = '208016830491525120';
    LogYellow(`[router.js] Running Router Test!`)
    var server = app.listen(8081, function () {
        var host = server.address().address
        var port = server.address().port

        console.log("app listening at http://%s:%s", host, port)
    })

    app.get('/claimtimes', async function (req, res, callback) {
        var dbresponse = await nodepool.query(`SELECT lastclaimtime FROM currency WHERE userid = '${userid}'`);
        var ClaimTime = dbresponse.rows[0].lastclaimtime;
        LogGreen('DB RESPONSE:');
        LogGreen(ClaimTime);
        res.send(ClaimTime);
        callback(ClaimTime)
        container.completedMath = true;
     })
}


    // LogGreen(`[cooldownmath.js] Running Cooldown Math!`)
    // const lastTime = container.lastTime
    // const userid = 208016830491525120
    // var currentTime = new Date().getTime();
    // var limit = 5000;
    // //let notOnCooldown = currentTime - retrieveTime > limit;
    // LogBorder();
    // LogYellow(`Variables: ${currentTime}, ${container.lastuserTime}`)
    // LogYellow(`Equation: ${currentTime - container.lastuserTime} > ${limit}`)
//}