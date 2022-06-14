
import {
  Command
} from '@sapphire/framework';
import { LoadDBs } from '../Database/sql.js';
import { LogBorder, LogGreen, LogYellow } from './../utils/ConsoleLogging.js';
  export class dbtest extends Command {
    constructor(context, options) {
      super(context, {
        ...options,
        name: 'dbtest',
        aliases: ['dbt'],
        description: 'dbtest dbtest',
        requiredUserPermissions: ['KICK_MEMBERS']
      });
    }
  
    // eslint-disable-next-line no-unused-vars
    async messageRun(message) {
        LogYellow(`[test.js] , LOADING DB`);
        LogBorder()
        LoadDBs()
        LogGreen('loaded weapon')
      }
    }
