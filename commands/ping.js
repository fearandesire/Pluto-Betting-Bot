import { Command } from '@sapphire/framework'
import { FileRunning } from '#FileRun'

export class PingCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'ping',
            aliases: ['pong'],
            description: 'ping pong',
        })
    }

    async messageRun(message) {
        new FileRunning(this.name)
        const msg = await message.channel.send('Pinging...')
        const content = `Pong from JavaScript! Bot Latency ${Math.round(
            this.container.client.ws.ping,
        )}ms. API Latency ${msg.createdTimestamp - message.createdTimestamp}ms.`

        return msg.edit(content)
    }
}
