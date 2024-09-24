import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

@ApplyOptions<Command.Options>({
	description: 'Ping the app'
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
		const latency = sent.createdTimestamp - interaction.createdTimestamp;
		await interaction.editReply(`Pong! Latency is ${latency}ms. API Latency is ${Math.round(this.container.client.ws.ping)}ms`);
	}
}
