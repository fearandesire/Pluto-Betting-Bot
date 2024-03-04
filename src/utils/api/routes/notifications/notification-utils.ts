import { NotifyBetUsers } from '../../common/interfaces/common-interfaces'

export function isNotifyBetUsers(payload: any): payload is NotifyBetUsers {
	return 'winners' in payload && 'losers' in payload
}
