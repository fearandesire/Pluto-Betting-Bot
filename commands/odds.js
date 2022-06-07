import {
  Command
} from '@sapphire/framework';
import {
  container
} from '@sapphire/pieces';
import { bold, green, magentaBright, yellow } from 'colorette';
import fetch from "node-fetch";
import { cborder, logthis } from '../lib/PlutoConfig.js';
import { OddOrNot } from '../utils/OddorEven.js';
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
    fetch(url, options)
      .then(res => res.json())
      .then(json => {
        logthis(yellow(bold(`Running odds.js`)));
        //? 'Markets' returns the list of teams
        var ListOfGames = json[0].bookmakers[0].markets;
        //? Iterate through ListOfGames Object
        for (let apIndex=0; apIndex<ListOfGames.length; apIndex++) {
          //? Iterate the Team Names via .outcomes
          var TeamNames = ListOfGames[apIndex].outcomes[apIndex];
          for (var key in TeamNames) {
            if (TeamNames[key] === userInput) { 
              container.Team1 = TeamNames[key];
              container.Team1Odds = TeamNames.price;
              logthis(green(bold(`Team Name found:`)));
            logthis(green(bold(container.Team1)));
            logthis(magentaBright(bold(cborder)));
            logthis(green(bold(`Team Odds:`)));
            logthis(green(bold(container.Team1Odds)));
            logthis(magentaBright(bold(cborder)));
            logthis(green(bold(`Index:`)));
            logthis(green(bold(apIndex)));
            //? Odd = 1, Even = 0
            if (OddOrNot(apIndex) === 0) {
              console.log('+1')
              //var NextResult = 
             // container.Team2 = ListOfGames[apIndex].outcomes[]
            }
          }
          
       }
      }
        //  console.log(json[0].bookmakers[4].markets[0]) //? Lists all 'markets' from Draft Kings
        // var FavoredTeam = json[0].bookmakers[0].markets[0].outcomes[0].name
        // var Team1Odds = json[0].bookmakers[0].markets[0].outcomes[0].price
        // var Team2 = json[0].bookmakers[0].markets[0].outcomes[1].name
        // var Team2Odds = json[0].bookmakers[0].markets[0].outcomes[1].price
        // var Team1 = FavoredTeam;
        // SendEmbedResp(message, Team1, Team1Odds, Team2, Team2Odds)

      })

  }
}