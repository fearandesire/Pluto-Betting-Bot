export async function debugLogging(debugObj) {
    var msg = debugObj?.msg
    var obj = debugObj?.debug
    var fileName = debugObj?.fileName
    if (obj) {
        return console.log(`--- DEBUG [${fileName}] ---\n\n${msg}\n`, obj)
    } else {
        return console.log(`--- DEBUG [${fileName}] ---\n\n${msg}\n`)
    }
}
