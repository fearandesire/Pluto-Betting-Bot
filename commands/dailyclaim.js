import {
    Command
} from '@sapphire/framework';
import { updateclaim } from '../utils/addClaimTime.js';
import { LogBlue, LogBorder, LogYellow } from '../utils/ConsoleLogging.js';
import { updateClaimFile } from '../utils/FileSystem/updateClaimFile.js';
import { useridentity } from '../utils/useridentity.js';
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
        //const ClaimCooldown = 86400000 //* 24 hours in milliseconds
        //var limit = 5000;
       // const lastTime = container.lastTime
        var currentTime = new Date().getTime();
        LogBorder();
        LogYellow(`[dailyclaim.js] Running Daily Claim Command!`);

        //? Check if user exists in database, if not create them and then process claim.
        
        //! If we end up using FILE SYSTEM: we will need to load the database and obj/container for all users.
        //! If the user is in fact not in there, we will create them in a file that we will update onto the DB in an interval

        if (useridentity(userid) == false) 
        {
            LogYellow(`[dailyclaimCMD.js] User claim status was false in the database. Processing request`)
            //container.lastTime = currentTime;
            //? push lasttime to db
            message.reply('Successfuly Claimed Currency!')
            updateclaim(userid, currentTime)
            return;
        }
        else {
            LogBlue(`[dailyclaim.js] Processing Claim..`)
            updateClaimFile(userid, currentTime);
            message.reply('Successfuly Claimed Currency!')
        }


    }
}