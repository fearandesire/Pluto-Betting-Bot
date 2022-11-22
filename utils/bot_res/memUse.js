import { memLog } from './../logging.js'
import stringifyObject from 'stringify-object'

/**
 * @module memUse
 * Log the memory usage of the bot; Courtesey of l2yosho & Abdull [on StackOverflow](https://stackoverflow.com/questions/20018588/how-to-monitor-the-memory-usage-of-node-js)
 */

export async function memUse(file, msg) {
    const formatMemoryUsage = (data) =>
        `${Math.round((data / 1024 / 1024) * 100) / 100} MB`
    const memoryData = process.memoryUsage()
    const memoryUsage = {
        rss: `${formatMemoryUsage(
            memoryData.rss,
        )} -> Resident Set Size - total memory allocated for the process execution`,
        heapTotal: `${formatMemoryUsage(
            memoryData.heapTotal,
        )} -> total size of the allocated heap`,
        heapUsed: `${formatMemoryUsage(
            memoryData.heapUsed,
        )} -> actual memory used during the execution`,
        external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    }
    console.log(`File: ${file} | ${msg}`)
    let resp
    switch (true) {
        case msg !== undefined:
            resp = `[${file}.js] | ${msg} | Memory Usage:\n`
            break
        case msg === undefined:
            resp = `[${file}.js] | Memory Usage:\n`
            break
    }
    await memLog.info(`${resp} ${stringifyObject(memoryUsage)}`)
    //await console.log(resp, memoryUsage)
}
