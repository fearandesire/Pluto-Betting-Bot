import {
    container
} from '@sapphire/framework';
import Router from "express-promise-router";
import {
    LogGreen
} from './ConsoleLogging.js';
import { retrieveClaimTimes } from './retrieveClaimTimes.js';
const router = Router();

export async function ClaimCooldown() {
    LogGreen(`[cooldownmath.js] Running Cooldown Math!`)
    const lastTime = container.lastTime
    const userid = 208016830491525120
    var currentTime = new Date().getTime();
    var limit = 5000;
    if (!container.ClaimTimes[`${userid}`]) {
        const getClaimTime = async () => {
            try {
                retrieveClaimTimes(userid);
            } catch (error) {
                console.log(error)
            }
            return;
        }
        getClaimTime().then((res) => {
        return res;
        })
    }
    return container.ClaimTimes[`${userid}`];
    //let notOnCooldown = currentTime - retrieveTime > limit;
    // LogBorder();
    // LogYellow(`Variables: ${currentTime}, ${container.lastclaimtime}`)
    // LogYellow(`Equation: ${currentTime - container.lastuserTime} > ${limit}`)
}