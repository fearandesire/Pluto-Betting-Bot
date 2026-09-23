import {
	formatPredictionConfirmation,
	predictionPlacedEmbed,
} from '../../../src/lib/discord/builders/betting.js'
import type { ClusterFixtures } from './types.js'

// C3 lives in ButtonListener (owned by the betting cluster) but renders under props.
const fixtures: ClusterFixtures = {
	cluster: 'props',
	surfaces: [
		{
			id: 'C3',
			name: 'Prediction placed',
			before: async () => ({
				content: '',
				embeds: [
					predictionPlacedEmbed(
						await formatPredictionConfirmation(
							{
								name: 'Over',
								description: 'Jayson Tatum',
								point: 27.5,
							},
							'player_points',
							{
								home_team: 'Boston Celtics',
								away_team: 'Los Angeles Lakers',
								commence_time: '2026-10-05T23:30:00.000Z',
							},
						),
					),
				],
			}),
		},
	],
}

export default fixtures
