import { Command } from "@sapphire/framework";
import editJsonFile from 'edit-json-file';
import { LogYellow } from "../utils/ConsoleLogging.js";
var __dirname = './lib';
let file = editJsonFile(`${__dirname}/data.json`);
    export class EditJson extends Command {
      constructor(context, options) {
        super(context, {
          ...options,
          name: 'editjson',
          aliases: ['ej'],
          description: 'edit json',
          requiredUserPermissions: ['KICK_MEMBERS']
        });
      }
    
      async messageRun(message) {
        LogYellow(`[editjson.js] Running Edit Json!`)
    //     fs.readFile('./lib/data.json', 'utf8', function readFileCallback(err, data) {
    //         if (err) {
    //             console.log(err);
    //         } else {
    //             const obj = JSON.parse(data); //now it an object
    //             console.log(obj[208016830491525120].claimtime)
    
    //   }
    // })


    var userid = '208016830491525120';
    // console.log(file.get(`${userid}.claimtime`));
    //* «««««««««««««««««««« */
    var callback = function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log(data);
        }
    }
    file.read(callback)

}
}