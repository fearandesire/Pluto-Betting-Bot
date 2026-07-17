import type { PropDto, PropOutcomeDetailDto } from '@pluto-khronos/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	getPropByUuid: vi.fn(),
	setResult: vi.fn(),
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
	containerLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
	appLog: vi.fn(),
	handleApiError: vi.fn(),
}))

vi.mock('../../api/Khronos/props/props-api-wrapper.js', () => ({
	default: class {
		getPropByUuid = mocks.getPropByUuid
		setResult = mocks.setResult
	},
}))

vi.mock('../../api/Khronos/error-handling/ApiErrorHandler.js', () => ({
	ApiErrorHandler: class {
		handle = mocks.handleApiError
	},
}))

vi.mock('../../api/Khronos/prediction/predictionApiWrapper.js', () => ({
	default: class {},
}))

vi.mock('../../api/Khronos/guild/guild-wrapper.js', () => ({
	default: class {},
}))

vi.mock('../../props/PropPostingHandler.js', () => ({
	PropPostingHandler: class {},
}))

vi.mock('../../logging/AppLog.js', () => ({
	default: { log: mocks.appLog },
}))

vi.mock('../../logging/WinstonLogger.js', () => ({ logger: mocks.logger }))

vi.mock('@sapphire/framework', () => ({
	container: { logger: mocks.containerLogger },
}))

vi.mock('@sapphire/discord.js-utilities', () => ({
	PaginatedMessageEmbedFields: class {},
}))

const { AdminPropsHandler } = await import('../admin-props-handler.js')

const OVER_UUID = '550e8400-e29b-41d4-a716-446655440000'
const UNDER_UUID = '550e8400-e29b-41d4-a716-446655440001'

const overOutcome: PropOutcomeDetailDto = {
	outcome_uuid: OVER_UUID,
	name: 'Over',
	outcome_type: 'OVER',
	price: -110,
	point: 20.5,
}

const underOutcome: PropOutcomeDetailDto = {
	outcome_uuid: UNDER_UUID,
	name: 'Under',
	outcome_type: 'UNDER',
	price: -110,
	point: 20.5,
}

const makeProp = (outcomes: PropOutcomeDetailDto[]): PropDto =>
	({
		event_id: 'event-1',
		market_key: 'player_points',
		bookmaker_key: 'draftkings',
		outcomes,
	}) as PropDto

const makeResponse = (correct: number, incorrect: number) => ({
	correct_predictions_count: correct,
	incorrect_predictions_count: incorrect,
	total_predictions_count: correct + incorrect,
})

const makeInteraction = (side: 'Over' | 'Under' = 'Over') => {
	const editReply = vi.fn().mockResolvedValue(undefined)
	const reply = vi.fn().mockResolvedValue(undefined)
	return {
		editReply,
		reply,
		deferReply: vi.fn().mockResolvedValue(undefined),
		guildId: 'guild-1',
		user: { id: 'admin-1', username: 'admin' },
		options: {
			getString: vi.fn((name: string): string =>
				name === 'prop_id' ? OVER_UUID : side,
			),
		},
	}
}

const runSetresult = async (
	interaction: ReturnType<typeof makeInteraction>,
) => {
	await new AdminPropsHandler().handleSetresult(interaction as never)
}

const replyContent = (mock: ReturnType<typeof vi.fn>): string =>
	mock.mock.calls[0][0].content

