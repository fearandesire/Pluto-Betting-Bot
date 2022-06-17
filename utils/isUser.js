import { db } from '../Database/dbindex.js';
//import { updateclaim } from './addClaimTime.js';
import { Log } from './ConsoleLogging.js';

export async function isUser(inputuserid, message) {

    //! WORKS
await db.any("SELECT * FROM currency WHERE userid = $1", [inputuserid]).then((dbData) => { 
    Log.LogBrightBlue(`[isUser.js] User ${inputuserid} is in the database || ${dbData[0].userid}`)
    if (dbData[0].userid === inputuserid) {
        message.reply('User exists in the database!')
        return;
    }
})
    .catch(error => {
        Log.LogBorder(`[isUser.js] Something went wrong...`)
        Log.LogError(error)
        return false;
    })


// db.users.existsUsername(username)
//    .then(exists => {
//       // exists - boolean
//    })
//    .catch(error => {
//    });
}
