import {
    container
} from "@sapphire/pieces";
import {
    LogBorder,
    LogGreen,
    LogYellow
} from './ConsoleLogging.js';
import {
    retrieveClaimTime
} from "./retrieveClaimTime.js";
export async function ClaimCooldown() {
    const lastTime = container.lastTime
    const userid = 208016830491525120
    var currentTime = new Date().getTime();
    var limit = 5000;
    const retrieveTime = retrieveClaimTime(userid)
    //let notOnCooldown = currentTime - retrieveTime > limit;
    LogBorder();
    LogGreen(`[cooldownmath.js] Running Cooldown Math!`)
    retrieveTime.then(() => {
        LogYellow(`Variables: ${currentTime}, ${container.lastusertime}`)
        LogYellow(`Equation: ${currentTime - container.lastusertime} > ${limit}`)
    })


}