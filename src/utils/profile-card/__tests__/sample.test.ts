import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'
import { renderProfileCard } from '../profile-card.js'
import { emptyCard, fullCard, stressCard } from './fixtures.js'

/**
 * Writes sample PNGs for a human to look at. Skipped unless a directory is set:
 * PROFILE_CARD_SAMPLE_DIR=/some/dir pnpm vitest run src/utils/profile-card/__tests__/sample
 */
const dir = process.env.PROFILE_CARD_SAMPLE_DIR

describe.skipIf(!dir)('profile card samples', () => {
	it('writes sample PNGs', async () => {
		mkdirSync(dir as string, { recursive: true })
		const samples = {
			'profile-card-sample.png': fullCard,
			'profile-card-sample-empty.png': emptyCard,
			'profile-card-sample-stress.png': stressCard,
		}
		for (const [file, data] of Object.entries(samples)) {
			writeFileSync(
				path.join(dir as string, file),
				await renderProfileCard(data),
			)
		}
	})
})
