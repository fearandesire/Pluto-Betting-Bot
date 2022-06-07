import { bold, magentaBright } from "colorette";
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
export const ConsoleBorder = console.log(magentaBright(bold(cborder)));