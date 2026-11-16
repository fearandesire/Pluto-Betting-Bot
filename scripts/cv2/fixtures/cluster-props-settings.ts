import {
	propsErrorPayload,
	propsStatusPayload,
	propsStrategyPayload,
} from '../../../src/lib/discord/builders/props-settings.js'
import { type ClusterFixtures, FIXED } from './types.js'

// New /props screens are V2 from the start, so each surface has only `after`.
const fixtures: ClusterFixtures = {
	cluster: 'props-settings',
	surfaces: [
		{
			id: 'S1',
			name: '/props status with strategy',
			after: () =>
				propsStatusPayload(
					{ kind: 'enabled', channelId: FIXED.channelId },
					{ kind: 'loaded', strategy: 'smart', postTime: '17:30' },
				),
		},
		{
			id: 'S2',
			name: '/props strategy updated',
			after: () => propsStrategyPayload('smart'),
		},
		{
			id: 'S3',
			name: '/props strategy save unconfirmed',
			after: () =>
				propsErrorPayload(
					'Pluto could not confirm the strategy was saved. Run /props status to see which strategy is active before trying again.',
				),
		},
	],
}

export default fixtures
