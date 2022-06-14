import { Listener, Precondition, Identifiers } from '@sapphire/framework';

export class UserEvent extends Listener {
	async run({ context, message: content }, { message }) {
		// `context: { silent: true }` should make UserError silent:
		// Use cases for this are for example permissions error when running the `eval` command.
		if (Reflect.get(Object(context), 'silent')) return;

	
		//message.channel.send({ content, allowedMentions: { users: [message.author.id], roles: [] } }); 
		message.channel.send("You are not allowed to use this command! (command error)");
		return
	}
}



