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
import {
  SendEmbedResp
} from '../utils/SendEmbed.js';
const url = 'https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=969c5995918207426c467b3c0f18206b&regions=us&markets=h2h%2Cspreads&dateFormat=iso&oddsFormat=american';
const options = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Host': 'api.the-odds-api.com',
    'X-RapidAPI-Key': 'd5dcd70f44241e623b2c18a9b84a9941'
  }
};

export class odds extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'odds',
      aliases: ['oddsfor'],
      description: 'return odds for specified team',
      requiredUserPermissions: ['KICK_MEMBERS']
    });
  }

  async messageRun(message, args) {
    const userInput = await args.rest("string").catch(() => null);
    container.teamToSearchFor = userInput;
    if (userInput === null) {
      message.channel.send("Please specify a team");
      return;
    }
    if (userInput.toLowerCase() === "celtics") {
      container.teamToSearchFor = "Boston Celtics";
    }
    if (userInput.toLowerCase() === "warriors") {
      container.teamToSearchFor = "Golden State Warriors";
    }

    fetch(url, options)
      .then(res => res.json())
      .then(json => {


        const teamToSearchFor = container.teamToSearchFor;
        logthis(yellow(bold(`Running odds.js`)));

        //* RETURNS THE LIST OF MATCHUPS »»»»»»»»» */
        var apiGamesList = json[0].bookmakers[0].markets[0].outcomes

        //* ITERATE THROUGH APIGAMESLIST OBJECT »»»»»»» */
        for (let apIndex = 0; apIndex < apiGamesList.length; apIndex++) {
          var apiMatchups = apiGamesList[apIndex];

          //? Iterate through list & stop when we find the team the user is looking for
          for (var key in apiMatchups) {

            if (apiMatchups[key] === teamToSearchFor) {

              container.Team1 = apiMatchups[key];
              container.Team1Odds = AddPlusToPositive(apiGamesList[apIndex].price)
              LogGreen(`[odds.js] Team 1: ${container.Team1} odds: ${container.Team1Odds}`);
              LogBorder();

              /**  
              Odd = 1, Even = 0
              A team found would either be indexed as an even or odd number. 
              Starting at 0, the first team is odd, the second team is even, etc.
              This is why we use the OddOrNot function to determine if the team is odd or even.
              For example, currently the Boston Celtics are going against the Golden State Warriors.
              The Celtics are at the top of the response, or '0' index within 'outcomes'.
              The Warriors would be the next response, or '1' index within 'outcomes'.
              If there was another matchup, the following teams would be 3, and then 4.
              We want the command to return the odds for the team specified AND the opposing team,
              so we catch the index from the team that matches the input (above) and add 1 to it if it is even.
              If the index is odd, we take away 1 from it.
              **/

              if (OddOrNot(apIndex) === 0) {

                var AdjustedIndexOdd = apIndex + 1;
                LogYellow(`[odds.js] Team 1 Index is Odd, adding 1 to it's value to find it's matchup. Adjusted Index: ${AdjustedIndexOdd}`);
                container.Team2 = apiGamesList[AdjustedIndexOdd].name;
                container.Team2Odds = AddPlusToPositive(apiGamesList[AdjustedIndexOdd].price);
                LogBorder();
                LogGreen(`[odds.js] Team 2: ${container.Team2} odds: ${container.Team2Odds}`);

              } else if (OddOrNot(apIndex) === 1) {

                var AdjustedIndexEven = apIndex - 1;
                LogYellow(`[odds.js] Team 1 Index is Odd, substracting 1 to it's value to find it's matchup. Adjusted Index: ${AdjustedIndexEven}`);
                container.Team2 = apiGamesList[AdjustedIndexEven].name;
                container.Team2Odds = AddPlusToPositive(apiGamesList[AdjustedIndexEven].price);
                LogBorder();
                LogGreen(`[odds.js] Team 2: ${container.Team2} odds: ${container.Team2Odds}`);

              }
            }
          }
        }
        //? Sending teams and odds into embed reply
        SendEmbedResp(message, container.Team1, container.Team1Odds, container.Team2, container.Team2Odds);
      })
      .catch(err => {
        console.log(err);
      })
  }
}