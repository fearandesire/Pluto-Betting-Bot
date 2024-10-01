import {
	type Events,
	Listener,
	type ChatInputCommandDeniedPayload,
	type UserError,
} from '@sapphire/framework';

export class ChatInputCommandDenied extends Listener<
	typeof Events.ChatInputCommandDenied
> {
	public run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		if (interaction.deferred || interaction.replied) {
			return interaction.editReply({
				content: error?.message || 'Authorization error.',
			});
		}

		return interaction.reply({
			content: error?.message || 'Authorization error.',
			ephemeral: true,
		});
	}
}
