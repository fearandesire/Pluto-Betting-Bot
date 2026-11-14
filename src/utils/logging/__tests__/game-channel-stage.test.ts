import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { runWithRequestId } from '../../../lib/telemetry/request-context.js'
import {
	canonicalGameId,
	creationJobRequestId,
	gameChannelSport,
	logGameChannelStage,
	safeRequestId,
	topLevelJobRequestId,
} from '../game-channel-stage.js'
import { logger } from '../WinstonLogger.js'

beforeEach(() => vi.clearAllMocks())

describe('canonicalGameId', () => {
	it('lowercases and strips hyphens', () => {
		expect(canonicalGameId('0F0E0D0C-0B0A-4908-8706-050403020100')).toBe(
			'0f0e0d0c0b0a49088706050403020100',
		)
	})
	it.each([undefined, 42, '', 'game-1', 'x'.repeat(32)])(
		'rejects %j',
		(raw) => expect(canonicalGameId(raw)).toBeUndefined(),
	)
})

describe('gameChannelSport', () => {
	it.each([
		['NBA', 'nba'],
		['basketball_nba', 'nba'],
		['americanfootball_nfl', 'nfl'],
		['mlb', undefined],
	])('%s -> %s', (raw, sport) => expect(gameChannelSport(raw)).toBe(sport))
})

describe('logGameChannelStage', () => {
	const base = {
		stage: 'created',
		reason: 'created',
		gameId: '0f0e0d0c0b0a49088706050403020100',
		sport: 'nba',
		guildId: 'guild-1',
	} as const
	it('logs the shared contract fields at info for ok', () => {
		logGameChannelStage({ ...base, outcome: 'ok' })
		expect(logger.info).toHaveBeenCalledWith({
			message: 'game_channel.stage',
			event: 'game_channel.stage',
			game_id: '0f0e0d0c0b0a49088706050403020100',
			sport: 'nba',
			stage: 'created',
			outcome: 'ok',
			reason: 'created',
			attempt: undefined,
			guild_id: 'guild-1',
			channel_name: undefined,
			ts: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
		})
	})
	it('logs retrying at warn with its attempt', () => {
		logGameChannelStage({ ...base, outcome: 'retrying', attempt: 2 })
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'retrying', attempt: 2 }),
		)
	})
	it('logs failed at error', () => {
		logGameChannelStage({ ...base, outcome: 'failed' })
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'failed' }),
		)
	})
	it.each(['skipped', 'held', 'duplicate', 'deferred'] as const)(
		'logs %s at info',
		(outcome) => {
			logGameChannelStage({ ...base, outcome })
			expect(logger.info).toHaveBeenCalledOnce()
		},
	)
})

describe('request_id', () => {
	const ok = { stage: 'created', outcome: 'ok', reason: 'created' } as const
	const lastLine = () =>
		vi.mocked(logger.info).mock.calls.slice(-1)[0]?.[0] as Record<
			string,
			unknown
		>

	it('carries the upstream id of the job in progress', () => {
		runWithRequestId(
			'job-1',
			() => logGameChannelStage(ok),
			'cron-6f1c2d1e-8a8f-4c53-9f0e-2c3a1b9d7e10',
		)
		expect(lastLine().request_id).toBe(
			'cron-6f1c2d1e-8a8f-4c53-9f0e-2c3a1b9d7e10',
		)
	})
	it('omits it when the job carried none', () => {
		runWithRequestId('job-1', () => logGameChannelStage(ok))
		expect('request_id' in lastLine()).toBe(true)
		expect(JSON.parse(JSON.stringify(lastLine()))).not.toHaveProperty(
			'request_id',
		)
	})
	it.each([
		undefined,
		42,
		'',
		'x'.repeat(129),
		'has space',
		'line\nbreak',
		'a/b',
	])('rejects %j', (raw) => expect(safeRequestId(raw)).toBeUndefined())
	it('accepts caller-supplied ids', () => {
		expect(safeRequestId('caller.id_1:a-b')).toBe('caller.id_1:a-b')
		expect(safeRequestId('x'.repeat(128))).toHaveLength(128)
	})
	it('reads creation ids from metadata and the others from the top level', () => {
		expect(
			creationJobRequestId({
				data: { metadata: { requestId: 'cron-1' } },
			}),
		).toBe('cron-1')
		expect(creationJobRequestId({ data: { metadata: {} } })).toBeUndefined()
		expect(creationJobRequestId({ data: undefined })).toBeUndefined()
		expect(topLevelJobRequestId({ data: { requestId: 'cron-2' } })).toBe(
			'cron-2',
		)
		expect(
			topLevelJobRequestId({ data: { requestId: {} } }),
		).toBeUndefined()
	})
})
