import { bold, cborder, green, magentaBright, yellow } from "../lib/PlutoConfig.js";
export function LogBorder(){
    return console.log(magentaBright(bold(cborder)));
}

export function LogGreen(text){
    return console.log(green(bold(text)));
}

export function LogYellow(text){
    return console.log(yellow(bold(text)));
}