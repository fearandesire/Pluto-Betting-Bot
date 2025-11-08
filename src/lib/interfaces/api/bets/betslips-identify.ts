import type { IPendingBetslip } from './betslips.interfaces.js'

export function isPendingBetslip(obj: any): obj is IPendingBetslip {
	return 'userid' in obj && 'amount' in obj && 'team' in obj
}
