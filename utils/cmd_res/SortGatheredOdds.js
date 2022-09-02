import { Log } from '../bot_res/send_functions/consoleLog.js'
import { SendMatchupList } from '../bot_res/send_functions/SendMatchupList.js'
import { container } from '@sapphire/pieces'

//TODO: Matchuplist needs to be cleaned/emptied after compiling the embed.
//TODO: Store Embed data into an obj locally
container.MatchupList = []
/**
 * @module SortGatheredOdds - A module to organize from the list of odds that we gathered from the API and put them into a compiled list (array) of matchups for displaying.
 * @summary - We take the teams and odds gathered from the API in {@link gatherOdds.js} and push each matchup into an array.
 * @param {obj} Team1List - The list of "team1" values from API, which are the first teams in their matchup against 'Team2' (the second team)
 * @param {obj} Team2List - The list of "team2" values from API, which are the second teams in their matchup against 'Team1' (the first team)
 * @param {obj} Team1Odds - The list of "team1odds" values from API, which are the odds of the first team in their matchup against 'Team2' (the second team)
 * @param {obj} Team2Odds - The list of "team2odds" values from API, which are the odds of the second team in their matchup against 'Team1' (the first team)
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @return {obj} container.Matchuplist - A global container (containers from @sapphire/pieces pkg) that starts as an empty array, and is filled with the compiled list of matchups.
 * @references
 * - {@link SendMatchupList} - A module that uses Discord's embed builder to create a list of matchups and displays it.
 * - {@link gatherOdds.js} - A module that gathers odds for all matchups from the API and puts them into an array.
 */
export function SortGatheredOdds(
    Team1List,
    Team1Odds,
    Team2List,
    Team2Odds,
    message,
) {
    Log.Border()
    Log.Yellow('[SortGatheredOdds.js] Sorting Gathered Odds')
    Log.Border()

    //? The way it is organized, the matching index for each matchup is the same. So for example:
    //? Index 0 in Team1List would be the opponent of Team2List[0]. Identical for the Odds as well
    for (let index = 0; index < Team1List.length; index++) {
        const SelectTeam1Name = Team1List[index]
        const SelectTeam1Odds = Team1Odds[index]
        const SelectTeam2Name = Team2List[index]
        const SelectTeam2Odds = Team2Odds[index]
        container.sortedIndex = index
        if (index == 0) {
            //? For displaying purposes, if the index is '0', it should be '1' as that's when we normally start counting from as humans.
            container.sortedIndex = 1
        }
        //? Setting up object in memory with our matchup data. [This is all theory for now, as we haven't updated the sport in the API yet, but it should work.]
        container.TodaysMatchups[`${index}`] = index
        container.TodaysMatchups[`${index}`].Team1 = SelectTeam1Name
        container.TodaysMatchups[`${index}`].Team1Odds = SelectTeam1Odds
        container.TodaysMatchups[`${index}`].Team2 = SelectTeam2Name
        container.TodaysMatchups[`${index}`].Team2Odds = SelectTeam2Odds

        //? Formatting each matchup to be displayed in an embed
        container.MatchupList.push(
            `**[__Matchup #${container.sortedIndex}__]** \n **${SelectTeam1Name}** \n Odds: **${SelectTeam1Odds}** \n vs. \n **${SelectTeam2Name}** \n Odds: **${SelectTeam2Odds}**`,
        )
    }
    Log.Green("[SortGatheredOdds.js] Today's Odds Array")
    Log.Green(container.MatchupList.join('\n \n'))
    Log.Border()
    SendMatchupList(message, container.MatchupList)
    return
}
