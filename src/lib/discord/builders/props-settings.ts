import { accent, divider, footer, text, v2Payload } from '../v2/kit.js'

/** What `/props status` reports for a guild. */
export type PropsSettingState =
	| { kind: 'not_set_up' }
	| { kind: 'enabled'; channelId: string }
	| { kind: 'disabled'; channelId: string }

/** What `/props status` knows about a server's strategy and post time. */
export type PropsAutopostState =
	| {
			kind: 'row'
			strategy: string
			enabled: boolean
			postTime: string | null
	  }
	| { kind: 'default' }
	| { kind: 'unavailable' }

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

const STRATEGY_LABELS: Record<string, string> = {
	default: 'Default',
	smart: 'Smart',
}

/**
 * Khronos decides whether `smart` runs: it falls back to `default` while AI
 * props are off or the guild is not entitled, and its settings response carries
 * no effective value, so Pluto states the gate instead of claiming an outcome.
 */
const SMART_FALLBACK = 'AI props are off or this server is not on the AI list'

function strategyLines(autopost: PropsAutopostState): string {
	if (autopost.kind === 'unavailable') {
		return 'Strategy and post time: settings unavailable right now.'
	}
	if (autopost.kind === 'default') {
		return `**Strategy:** Default
**Post time:** Shared schedule`
	}
	const strategy = STRATEGY_LABELS[autopost.strategy] ?? autopost.strategy
	const saved =
		autopost.strategy === 'smart'
			? ` (saved; posts as Default while ${SMART_FALLBACK})`
			: ''
	const postTime = autopost.postTime
		? `${autopost.postTime} UTC (this server's own time)`
		: 'Shared schedule'
	return `**Strategy:** ${strategy}${saved}
**Post time:** ${postTime}`
}

export function propsStatusPayload(
	state: PropsSettingState,
	autopost: PropsAutopostState,
) {
	if (state.kind === 'not_set_up') {
		return v2Payload({
			accent: accent('info'),
			blocks: [
				text('### Daily props: not set up'),
				text('No props channel is configured for this server.'),
				text(strategyLines(autopost)),
				divider(),
				footer('Set one up with /props enable.'),
			],
		})
	}
	if (
		state.kind === 'enabled' &&
		autopost.kind === 'row' &&
		!autopost.enabled
	) {
		return v2Payload({
			accent: accent('warning'),
			blocks: [
				text('### Daily props: paused'),
				text(`**Channel:** ${channelMention(state.channelId)}`),
				text(
					"**Posting:** off. This server's props autopost settings turn posting off, even though /props is on.",
				),
				text(strategyLines(autopost)),
				divider(),
				footer(
					'Staff can turn the autopost back on in the props settings.',
				),
			],
		})
	}
	const enabled = state.kind === 'enabled'
	return v2Payload({
		accent: accent(enabled ? 'success' : 'warning'),
		blocks: [
			text(`### Daily props: ${enabled ? 'enabled' : 'disabled'}`),
			text(`**Channel:** ${channelMention(state.channelId)}`),
			text(strategyLines(autopost)),
			divider(),
			footer(
				enabled
					? 'Turn them off with /props disable.'
					: 'Turn them back on with /props enable.',
			),
		],
	})
}

export function propsStrategyPayload(strategy: string) {
	const label = STRATEGY_LABELS[strategy] ?? strategy
	return v2Payload({
		accent: accent('success'),
		blocks: [
			text('### Props strategy updated'),
			text(
				strategy === 'smart'
					? `Smart is saved for this server. It posts as the Default strategy while ${SMART_FALLBACK}.`
					: `Daily props will use the **${label}** strategy.`,
			),
			divider(),
			footer('See it any time with /props status.'),
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