describe('AdminPropsHandler.handleSetresult', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.appLog.mockResolvedValue(undefined)
	})

	it('settles the selected side as won and its counterpart as lost', async () => {
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, underOutcome]),
		)
		mocks.setResult
			.mockResolvedValueOnce(makeResponse(3, 0))
			.mockResolvedValueOnce(makeResponse(0, 2))

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		expect(mocks.setResult).toHaveBeenCalledTimes(2)
		expect(mocks.setResult).toHaveBeenNthCalledWith(1, {
			propId: OVER_UUID,
			result: 'won',
			guild_id: 'guild-1',
		})
		expect(mocks.setResult).toHaveBeenNthCalledWith(2, {
			propId: UNDER_UUID,
			result: 'lost',
			guild_id: 'guild-1',
		})
	})

	it('settles Under as won when Under is selected, regardless of outcome order', async () => {
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, underOutcome]),
		)
		mocks.setResult
			.mockResolvedValueOnce(makeResponse(1, 0))
			.mockResolvedValueOnce(makeResponse(0, 4))

		await runSetresult(makeInteraction('Under'))

		expect(mocks.setResult).toHaveBeenNthCalledWith(1, {
			propId: UNDER_UUID,
			result: 'won',
			guild_id: 'guild-1',
		})
		expect(mocks.setResult).toHaveBeenNthCalledWith(2, {
			propId: OVER_UUID,
			result: 'lost',
			guild_id: 'guild-1',
		})
	})

	it('reports both sides and their counts in the embed', async () => {
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, underOutcome]),
		)
		mocks.setResult
			.mockResolvedValueOnce(makeResponse(3, 0))
			.mockResolvedValueOnce(makeResponse(0, 2))

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		const embed = interaction.editReply.mock.calls[0][0].embeds[0]
		const fields = embed.data.fields as Array<{
			name: string
			value: string
		}>

		expect(fields).toHaveLength(2)
		expect(fields[0].name).toContain('Over')
		expect(fields[0].name).toContain('won')
		expect(fields[0].value).toContain('Correct: **3**')
		expect(fields[1].name).toContain('Under')
		expect(fields[1].name).toContain('lost')
		expect(fields[1].value).toContain('Incorrect: **2**')
	})

	it('aborts without settling when an outcome has no outcome_type', async () => {
		const unlabelled: PropOutcomeDetailDto = {
			...underOutcome,
			outcome_type: undefined,
		}
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, unlabelled]),
		)

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		expect(mocks.setResult).not.toHaveBeenCalled()
		expect(replyContent(interaction.editReply)).toContain(
			'nothing was settled',
		)
	})

	it('aborts without settling when the market has three outcomes', async () => {
		const draw: PropOutcomeDetailDto = {
			outcome_uuid: '550e8400-e29b-41d4-a716-446655440002',
			name: 'Draw',
			outcome_type: 'NO',
			price: 200,
		}
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, underOutcome, draw]),
		)

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		expect(mocks.setResult).not.toHaveBeenCalled()
		expect(replyContent(interaction.editReply)).toContain(
			'nothing was settled',
		)
	})

	it('aborts without settling when the counterpart side is absent', async () => {
		const yes: PropOutcomeDetailDto = {
			...underOutcome,
			name: 'Yes',
			outcome_type: 'YES',
		}
		mocks.getPropByUuid.mockResolvedValue(makeProp([overOutcome, yes]))

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		expect(mocks.setResult).not.toHaveBeenCalled()
		expect(replyContent(interaction.editReply)).toContain(
			'nothing was settled',
		)
	})

	it('aborts without settling when two outcomes share the selected side', async () => {
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([
				overOutcome,
				{ ...overOutcome, outcome_uuid: UNDER_UUID },
			]),
		)

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		expect(mocks.setResult).not.toHaveBeenCalled()
	})

	it('rejects an invalid prop id before any lookup or settlement', async () => {
		const interaction = makeInteraction('Over')
		interaction.options.getString = vi.fn((name: string): string =>
			name === 'prop_id' ? 'not-a-uuid' : 'Over',
		)

		await runSetresult(interaction)

		expect(mocks.getPropByUuid).not.toHaveBeenCalled()
		expect(mocks.setResult).not.toHaveBeenCalled()
	})

	it('names the unsettled side when the losing-side call fails', async () => {
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, underOutcome]),
		)
		mocks.setResult
			.mockResolvedValueOnce(makeResponse(3, 0))
			.mockRejectedValueOnce(new Error('Failed to set prop result: 500'))

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		const content = replyContent(interaction.editReply)
		// The won side is already paid out; the admin must be told precisely which
		// outcome is still unsettled rather than shown a generic failure.
		expect(content).toContain('Partial settlement')
		expect(content).toContain(UNDER_UUID)
		expect(content).toContain(OVER_UUID)
		expect(content).toContain('won')
		expect(content).toContain('Re-run')
		expect(mocks.handleApiError).not.toHaveBeenCalled()
	})

	it('reports a generic error without partial-settlement wording when the winning-side call fails', async () => {
		mocks.getPropByUuid.mockResolvedValue(
			makeProp([overOutcome, underOutcome]),
		)
		mocks.setResult.mockRejectedValueOnce(new Error('boom'))

		const interaction = makeInteraction('Over')
		await runSetresult(interaction)

		expect(mocks.setResult).toHaveBeenCalledTimes(1)
		expect(mocks.handleApiError).toHaveBeenCalledTimes(1)
		expect(interaction.editReply).not.toHaveBeenCalled()
	})

	it('does not settle when the market lookup fails', async () => {
		mocks.getPropByUuid.mockRejectedValue(new Error('lookup failed'))

		await runSetresult(makeInteraction('Over'))

		expect(mocks.setResult).not.toHaveBeenCalled()
		expect(mocks.handleApiError).toHaveBeenCalledTimes(1)
	})
})
