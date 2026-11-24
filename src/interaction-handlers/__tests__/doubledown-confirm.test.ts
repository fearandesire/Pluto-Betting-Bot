import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/startup/env.js', () => ({ default: {} }))
vi.mock('@pluto-config', () => ({
	betFooter: vi.fn().mockReturnValue(''),
	helpfooter: '',
	supportMessage: '',
}))
vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}))
vi.mock('../../utils/common/errors/global.js', () => ({
	ErrorEmbeds: { internalErr: vi.fn().mockResolvedValue({}) },
}))
vi.mock('../../utils/api/Khronos/KhronosInstances.js', () => ({
	KH_API_CONFIG: { basePath: 'http://localhost' },
}))
vi.mock('../../utils/dev/index.js', () => ({
	isMockEnabled: vi.fn().mockReturnValue(false),
	MockBackend: { instance: vi.fn() },
}))
vi.mock('../../utils/api/common/handleNewUser.js', () => ({
	handleNewUser: vi.fn(),
}))
vi.mock('../../utils/cache/redis-instance.js', () => ({ default: {} }))
vi.mock('../../lib/startup/pluto.js', () => ({ startPluto: vi.fn() }))
vi.mock('../../utils/api/patreon/Patreon-Facade.js', () => ({
	default: { memberDetails: vi.fn() },
}))

import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js'
import { StaleDoubleDownError } from '../../utils/api/Khronos/bets/odds-changed.js'
import PatreonFacade from '../../utils/api/patreon/Patreon-Facade.js'
import { ButtonHandler } from '../ButtonListener.js'

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((r) => {
		resolve = r
	})
	return { promise, resolve }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function confirmClick() {
	return {
		customId: 'dd.v1.confirm.7.-120.10000',
		user: { id: 'u1', displayAvatarURL: () => 'https://cdn.example/a.png' },
		deferred: true,
		replied: false,
		deferUpdate: vi.fn(async () => undefined),
		editReply: vi.fn(async () => ({})),
		deleteReply: vi.fn(async () => undefined),
		followUp: vi.fn(async () => ({})),
	}
}

const committed = {
	betslip: {
		newBetAmount: 200,
		newPayout: 440,
		newProfit: 240,
		newBalance: 800,
	},
}

describe('double-down confirm button', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.mocked(PatreonFacade.memberDetails).mockReset()
	})

	it('keeps the first receipt when a second click waits on membership', async () => {
		const handler = new ButtonHandler({} as never, {} as never)
		const patch = deferred<unknown>()
		const member = deferred<unknown>()
		vi.mocked(PatreonFacade.memberDetails)
			.mockResolvedValueOnce({ id: 'm' } as never)
			.mockReturnValueOnce(member.promise as never)
		const doubleDown = vi
			.spyOn(BetslipManager.prototype, 'doubleDown')
			.mockImplementationOnce(() => patch.promise as never)
			.mockRejectedValue(new StaleDoubleDownError())
		const first = confirmClick()
		const second = confirmClick()

		const firstRun = handler.parse(first as never)
		await flush()
		const secondRun = handler.parse(second as never)
		await flush()
		patch.resolve(committed)
		await firstRun
		member.resolve({ id: 'm' })
		await secondRun

		expect(doubleDown).toHaveBeenCalledTimes(1)
		expect(first.deleteReply).not.toHaveBeenCalled()
		expect(second.deleteReply).not.toHaveBeenCalled()
		expect(JSON.stringify(second.followUp.mock.calls)).toContain(
			'Double down already in progress',
		)
	})

	it('keeps the shared message when the bet changed since the prompt', async () => {
		const handler = new ButtonHandler({} as never, {} as never)
		vi.mocked(PatreonFacade.memberDetails).mockResolvedValue({
			id: 'm',
		} as never)
		vi.spyOn(BetslipManager.prototype, 'doubleDown').mockRejectedValue(
			new StaleDoubleDownError(),
		)
		const click = confirmClick()

		await handler.parse(click as never)

		expect(click.deleteReply).not.toHaveBeenCalled()
		expect(JSON.stringify(click.followUp.mock.calls)).toContain(
			'Double down not placed',
		)
	})
})
