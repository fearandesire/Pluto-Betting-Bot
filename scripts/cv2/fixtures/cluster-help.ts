import embedColors from '../../../src/lib/colorsConfig.js'
import { APP_OWNER_INFO } from '../../../src/lib/configs/constants.js'
import { changelogEmbed } from '../../../src/lib/discord/builders/changelog.js'
import { infoEmbed } from '../../../src/lib/discord/builders/info.js'
import { PatreonInformation } from '../../../src/utils/api/patreon/interfaces.js'
import PlutoInfo from '../../../src/utils/commands/info/info.js'
import type { ClusterFixtures } from './types.js'

const fixtures: ClusterFixtures = {
	cluster: 'help',
	surfaces: [
		{
			id: 'G1',
			name: '/help',
			before: async () => ({
				embeds: [infoEmbed(await PlutoInfo.helpInfo())],
			}),
		},
		{
			id: 'G2',
			name: '/patreon',
			before: () => ({
				embeds: [
					infoEmbed({
						title: 'Supporting Development | Patreon 💙',
						description: PatreonInformation,
						color: embedColors.PlutoBlue,
						footer: 'For questions, message me on Discord: fenixforever',
						thumbnail: 'https://i.imgur.com/qG3Mm5t.png',
					}),
				],
			}),
		},
		{
			id: 'G3',
			name: '/changelog',
			before: () => ({
				embeds: [
					changelogEmbed(
						{
							version: '4.12.4',
							title: 'Playoff odds & faster bet slips',
							content:
								'- 🏀 NBA playoff series odds now show in `/odds`\\n- ⚡ Bet slips confirm faster\\n- 🐛 Fixed `/mybets` paging on long histories',
							published_at: new Date('2026-10-02T17:00:00Z'),
						},
						APP_OWNER_INFO.discord_id,
					),
				],
			}),
		},
	],
}

export default fixtures
