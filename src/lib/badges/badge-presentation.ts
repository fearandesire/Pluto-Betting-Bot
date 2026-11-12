export type BadgeKind = 'career' | 'form'

export interface BadgePresentation {
	label: string
	criteria: string
	kind: BadgeKind
	emojiName: string
	progressLabel: string
}

/** Covers servers that predate `kind`; a server that sends it supplies its own text. */
export const BADGE_PRESENTATION: Readonly<Record<string, BadgePresentation>> = {
	first_win: {
		label: 'Opening Score',
		criteria: 'Win a head-to-head bet.',
		kind: 'career',
		emojiName: 'p_opening_score',
		progressLabel: 'Head-to-head wins',
	},
	ten_wins: {
		label: 'Double Figures',
		criteria: 'Win 10 head-to-head bets.',
		kind: 'career',
		emojiName: 'p_double_figures',
		progressLabel: 'Head-to-head wins',
	},
	fifty_wins: {
		label: 'Club Fifty',
		criteria: 'Win 50 head-to-head bets.',
		kind: 'career',
		emojiName: 'p_club_fifty',
		progressLabel: 'Head-to-head wins',
	},
	in_the_black: {
		label: 'In the Black',
		criteria:
			'Hold a positive net profit across at least 10 settled head-to-head bets.',
		kind: 'form',
		emojiName: 'p_in_the_black',
		progressLabel: 'Settled head-to-head bets',
	},
	sharp_eye: {
		label: 'The Line Reader',
		criteria:
			'Keep a hit rate of 60% or better across at least 20 settled predictions.',
		kind: 'form',
		emojiName: 'p_line_reader',
		progressLabel: 'Settled predictions',
	},
	prop_hunter: {
		label: 'Player’s Edge',
		criteria: 'Get 10 player prop predictions right.',
		kind: 'career',
		emojiName: 'p_players_edge',
		progressLabel: 'Correct player prop predictions',
	},
	parlay_pro: {
		label: 'All Legs Home',
		criteria: 'Win a parlay.',
		kind: 'career',
		emojiName: 'p_all_legs_home',
		progressLabel: 'Won parlays',
	},
	courtside: {
		label: 'Courtside',
		criteria: 'Get 10 NBA predictions right.',
		kind: 'career',
		emojiName: 'p_courtside',
		progressLabel: 'Correct NBA predictions',
	},
	due_a_win: {
		label: 'Due a Win',
		criteria:
			'Have 5 bets, predictions or parlays settle. Wins and losses both count.',
		kind: 'career',
		emojiName: 'p_due_a_win',
		progressLabel: 'Settled picks',
	},
	trust_the_process: {
		label: 'Trust the Process',
		criteria:
			'Have 50 bets, predictions or parlays settle across at least 20 different games.',
		kind: 'career',
		emojiName: 'p_trust_the_process',
		progressLabel: 'Settled picks',
	},
}

export const BADGE_EMOJI_NAMES: ReadonlySet<string> = new Set(
	Object.values(BADGE_PRESENTATION).map((badge) => badge.emojiName),
)
