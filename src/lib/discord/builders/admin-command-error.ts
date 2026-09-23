import { EmbedBuilder } from 'discord.js'
import embedColors from '../../colorsConfig.js'

export type CommandErrorLogMeta = {
	commandName: string
	subcommandGroup: string | null
	subcommand: string | null
	userId: string
	durationMs: number
}

/**
 * F8 command-error log embed. Copy of the inline builder in
 * `listeners/chatInputCommandError.ts` `postToLogChannel`; the listener does
 * not call this yet. Wire it in when the admin messages migrate and delete
 * the inline copy.
 */
export function commandErrorLogEmbed(
	err: unknown,
	meta: CommandErrorLogMeta,
	cwd: string,
) {
	const error = err instanceof Error ? err : new Error(String(err))

	const pathParts = [
		meta.commandName,
		meta.subcommandGroup,
		meta.subcommand,
	].filter(Boolean)
	const commandPath = `/${pathParts.join(' ')}`

	const normalizedCwd = cwd.replace(/\\/g, '/')
	const rawStack = (error.stack ?? error.message)
		.split('\n')
		.slice(0, 4)
		.map((line) => line.replace(normalizedCwd, '').trim())
		.join('\n')

	const maxStackLength = 1016
	const trimmedStack =
		rawStack.length > maxStackLength
			? rawStack.slice(0, maxStackLength - 3) + '...'
			: rawStack
	const stackBlock = `\`\`\`\n${trimmedStack}\n\`\`\``

	return new EmbedBuilder()
		.setColor(embedColors.error as `#${string}`)
		.setTitle('Command Error')
		.addFields(
			{ name: 'Command', value: commandPath, inline: true },
			{ name: 'User', value: `<@${meta.userId}>`, inline: true },
			{ name: 'Duration', value: `${meta.durationMs}ms`, inline: true },
			{
				name: 'Error',
				value: `\`${error.name}: ${error.message.slice(0, 200)}\``,
			},
			{ name: 'Stack', value: stackBlock },
		)
		.setTimestamp()
}
