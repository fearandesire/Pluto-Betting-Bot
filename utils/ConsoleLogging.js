import { blue, blueBright, bold, cborder, green, magentaBright, red, yellow } from "../lib/PlutoConfig.js";
export function LogBorder(){
    return console.log(magentaBright(bold(cborder)));
}

export function LogGreen(text){
    return console.log(green(bold(text)));
}

export function Log.Yellow(text){
    return console.log(yellow(bold(text)));
}

export function LogRed(text){
    return console.log(red(bold(text)));
}

export function LogBlue(text){
    return console.log(blue(bold(text)));
}

export function LogBrightBlue(text){
    return console.log(blueBright(bold(text)));
}

export function LogError(text){
    console.log(red(bold(cborder)))
    console.log(red(bold(text)))
    console.log(red(bold(cborder)))
    return;
}

export const Log = {
    LogBorder,
    LogGreen,
    Log.Yellow,
    LogRed,
    LogBlue,
    LogBrightBlue,
    LogError
}
