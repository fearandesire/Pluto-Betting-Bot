import {
    blue,
    blueBright,
    bold,
    cborder,
    green,
    magentaBright,
    red,
    yellow
} from '../../../lib/PlutoConfig.js'

export function Border() {
    return console.log(magentaBright(bold(cborder)))
}

export function Green(text) {
    return console.log(green(bold(cborder + `\n` + text + `\n` + cborder)))
}

export function Yellow(text) {
    return console.log(yellow(bold(cborder + `\n` + text + `\n` + cborder)))
}

export function Red(text) {
    return console.log(red(bold(cborder + `\n` + text + `\n` + cborder)))
}

export function Blue(text) {
    return console.log(blue(bold(cborder + `\n` + text + `\n` + cborder)))
}

export function BrightBlue(text) {
    return console.log(blueBright(bold(cborder + `\n` + text + `\n` + cborder)))
}

export function Error(text) {
    console.log(red(bold(cborder)))
    console.log(red(bold(`ERROR: ${text}`)))
    console.log(red(bold(cborder)))
    return
}

export function CmdPermission(username, userid, commandName) {
    console.log(red(bold(cborder)))
    console.log(
        red(
            bold(
                `PERMISSION ERROR: ${username} (${userid}) attempted to use command ${commandName} they lacked permissions for.`,
            ),
        ),
    )
    console.log(red(bold(cborder)))
    return
}

export const Log = {
    Border,
    Green,
    Yellow,
    Red,
    Blue,
    BrightBlue,
    Error,
    CmdPermission,
}
