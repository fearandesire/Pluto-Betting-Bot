import { accent, divider, footer, text, v2Payload } from '../v2/kit.js'

/** What `/props status` reports for a guild. */
export type PropsSettingState =
	| { kind: 'not_set_up' }
	| { kind: 'enabled'; channelId: string }
	| { kind: 'disabled'; channelId: string }

/** What `/props status` knows about a server's strategy, autopost toggle and post time. */
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
 * Khronos decides whether `smart` runs and falls back to `default` on its own
 * reasons: AI props off, the guild outside the AI list, a missing key, no
 * candidates, a failed or over-budget AI call. Its settings response carries no
 * effective value, so Pluto states the fallback rather than claiming an outcome.
 */
const SMART_FALLBACK =
	'posts as Default whenever smart cannot run, for example while AI props are off'

/** Khronos skips a server whose own settings row turns the autopost off. */
const AUTOPOST_OFF_LINE =
	"**Posting:** off. This server's props autopost settings turn posting off."
const AUTOPOST_OFF_FOOTER =
	"Pluto can't turn that back on; staff manage it in the props settings."

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
		autopost.strategy === 'smart' ? ` (saved; ${SMART_FALLBACK})` : ''
	const postTime = autopost.postTime
		? `${autopost.postTime} UTC (set for this server)`
		: 'Shared schedule'
	return `**Strategy:** ${strategy}${saved}
**Post time:** ${postTime}`
}

export function propsStatusPayload(
	state: PropsSettingState,
	autopost: PropsAutopostState,
) {
	const autopostOff = autopost.kind === 'row' && !autopost.enabled
	if (state.kind === 'not_set_up') {
		return v2Payload({
			accent: accent('info'),
			blocks: [
				text('### Daily props: not set up'),
				text('No props channel is configured for this server.'),
				...(autopostOff ? [text(AUTOPOST_OFF_LINE)] : []),
				text(strategyLines(autopost)),
				divider(),
				footer(
					autopostOff
						? `${AUTOPOST_OFF_FOOTER} /props enable alone would not make them post.`
						: 'Set one up with /props enable.',
				),
			],
		})
	}
	if (autopostOff) {
		const paused = state.kind === 'enabled'
		return v2Payload({
			accent: accent('warning'),
			blocks: [
				text(`### Daily props: ${paused ? 'paused' : 'disabled'}`),
				text(`**Channel:** ${channelMention(state.channelId)}`),
				text(AUTOPOST_OFF_LINE),
				text(strategyLines(autopost)),
				divider(),
				footer(AUTOPOST_OFF_FOOTER),
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
					? `Smart is saved for this server. It ${SMART_FALLBACK}.`
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
