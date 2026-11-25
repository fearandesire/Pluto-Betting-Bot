import {
	propsErrorPayload,
	propsStatusPayload,
	propsStrategyPayload,
} from '../../../src/lib/discord/builders/props-settings.js'
import { type ClusterFixtures, FIXED } from './types.js'

const withoutFiles = <T extends { files?: unknown }>({
	files,
	...message
}: T): Omit<T, 'files'> => message

// New /props screens are V2 from the start, so each surface has only `after`.
const fixtures: ClusterFixtures = {
	cluster: 'props-settings',
	surfaces: [
		{
			id: 'S1',
			name: '/props status with strategy',
			after: () =>
				withoutFiles(
					propsStatusPayload(
						{ kind: 'enabled', channelId: FIXED.channelId },
						{
							kind: 'row',
							strategy: 'smart',
							enabled: true,
							postTime: '17:30',
						},
					),
				),
		},
		{
			id: 'S1b',
			name: '/props status paused by autopost settings',
			after: () =>
				withoutFiles(
					propsStatusPayload(
						{ kind: 'enabled', channelId: FIXED.channelId },
						{
							kind: 'row',
							strategy: 'smart',
							enabled: false,
							postTime: '17:30',
						},
					),
				),
		},
		{
			id: 'S2',
			name: '/props strategy updated',
			after: () => withoutFiles(propsStrategyPayload('smart')),
		},
		{
			id: 'S3',
			name: '/props strategy save unconfirmed',
			after: () =>
				withoutFiles(
					propsErrorPayload(
						'Pluto could not confirm the strategy was saved. Run /props status to see which strategy is active before trying again.',
					),
				),
		},
	],
}

export default fixtures
