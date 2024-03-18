import { NotifyBetUsers } from './notifications.interface.js'

export function isNotifyBetUsers(payload: any): payload is NotifyBetUsers {
	return 'winners' in payload && 'losers' in payload
}
