import 'dotenv/config'

import { Piece, container } from '@sapphire/pieces'

import { Command } from '@sapphire/framework'
import storage from 'node-persist' //? node-persist: using to keep a local record for validation of a user's bets being collected already, or not [listbets.js]

//* CONSOLE RELATED »»»»»»»»» */
//? Exporting Console Logging Colors for other files to use
export {
    bgYellowBright,
    blue,
    blueBright,
    bold,
    green,
    magentaBright,
    red,
    yellow,
    yellowBright,
} from 'colorette'
//? Common Imports for other files to use!
export { container, Command, Piece }
export { storage }

//? A border to place between console log returns to maintain readability
export const cborder = `    =========          =========          =========    `

//? Keyword to log to console
export const logthis = console.log

container.lastTime = 0
//* «««««««««««««« */

//* ODDS RELATED »»»»»»»»» */
//? I believe Team1 will be the home teams and Team2 will be the away teams, but we can't be 100% sure until the season starts.
container.Team1List = []
container.Team1Odds = []
container.Team2List = []
container.Team2Odds = []
export const Team1List = container.TeamList
export const Team1Odds = container.TeamOdds
export const Team2List = container.TeamList
export const Team2Odds = container.TeamOdds
//? A check to see if the teams & odds are already collected for the day
container.CollectedOdds = false
//* «««««««««««««« */

//? NBAC Logo URL
export const NBACLogo =
    'https://cdn.discordapp.com/attachments/515598020818239491/981652760325922836/NBACPrideLogo.gif?size=4096'

//? Claim Times Container
container.ClaimTimes = {}

//? RegEx to disallow any letter characters
export const disallowLetters = /[a-z]/gi

//? OBJ to store the matchups themselves
container.TodaysMatchups = {}

//? Footer for embeds, since direct strings are depricated.
export const embedfooter = 'Provided by Pluto'
export const helpfooter = 'For help, please type ?help'
//? Object for storing active bet list per user [listMyBets.js]
export const Memory_Betslips = {}
