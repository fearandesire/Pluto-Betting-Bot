import {
  Command
} from '@sapphire/framework';
import {
  magentaBright
} from 'colorette';
import fetch from "node-fetch";
import {
  bold,
  cborder,
  green,
  logthis,
  yellow
} from '../lib/PlutoConfig.js';
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

export class testAPI extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'testAPI',
      aliases: ['api', 'apicall', 'tapi', 'apitest'],
      description: 'testAPI',
      requiredUserPermissions: ['KICK_MEMBERS']
    });
  }

  async messageRun(message) {
    fetch(url, options)
      .then(res => res.json())
      .then(json => {
        logthis(yellow(bold(`Running testAPI.js`)));
        logthis(magentaBright(bold(cborder)));
        // console.log(json[0].bookmakers); //? Returns an Array Objects with all bookmakers (sports books/betting sites) available
        logthis(green(bold(`Bookmaker: Draft Kings`)));
        logthis(json[0].bookmakers[0]) //? Returns the 'Draft Kings' Bookmarker
        logthis(magentaBright(bold(cborder)));
        logthis(green(bold(`Markets:`)));
        logthis(json[0].bookmakers[0].markets) //? Returns the 'Draft Kings' h2h outcome odds for the first 'market' (a market is a game)       
        logthis(green(bold(`Outcome 0:`)));
        logthis(json[0].bookmakers[0].markets[0].outcomes[0])
        
        
        //  console.log(json[0].bookmakers[4].markets[0]) //? Lists all 'markets' from Draft Kings
        var FavoredTeam = json[0].bookmakers[0].markets[0].outcomes[0].name
        var Team1Odds = json[0].bookmakers[0].markets[0].outcomes[0].price
        var Team2 = json[0].bookmakers[0].markets[0].outcomes[1].name
        var Team2Odds = json[0].bookmakers[0].markets[0].outcomes[1].price
        var Team1 = FavoredTeam;
        SendEmbedResp(message, Team1, Team1Odds, Team2, Team2Odds)
      })

  }
}