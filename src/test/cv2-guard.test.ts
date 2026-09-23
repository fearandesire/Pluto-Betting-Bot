/**
 * Components V2 migration guard. Fails when a file outside the allowlist
 * builds classic embeds, so new classic surfaces can't slip in mid-migration.
 * Each migration PR deletes its files from CLASSIC_ALLOWLIST; the list should
 * end empty apart from documented holdouts (docs/components-v2/README.md).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const CLASSIC = /\bEmbedBuilder\b|\bembeds\s*:|PaginatedMessageEmbedFields/

// Paths relative to src/. Keep sorted.
const CLASSIC_ALLOWLIST = new Set<string>([
	'commands/account/balance.ts',
	'commands/account/dailyclaim.ts',
	'commands/admin/config.ts',
	'commands/betting/bet.ts',
	'commands/betting/cancelbet.ts',
	'commands/betting/doubledown.ts',
	'commands/betting/leaderboard.ts',
	'commands/betting/mybets.ts',
	'commands/betting/odds.ts',
	'commands/betting/parlay.ts',
	'commands/configuration/config.ts',
	'commands/info/changelog.ts',
	'commands/info/commands.ts',
	'commands/info/faq.ts',
	'commands/info/help.ts',
	'commands/info/patreon.ts',
	'commands/predictions/predictions.ts',
	'commands/stats/stats.ts',
	'interaction-handlers/ButtonListener.ts',
	'interaction-handlers/my-bets-pagination-handler.ts',
	'lib/discord/builders/account.ts',
	'lib/discord/builders/admin-command-error.ts',
	'lib/discord/builders/admin.ts',
	'lib/discord/builders/betting.ts',
	'lib/discord/builders/changelog.ts',
	'lib/discord/builders/info.ts',
	'lib/discord/builders/notifications.ts',
	'lib/discord/builders/odds.ts',
	'lib/discord/builders/props.ts',
	'lib/discord/v2/edit.ts',
	'lib/discord/v2/notice.ts',
	'listeners/chatInputCommandError.ts',
	'services/engagement/BigWinAnnouncementService.ts',
	'utils/admin-handlers/admin-predictions-handler.ts',
	'utils/admin-handlers/admin-props-handler.ts',
	'utils/api/Khronos/accounts/AccountManager.ts',
	'utils/api/Khronos/bets/BetslipsManager.ts',
	'utils/api/Khronos/bets/mybets-formatter.service.ts',
	'utils/api/Khronos/error-handling/ApiErrorHandler.ts',
	'utils/api/Khronos/guild/guild-wrapper.ts',
	'utils/api/common/WelcomeMessageService.ts',
	'utils/api/controllers/props-stats.ts',
	'utils/api/requests/accounts/AccountManager.ts',
	'utils/api/requests/matchups/GameSchedule.ts',
	'utils/api/routes/notifications/notifications.service.ts',
	'utils/bot_res/parseScheduled.ts',
	'utils/commands/prediction-deprecation.ts',
	'utils/common/errors/global.ts',
	'utils/cron/RecapCronService.ts',
	'utils/embeds/pagination-utilities.ts',
	'utils/embeds/weekly-recap.embed.ts',
	'utils/guilds/channels/ChannelManager.ts',
	'utils/guilds/prop-embeds/PropEmbedManager.ts',
	'utils/logging/AppLog.ts',
	'utils/props/PropPostingHandler.ts',
])

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name)
		if (statSync(full).isDirectory()) {
			if (name !== '__tests__' && name !== 'test') walk(full, out)
		} else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
			out.push(full)
		}
	}
	return out
}

const classicFiles = walk(SRC)
	.filter((f) => CLASSIC.test(readFileSync(f, 'utf8')))
	.map((f) => path.relative(SRC, f).split(path.sep).join('/'))
	.sort()

describe('components v2 guard', () => {
	it('no new classic-embed files outside the allowlist', () => {
		const unexpected = classicFiles.filter((f) => !CLASSIC_ALLOWLIST.has(f))
		expect(
			unexpected,
			'Build new message UI with src/lib/discord/v2 (see docs/components-v2/README.md)',
		).toEqual([])
	})

	it('allowlist has no stale entries (remove files you migrated)', () => {
		const stale = [...CLASSIC_ALLOWLIST].filter(
			(f) => !classicFiles.includes(f),
		)
		expect(stale).toEqual([])
	})
})
