import {
    Command,
    container
} from '@sapphire/framework';
import { LogBorder, LogGreen, LogRed, LogYellow } from '../utils/ConsoleLogging.js';
export class PingCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'testtimer',
            aliases: ['tt'],
            description: 'test timer',
            requiredUserPermissions: ['KICK_MEMBERS']
        });
    }

    async messageRun(message) {

        var limit = 5000;
        var currentTime = new Date().getTime();
        let notOnCooldown = currentTime - container.lastTime > limit;
        
        LogBorder();
        LogYellow(`[testtimer]: Starting variables:`);
        LogYellow(`[testtimer.js] Last Time: ${container.lastTime} | notOnCooldown: ${notOnCooldown} | Current Time: ${currentTime}`)

        if (container.lastTime == null || container.lastTime == undefined) 
        {
            container.lastTime = currentTime;
            return
        }
        if (notOnCooldown == false) 
        {
            LogBorder();
            LogGreen(container.lastTime)
            LogGreen(notOnCooldown)
            message.reply('You are on cooldown!')
            return
        }

        if (notOnCooldown == true)
         {
            LogBorder();
            LogGreen(`[testtimer.js] Last Time: ${container.lastTime} | notOnCooldown: ${notOnCooldown} | Current Time: ${currentTime}`)
            LogRed(`Math: ${notOnCooldown}`)
            container.lastTime = currentTime;
            message.reply('Success!')
            return
        } else
         {
            message.reply('Something went wrong!')
            LogGreen(container.lastTime)
            LogGreen(notOnCooldown)
        }

    }
}