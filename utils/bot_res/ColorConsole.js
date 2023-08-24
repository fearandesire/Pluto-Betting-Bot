import { bold } from 'colorette'
import * as clret from 'colorette'

export default function logClr(data) {
    let { text, status } = data || null
    const { color, bg } = data || null

    switch (status) {
        case 'done':
            status = '✅ '
            break
        case 'error':
            status = '❌ '
            break
        case 'warn':
            status = '❗  '
            break
        case 'processing':
            status = '🕒 '
            break
        default:
            status = ''
            break
    }
    if (bg) {
        text = clret[bg](clret[color](`${status}${text}`))
    } else {
        text = clret[color](`${status}${text}`)
    }
    return console.log(clret[color](bold(`${text}`)))
}
