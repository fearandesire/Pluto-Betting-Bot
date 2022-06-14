import {
    container
} from '@sapphire/pieces';
import {
    LogBorder,
    LogGreen,
    LogYellow
} from "./ConsoleLogging.js";
import { SendMatchupList } from './SendMatchupList.js';
container.MatchupList = [];
export function SortGatheredOdds(Team1List, Team1Odds, Team2List, Team2Odds, message) {
    LogBorder();
    LogYellow("[SortGatheredOdds.js] Sorting Gathered Odds");
    LogBorder();

    //? The way it is organized, the matching index for each matchup is the same. So for example:
    //? Index 0 in Team1List would be the opponent of Team2List[0]. Identical for the Odds as well
    for (let index = 0; index < Team1List.length; index++) {
        const SelectTeam1Name = Team1List[index];
        const SelectTeam1Odds = Team1Odds[index];
        const SelectTeam2Name = Team2List[index];
        const SelectTeam2Odds = Team2Odds[index];
        container.sortedIndex = index;
        if (index == 0){
        container.sortedIndex = 1;
        }
        //? Formatting each matchup to be displayed in an embed
        container.MatchupList.push(`**[__Matchup #${container.sortedIndex}__]** \n **${SelectTeam1Name}** \n Odds: **${SelectTeam1Odds}** \n vs. \n **${SelectTeam2Name}** \n Odds: **${SelectTeam2Odds}**`);
        
    }
    LogGreen("[SortGatheredOdds.js] Today's Odds Array");
    LogGreen(container.MatchupList.join('\n \n'));
    LogBorder();
    SendMatchupList(message, container.MatchupList);
    return
}