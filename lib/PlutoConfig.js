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
container.TeamList = [];
container.TeamOdds = [];
export const TeamList = container.TeamList;
export const TeamOdds = container.TeamOdds;
//* «««««««««««««« */