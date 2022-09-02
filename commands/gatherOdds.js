<<<<<<< Updated upstream
import {
  Command
} from '@sapphire/framework';
import {
  container
} from '@sapphire/pieces';
import {
  bold,
  yellow
} from 'colorette';
import fetch from "node-fetch";
import {
  logthis
} from '../lib/PlutoConfig.js';
import {
  AddPlusToPositive
} from '../utils/AddPlusToPositive.js';
import {
  LogBorder,
  LogGreen,
  LogYellow
} from '../utils/ConsoleLogging.js';
import {
  OddOrNot
} from '../utils/OddorEven.js';
import { SendMatchupList } from '../utils/SendMatchupList.js';
import { SortGatheredOdds } from '../utils/SortGatheredOdds.js';
const url = 'https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=969c5995918207426c467b3c0f18206b&regions=us&markets=h2h%2Cspreads&dateFormat=iso&oddsFormat=american';
const options = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Host': 'api.the-odds-api.com',
    'X-RapidAPI-Key': 'd5dcd70f44241e623b2c18a9b84a9941'
  }
};


export class gatherOdds extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'gatherOdds',
      aliases: ['godds', 'getodds', 'listodds', 'matchups', 'matches', 'listgames'],
      description: 'return matchups & odds for all available teams',
      requiredUserPermissions: ['KICK_MEMBERS']
    });
  }


  async messageRun(message) {
    if (container.CollectedOdds === true){
      SendMatchupList(message, container.MatchupList)
      return;
    }


    fetch(url, options)
      .then(res => res.json())
      .then(json => {


        logthis(yellow(bold(`Running gatherOdds.js`)));

        //? Returns the list of matchups
        var apiGamesList = json[0].bookmakers[0].markets[0].outcomes

        //? Iterate through the right amount of games listed/returned
        for (let apIndex = 0; apIndex < apiGamesList.length; apIndex++) {

          var apiMatchups = apiGamesList[apIndex];
          //? Iterate through matchups & stop when we find the team the user is looking for
          for (var key in apiMatchups) {

            //? Separate by regex matching any non digit characters that is not 76ers. We don't want the odds in the name
            var TeamNameToString = JSON.stringify(apiMatchups[key]);
            if (TeamNameToString.match(/[^0-9]/g) == null || TeamNameToString.match(/76ers/gm)) {  
              var team1name = apiGamesList[apIndex].name;
              //? 'Team 1' is the first found team in the matchup.
              container.GatherTeam1 = apiGamesList[apIndex].name; // Team 1 Name
              container.GatherTeam1Odds = AddPlusToPositive(apiGamesList[apIndex].price) // Team 1 Odds
              container.Team1List.push(team1name);
              container.Team1Odds.push(container.GatherTeam1Odds);
              LogGreen(`[odds.js] Team 1: ${container.GatherTeam1} -- Odds: ${container.GatherTeam1Odds}`);
              LogBorder();

              /**  
              documentation in odds.js
              **/

              //? Finding the second team in the matchup.
              if (OddOrNot(apIndex) === 0) {

                var AdjustedIndexOdd = apIndex + 1;
                LogYellow(`[odds.js] Team 1 Index is Even, adding 1 to it's value to find it's matchup. Adjusted Index: ${AdjustedIndexOdd}`);
                container.GatherTeam2 = apiGamesList[AdjustedIndexOdd].name;
                container.GatherTeam2Odds = AddPlusToPositive(apiGamesList[AdjustedIndexOdd].price);
                LogBorder();
                LogGreen(`[odds.js] Team 2: ${container.GatherTeam2} odds: ${container.GatherTeam2Odds}`);
              } else if (OddOrNot(apIndex) === 1) {

                var AdjustedIndexEven = apIndex - 1;
                LogYellow(`[odds.js] Team 1 Index is Odd, substracting 1 to it's value to find it's matchup. Adjusted Index: ${AdjustedIndexEven}`);
                container.GatherTeam2 = apiGamesList[AdjustedIndexEven].name;
                container.GatherTeam2Odds = AddPlusToPositive(apiGamesList[AdjustedIndexEven].price);
                LogBorder();
                LogGreen(`[odds.js] Team 2: ${container.GatherTeam2} odds: ${container.GatherTeam2Odds}`);


              }
            }
          }
        }

        //? 'Team 2' is the second found team in the matchup, aka the opponenet of 'Team 1'.
        container.Team2List.push(container.GatherTeam2); // Team 2 Name
        container.Team2Odds.push(container.GatherTeam2Odds); // Team 2 Odds
        //? Log the matchups & odds for each team.
        LogYellow(`[gatherodds.js] Team 1 List: ${container.Team1List}`);
        LogYellow(`[gatherodds.js] Team 1 Odds: ${container.Team1Odds}`);
        LogYellow(`[gatherodds.js] Team 2 List: ${container.Team2List}`);
        LogYellow(`[gatherodds.js] Team 2 Odds: ${container.Team2Odds}`);
        //? Sorting the collected teams and odds to be displayed
        SortGatheredOdds(container.Team1List, container.Team1Odds, container.Team2List, container.Team2Odds, message);

      })
      .catch(err => {
        console.log(err);
        message.reply('No odds were found.')
      })

      container.CollectedOdds = true;
  }
}
=======
//? gatherOdds.js: Gather all odds from API and return into an embed.
//? Since we store the information in an embed, we don't need to make repeated calls to the API.

import 'dotenv/config'

