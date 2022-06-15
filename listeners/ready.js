import { Listener } from '@sapphire/framework';
import { nodepool } from '../Database/dbindex.js';
import { LogGreen } from '../utils/ConsoleLogging.js';
// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username, // eslint-disable-line 
      id // eslint-disable-line
    } = SapDiscClient.user;
  }
}
nodepool.connect();
nodepool.query(`SELECT lastclaimtime FROM currency WHERE userid = '208016830491525120'`, (err, res) => {
  if (err){
    console.log(err)
  }
  else{
    const dbresp = res.rows[0]
    console.log(dbresp)
}
})
LogGreen(`[Startup]: ready.js has loaded!`);
