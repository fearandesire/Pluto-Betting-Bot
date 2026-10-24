import { accent, divider, footer, text, v2Payload } from '../v2/kit.js'

/** What `/props status` reports for a guild. */
export type PropsSettingState =
	| { kind: 'not_set_up' }
	| { kind: 'enabled'; channelId: string }
	| { kind: 'disabled'; channelId: string }

const channelMention = (channelId: string) => `<#${channelId}>`

export function propsEnabledPayload(channelId: string) {
	return v2Payload({
		accent: accent('success'),
		blocks: [
			text('### Daily props enabled'),
			text(
				`Daily player props will post in ${channelMention(channelId)}.`,
			),
			divider(),
			footer('Turn them off any time with /props disable.'),
		],
	})
}

export function propsDisabledPayload() {
	return v2Payload({
		accent: accent('warning'),
		blocks: [
			text('### Daily props disabled'),
			text(
				'Daily player props stop from the next run. Your props channel is kept.',
			),
			divider(),
			footer('Turn them back on with /props enable.'),
		],
	})
}

export function propsMissingPermissionsPayload(
	channelId: string,
	missing: string[],
) {
	return v2Payload({
		accent: accent('error'),
		blocks: [
			text('### Missing permissions'),
			text(
				`Pluto needs these permissions in ${channelMention(channelId)} before it can post props there:\n${missing.map((name) => `- ${name}`).join('\n')}`,
			),
			divider(),
			footer(
				'Nothing was changed. Grant them and run /props enable again.',
			),
		],
	})
}

export function propsStatusPayload(state: PropsSettingState) {
	if (state.kind === 'not_set_up') {
		return v2Payload({
			accent: accent('info'),
			blocks: [
				text('### Daily props: not set up'),
				text('No props channel is configured for this server.'),
				divider(),
				footer('Set one up with /props enable.'),
			],
		})
	}
	const enabled = state.kind === 'enabled'
	return v2Payload({
		accent: accent(enabled ? 'success' : 'warning'),
		blocks: [
			text(`### Daily props: ${enabled ? 'enabled' : 'disabled'}`),
			text(`**Channel:** ${channelMention(state.channelId)}`),
			divider(),
			footer(
				enabled
					? 'Turn them off with /props disable.'
					: 'Turn them back on with /props enable.',
			),
		],
	})
}

export function propsErrorPayload(summary: string, detail?: string) {
	return v2Payload({
		accent: accent('error'),
		blocks: [
			text('### Something went wrong'),
			text(summary),
			...(detail ? [footer(detail)] : []),
		],
	})
}
