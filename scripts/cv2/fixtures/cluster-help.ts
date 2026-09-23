import { infoEmbed } from '../../../src/lib/discord/builders/info.js'
import PlutoInfo from '../../../src/utils/commands/info/info.js'
import type { ClusterFixtures } from './types.js'

const fixtures: ClusterFixtures = {
	cluster: 'help',
	surfaces: [
		{
			id: 'G1',
			name: '/help',
			before: async () => ({ embeds: [infoEmbed(await PlutoInfo.helpInfo())] }),
		},
	],
}

export default fixtures
