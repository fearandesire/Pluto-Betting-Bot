import { Listener } from '@sapphire/framework';
import express from 'express';
import { router as currencyRouter } from '../ExpressRoutes/currencyRoute.js';
import { LogBrightBlue, LogGreen } from '../utils/ConsoleLogging.js';
const app = express();
// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username, // eslint-disable-line 
      id // eslint-disable-line
    } = SapDiscClient.user;
  }
}
//nodepool.connect();

// Start express server
app.listen('4444', () => {
  LogBrightBlue(`Server running at: http://localhost:4444`);
})

//? Return our results in the form of a JSON object
app.use(express.json());

//? Add our router to our express app
app.use('/currency', currencyRouter);

//app.get('/currency')
// nodepool.query(`SELECT lastclaimtime FROM currency WHERE userid = '208016830491525120'`, (err, res) => {
//   if (err){
//     console.log(err)
//   }
//   else{
//     const dbresp = res.rows[0]
//     console.log(dbresp)
// }
// })
//var userid = '208016830491525120'
//var lastTime = retrieveClaimTimes(userid);

LogGreen(`[Startup]: ready.js has loaded!`);