import { AddPlusToPositive } from '../utils/cmd_res/AddPlusToPositive.js'
import { Command } from '@sapphire/framework'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { OddOrNot } from '../utils/cmd_res/OddorEven.js'
import { SendMatchupList } from '../utils/bot_res/send_functions/SendMatchupList.js'
import { SortGatheredOdds } from '../utils/cmd_res/SortGatheredOdds.js'
import { container } from '@sapphire/pieces'
import fetch from 'node-fetch'

const url =
    // eslint-disable-next-line no-undef
    process.env.odds_API_NFLODDS
const options = {
    method: 'GET',
    headers: {
        'X-RapidAPI-Host': 'api.the-odds-api.com',
        'X-RapidAPI-Key': 'd5dcd70f44241e623b2c18a9b84a9941',
    },
}
//TODO: Adjust API to in-season sport
//TODO: Compile information into Database 'activematchups' table, then use that same information to display info back (via Embed)
//TODO: Return information & configure SendMatchupList to send stored information
export class gatherOdds extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'gatherOdds',
            aliases: [''],
            description: 'return matchups & odds for all available teams',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }

    async messageRun(message) {
        if (container.CollectedOdds === true) {
            SendMatchupList(message, container.MatchupList)
            return
        }

        fetch(url, options)
            .then((res) => res.json())
            .then((json) => {
                Log.Yellow(`[gatherOdds.js] Running gatherOdds.js!`)

                //? Returns the list of matchups
                var apiGamesList = json[0].bookmakers[0].markets[0].outcomes //? fan duel markets

                //? Iterate through the right amount of games listed/returned
                for (let apIndex = 0; apIndex < apiGamesList.length; apIndex++) {
                    var apiMatchups = apiGamesList[apIndex]
                    //? Iterate through matchups & stop when we find the team the user is looking for
                    for (var key in apiMatchups) {
                        //? Separate by regex matching any non digit characters that is not 76ers. We don't want the odds in the name
                        var TeamNameToString = JSON.stringify(apiMatchups[key])
                        if (
                            TeamNameToString.match(/[^0-9]/g) == null ||
                            TeamNameToString.match(/76ers/gm)
                        ) {
                            var team1name = apiGamesList[apIndex].name
                            //? 'Team 1' is the first found team in the matchup.
                            container.GatherTeam1 = apiGamesList[apIndex].name // Team 1 Name
                            container.GatherTeam1Odds = AddPlusToPositive(
                                apiGamesList[apIndex].price,
                            ) // Team 1 Odds
                            container.Team1List.push(team1name)
                            container.Team1Odds.push(container.GatherTeam1Odds)
                            Log.Green(
                                `[odds.js] Team 1: ${container.GatherTeam1} -- Odds: ${container.GatherTeam1Odds}`,
                            )
                            Log.Border()

                            /**  
              documentation in odds.js
              **/

                            //? Finding the second team in the matchup.
                            if (OddOrNot(apIndex) === 0) {
                                var AdjustedIndexOdd = apIndex + 1
                                Log.Yellow(
                                    `[odds.js] Team 1 Index is Even, adding 1 to it's value to find it's matchup. Adjusted Index: ${AdjustedIndexOdd}`,
                                )
                                container.GatherTeam2 = apiGamesList[AdjustedIndexOdd].name
                                container.GatherTeam2Odds = AddPlusToPositive(
                                    apiGamesList[AdjustedIndexOdd].price,
                                )
                                Log.Border()
                                Log.Green(
                                    `[odds.js] Team 2: ${container.GatherTeam2} odds: ${container.GatherTeam2Odds}`,
                                )
                            } else if (OddOrNot(apIndex) === 1) {
                                var AdjustedIndexEven = apIndex - 1
                                Log.Yellow(
                                    `[odds.js] Team 1 Index is Odd, substracting 1 to it's value to find it's matchup. Adjusted Index: ${AdjustedIndexEven}`,
                                )
                                container.GatherTeam2 = apiGamesList[AdjustedIndexEven].name
                                container.GatherTeam2Odds = AddPlusToPositive(
                                    apiGamesList[AdjustedIndexEven].price,
                                )
                                Log.Border()
                                Log.Green(
                                    `[odds.js] Team 2: ${container.GatherTeam2} odds: ${container.GatherTeam2Odds}`,
                                )
                            }
                        }
                    }
                }

                //? 'Team 2' is the second found team in the matchup, aka the opponenet of 'Team 1'.
                container.Team2List.push(container.GatherTeam2) // Team 2 Name
                container.Team2Odds.push(container.GatherTeam2Odds) // Team 2 Odds
                //? Log. the matchups & odds for each team.
                Log.Yellow(`[gatherodds.js] Team 1 List: ${container.Team1List}`)
                Log.Yellow(`[gatherodds.js] Team 1 Odds: ${container.Team1Odds}`)
                Log.Yellow(`[gatherodds.js] Team 2 List: ${container.Team2List}`)
                Log.Yellow(`[gatherodds.js] Team 2 Odds: ${container.Team2Odds}`)
                //? Sorting the collected teams and odds to be displayed
                SortGatheredOdds(
                    container.Team1List,
                    container.Team1Odds,
                    container.Team2List,
                    container.Team2Odds,
                    message,
                )
            })
            .catch((err) => {
                Log.Error(`[gatherOdds.js] Error: ${err}`)
                message.reply('No odds were found.')
            })

        container.CollectedOdds = true
    }
}
>>>>>>> Stashed changes
