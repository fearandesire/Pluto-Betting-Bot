import * as config from '../lib/PlutoConfig.js';
import { Log } from '../utils/ConsoleLogging.js';
import { processClaim } from '../utils/processClaim.js';
export class TestPromise extends config.Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'returnID',
            aliases: ['rtid', 'userid'],
            description: 'Daily Claim',
            requiredUserPermissions: ['KICK_MEMBERS']
        });
    }

    async messageRun(message) {
        Log.LogBorder();
        Log.LogYellow(`[testpromise.js] Running Test Promise!`)
        const userid = message.author.id;
        var currentTime = new Date().getTime();
        processClaim(userid, message, currentTime);
        
        
    }
}


