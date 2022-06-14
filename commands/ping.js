import {
  Command
} from '@sapphire/framework';
  export class PingCommand extends Command {
    constructor(context, options) {
      super(context, {
        ...options,
        name: 'ping',
        aliases: ['pong'],
        description: 'ping pong',
        requiredUserPermissions: ['KICK_MEMBERS']
      });
    }
  
    async messageRun(message) {
      const msg = await message.channel.send('Pinging...');
      const content = `Pong from JavaScript! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${
        msg.createdTimestamp - message.createdTimestamp
      }ms.`;
  
      return msg.edit(content);
  
    }
  
  }