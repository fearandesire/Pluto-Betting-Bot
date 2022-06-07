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
  LogBorder,
  LogGreen,
  LogYellow
} from '../utils/ConsoleLogging.js';
import {
  OddOrNot
} from '../utils/OddorEven.js';
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
    // if (userInput === null) {
    //   message.channel.send("Please specify a team");
    //   return;
    // }
    // if (userInput.toLowerCase() === "celtics") {
    // let userInput = "Boston Celtics";
    // }
    fetch(url, options)
      .then(res => res.json())
      .then(json => {
        logthis(yellow(bold(`Running odds.js`)));
        //? 'Markets' returns the list of teams
        var ListOfGames = json[0].bookmakers[0].markets;
        //? Iterate through ListOfGames Object
        for (let apIndex = 0; apIndex < ListOfGames.length; apIndex++) {
          //? Iterate the Team Names via .outcomes
          var TeamNames = ListOfGames[apIndex].outcomes[apIndex];
          for (var key in TeamNames) {
            if (TeamNames[key] === userInput) {
              container.Team1 = TeamNames[key];
              container.Team1Odds = ListOfGames[0].outcomes[apIndex].price
              //container.Team1Odds = TeamNames.price;
              LogGreen(`[odds.js] Team 1: ${container.Team1} odds: ${container.Team1Odds}`);
              //LogGreen(`[odds.js] Team 1 Index: ${apIndex}`);
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
                LogYellow(`[odds.js] Team 1 Index is Odd, adding 1. Adjusted Index: ${AdjustedIndexOdd}`);
                container.Team2 = ListOfGames[apIndex].outcomes[AdjustedIndexOdd].name;
                container.Team2Odds = ListOfGames[apIndex].outcomes[AdjustedIndexOdd].price;
                LogBorder();
                LogGreen(`[odds.js] Team 2: ${container.Team2} odds: ${container.Team2Odds}`);
              } else if (OddOrNot(apIndex) === 1) {
                var AdjustedIndexEven = apIndex - 1;
                LogYellow(`[odds.js] Team 1 Index is Odd, substracting 1. Adjusted Index: ${AdjustedIndexEven}`);
                container.Team2 = ListOfGames[0].outcomes[AdjustedIndexEven].name;
                container.Team2Odds = ListOfGames[0].outcomes[AdjustedIndexEven].price;
                LogBorder();
                LogGreen(`[odds.js] Team 2: ${container.Team2} odds: ${container.Team2Odds}`);
              }
            }
          }
        }

      })
  }
}