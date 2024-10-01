import _ from 'lodash';

export const btnIds = {
	matchup_btn_confirm: 'matchup_btn_confirm',
	matchup_btn_cancel: 'matchup_btn_cancel',
} as const;

export enum selectMenuIds {
	matchup_select_team = 'matchup_select_team',
}
// Helper function to check if a string starts with any of the given prefixes
export const startsWithAny = (str: string, prefixes: string[]): boolean =>
	_.some(prefixes, (prefix) => _.startsWith(str, prefix));
