import {
    Command,
    container
} from '@sapphire/framework';
import { updateclaim } from '../utils/addClaimTime.js';
import { LogBorder, LogGreen, LogYellow } from '../utils/ConsoleLogging.js';
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
        const ClaimCooldown = 86400000 //* 24 hours in milliseconds
        var limit = 5000;
        const lastTime = container.lastTime
        var currentTime = new Date().getTime();
        let notOnCooldown = currentTime - container.lastTime > limit;
        const userid = message.author.id;
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

        //? Check if user has ever used claim cmd
        //TODO: Verify null/empty/undefined for last claim time
        //* E.G of TODO: verifyClaim(userid) -> Check 'lastclaimtime' cell in currency table for userid
        if (verifyClaim(userid) == false) 
        {
            container.lastTime = currentTime;
            updateclaim(userid, lastTime)
            return
        }

        //? Check if user is on cooldown
        if (notOnCooldown == false) 
        {
            LogBorder();
            message.reply('You are on cooldown!')
            return
        }

        //? User is NOT on cooldown, process claim
        if (notOnCooldown == true)
         {
            LogBorder();
            container.lastTime = currentTime;
            message.reply('Successfuly Claimed Currency!')
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