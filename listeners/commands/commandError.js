import { Listener } from '@sapphire/framework'
import { globalLog } from '#Logger'

export class UserEvent extends Listener {
    async run({ context, message: content }, { message }) {
        // `context: { silent: true }` should make UserError silent:
        // Use cases for this are for example permissions error when running the `eval` command.
        if (Reflect.get(Object(context), 'silent')) return

        globalLog.error(
            `ERROR:\nUser: ${message.author.tag} (${message.author.id})\nServer Details:\n${message.guild?.name} (${message.guild?.id}):\nUnauthorized/Command Error ${message}`,
        )
        //message.channel.send({ content, allowedMentions: { users: [message.author.id], roles: [] } });
        //message.channel.send("You are not allowed to use this command! (command error)");
        return
    }
}
