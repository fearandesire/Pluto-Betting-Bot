import type { PlacedBetslip } from '@kh-openapi'
import { PlacedBetslipBetresultEnum } from '../../openapi/khronos/index.js'

const DEFAULT_BALANCE = 10_000

export class MockStore {
	private readonly betsByUser = new Map<string, PlacedBetslip[]>()
	private readonly balancesByUser = new Map<string, number>()

	getBalance(userId: string): number {
		return this.balancesByUser.get(userId) ?? DEFAULT_BALANCE
	}

	setBalance(userId: string, balance: number): number {
		if (!Number.isFinite(balance) || balance < 0) {
			throw new Error(`Invalid balance: ${balance}`)
		}
		this.balancesByUser.set(userId, balance)
		return balance
	}

	debit(userId: string, amount: number): number {
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error(`Invalid debit amount: ${amount}`)
		}
		const balance = this.getBalance(userId)
		if (balance < amount) {
			throw new Error(
				`Mock account ${userId} has insufficient funds: ${balance}`,
			)
		}
		return this.setBalance(userId, balance - amount)
	}

	credit(userId: string, amount: number): number {
		if (!Number.isFinite(amount) || amount < 0) {
			throw new Error(`Invalid credit amount: ${amount}`)
		}
		return this.setBalance(userId, this.getBalance(userId) + amount)
	}

	placeBet(bet: PlacedBetslip): PlacedBetslip {
		const existing = this.getBets(bet.userid)
		this.betsByUser.set(bet.userid, [...existing, bet])
		return bet
	}

	cancelBet(userId: string, betId: number): PlacedBetslip {
		const bets = this.getBets(userId)
		const bet = bets.find(
			(item) =>
				item.betid === betId &&
				item.betresult === PlacedBetslipBetresultEnum.Pending,
		)
		if (!bet) {
			throw new Error(
				`Mock bet ${betId} was not found for user ${userId}`,
			)
		}

		const updatedBet = {
			...bet,
			betresult: PlacedBetslipBetresultEnum.Push,
		}

		this.betsByUser.set(
			userId,
			bets.map((item) => (item.betid === betId ? updatedBet : item)),
		)
		this.credit(userId, bet.amount)
		return updatedBet
	}

	getBets(userId: string): PlacedBetslip[] {
		return [...(this.betsByUser.get(userId) ?? [])]
	}

	clearPending(userId: string): void {
		const bets = this.getBets(userId)
		const pendingBets = bets.filter(
			(bet) => bet.betresult === PlacedBetslipBetresultEnum.Pending,
		)
		for (const bet of pendingBets) {
			this.credit(userId, bet.amount)
		}
		this.betsByUser.set(
			userId,
			bets.filter(
				(bet) => bet.betresult !== PlacedBetslipBetresultEnum.Pending,
			),
		)
	}

	updateBet(userId: string, betId: number, nextBet: PlacedBetslip): void {
		const bets = this.getBets(userId)
		if (!bets.some((bet) => bet.betid === betId)) {
			throw new Error(
				`Mock bet ${betId} was not found for user ${userId}`,
			)
		}
		this.betsByUser.set(
			userId,
			bets.map((bet) => (bet.betid === betId ? nextBet : bet)),
		)
	}

	reset(): void {
		this.betsByUser.clear()
		this.balancesByUser.clear()
	}
}
