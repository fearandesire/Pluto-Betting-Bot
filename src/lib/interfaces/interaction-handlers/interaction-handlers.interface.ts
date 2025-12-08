import _ from 'lodash'

export const btnIds = {
	matchup_btn_confirm: 'matchup_btn_confirm',
	matchup_btn_cancel: 'matchup_btn_cancel',
} as const

export const mybetsNavPrefix = 'mybets_nav' as const
export const mybetsNavPageId = `${mybetsNavPrefix}_page` as const

export const mybetsNavIds = {
	first: `${mybetsNavPrefix}_first`,
	prev: `${mybetsNavPrefix}_prev`,
	next: `${mybetsNavPrefix}_next`,
	last: `${mybetsNavPrefix}_last`,
} as const

export const mybetsNavActions = ['first', 'prev', 'next', 'last'] as const
export type MyBetsNavAction = (typeof mybetsNavActions)[number]

const mybetsNavRegex = new RegExp(
	`^${mybetsNavPrefix}_(first|prev|next|last)_(\\d+)$`,
)

export const buildMyBetsNavCustomId = (
	action: MyBetsNavAction,
	currentPage: number,
): string => `${mybetsNavPrefix}_${action}_${currentPage}`

export const parseMyBetsNavCustomId = (
	customId: string,
):
	| {
			action: MyBetsNavAction
			currentPage: number
	  }
	| null => {
	const match = mybetsNavRegex.exec(customId)
	if (!match) return null

	const currentPage = Number.parseInt(match[2], 10)
	if (Number.isNaN(currentPage)) return null

	return {
		action: match[1] as MyBetsNavAction,
		currentPage,
	}
}

export enum selectMenuIds {
	matchup_select_team = 'matchup_select_team',
}
// Helper function to check if a string starts with any of the given prefixes
export const startsWithAny = (str: string, prefixes: string[]): boolean =>
	_.some(prefixes, (prefix) => _.startsWith(str, prefix))
