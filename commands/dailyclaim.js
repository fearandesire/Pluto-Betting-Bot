import {
    Command,
    container
} from '@sapphire/framework';
import { updateclaim } from '../utils/addClaimTime.js';
import { LogBorder, LogGreen, LogRed, LogYellow } from '../utils/ConsoleLogging.js';
import { retrieveClaimTime } from '../utils/retrieveClaimTime.js';
import { useridentity } from '../utils/useridentity.js';
import { verifyClaim } from '../utils/verifyClaim.js';
export class DailyClaimCMD extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'dailyclaim',
            aliases: ['claim', 'daily'],
            description: 'Daily Claim',
            requiredUserPermissions: ['KICK_MEMBERS']
        });
    }

    async messageRun(message) {

        //? currentTime is equivilant to Date.now()
        //? We compare the time difference between the current time and the last time the user claimed their daily.
        //? If the difference is greater than our limit (24 Hours in Milliseconds), we can claim their daily.
        //? Otherwise, they are on cooldown.
        const userid = message.author.id;
        const ClaimCooldown = 86400000 //* 24 hours in milliseconds
        var limit = 5000;
        const lastTime = container.lastTime
        var currentTime = new Date().getTime();
        LogBorder();
        LogYellow(`[dailyclaim.js] Running Daily Claim Command!`);

        //? Check if user exists in database, if not create them and then process claim.
        if (useridentity(userid) == false) 
        {
            LogYellow(`[dailyclaimCMD.js] User claim status was false in the database. Processing request`)
            container.lastTime = currentTime;
            //? push lasttime to db
            message.reply('Successfuly Claimed Currency!')
            updateclaim(userid, lastTime)
            return;
        }

        //? Check if user has ever used claim cmd [assumption: user exists in database, we know this from the prior if statement]
        if (verifyClaim(userid) == false) 
        {
            container.lastTime = currentTime;
            updateclaim(userid, lastTime)
            return
        }

        //? Check if user is on cooldown
        let notOnCooldown = currentTime - retrieveClaimTime(userid) > limit;
        if (notOnCooldown == false) 
        {
            LogBorder();
            message.reply('You are on cooldown!')
            LogRed(`[dailyclaim.js] Equation: ${currentTime - retrieveClaimTime(userid)} > ${limit}`)
            return
        }

        //? User is NOT on cooldown, process claim
        if (notOnCooldown == true)
         {
            LogBorder();
            container.lastTime = currentTime;
            message.reply('Successfuly Claimed Currency!')
            LogGreen(`[dailyclaimCMD.js] User is not on cooldown. Processing request`)
            updateclaim(userid, container.lastTime)
            return
        } else
        
         {
            message.reply('Something went wrong!')
            LogGreen(container.lastTime)
            LogGreen(notOnCooldown)
        }

    }
}