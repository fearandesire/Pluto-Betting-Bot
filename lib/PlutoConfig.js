import { container } from "@sapphire/pieces";
//* CONSOLE RELATED »»»»»»»»» */
//? Exporting Console Logging Colors for other files to use
export {
    bold,
    green,
    magentaBright,
    red,
    yellow,
    yellowBright
} from "colorette";

//? A border to place between console log returns to maintain readability
export const cborder = `    =========          =========          =========    `;

//? Keyword to log to console
export const logthis = console.log;

//* «««««««««««««« */

//* ODDS RELATED »»»»»»»»» */
//? I believe Team1 will be the home teams and Team2 will be the away teams, but we can't be 100% sure until the season starts.
container.Team1List = [];
container.Team1Odds = [];
container.Team2List = [];
container.Team2Odds = [];
export const Team1List = container.TeamList;
export const Team1Odds = container.TeamOdds;
export const Team2List = container.TeamList;
export const Team2Odds = container.TeamOdds;
//* «««««««««««««« */

//? NBAC Logo URL
export const NBACLogo = "https://cdn.discordapp.com/attachments/515598020818239491/981652760325922836/NBACPrideLogo.gif?size=4096";