import { bold, cborder, green, magentaBright, red, yellow } from "../lib/PlutoConfig.js";
export function LogBorder(){
    return console.log(magentaBright(bold(cborder)));
}

export function LogGreen(text){
    return console.log(green(bold(text)));
}

export function LogYellow(text){
    return console.log(yellow(bold(text)));
}

export function LogRed(text){
    return console.log(red(bold(text)));
}