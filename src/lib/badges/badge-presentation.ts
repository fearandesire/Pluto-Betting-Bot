export type BadgeKind = 'career' | 'form'

export interface BadgePresentation {
	label: string
	criteria: string
	kind: BadgeKind
	emojiName: string
	progressLabel: string
}

/**
 * Covers servers that predate `kind`; a server that sends it supplies its own
 * text. One entry per badge in the emoji manifest. The four data-contract
 * badges (underdog, home_turf, photo_finish, cashout_regret) show "progress
 * not tracked yet" while Khronos reports their gate as untracked.
 */
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
			'Keep a hit rate of 60% or better across at least 15 settled predictions.',
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
			'Have 5 bets, predictions or parlays settle. Any result counts, even a push.',
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
	match_point: {
		label: 'Match Point',
		criteria: 'Win 25 head-to-head bets.',
		kind: 'career',
		emojiName: 'p_match_point',
		progressLabel: 'Head-to-head wins',
	},
	armchair_expert: {
		label: 'Armchair Expert',
		criteria: 'Have 25 predictions settle.',
		kind: 'career',
		emojiName: 'p_armchair_expert',
		progressLabel: 'Settled predictions',
	},
	extra_innings: {
		label: 'Extra Innings',
		criteria: 'Have 150 bets, predictions or parlays settle.',
		kind: 'career',
		emojiName: 'p_extra_innings',
		progressLabel: 'Settled picks',
	},
	on_the_money: {
		label: 'On the Money',
		criteria: 'Get 15 predictions right.',
		kind: 'career',
		emojiName: 'p_on_the_money',
		progressLabel: 'Correct predictions',
	},
	bench_buddy: {
		label: 'Bench Buddy',
		criteria: 'Have a head-to-head bet settle as a push.',
		kind: 'career',
		emojiName: 'p_bench_buddy',
		progressLabel: 'Head-to-head pushes',
	},
	refs_fault: {
		label: 'Ref’s Fault',
		criteria: 'Lose 10 head-to-head bets.',
		kind: 'career',
		emojiName: 'p_refs_fault',
		progressLabel: 'Head-to-head losses',
	},
	statistically_fine: {
		label: 'Statistically Fine',
		criteria:
			'Lose more head-to-head bets than you win across at least 20 settled head-to-head bets.',
		kind: 'form',
		emojiName: 'p_statistically_fine',
		progressLabel: 'Settled head-to-head bets',
	},
	ice_in_the_veins: {
		label: 'Ice in the Veins',
		criteria: 'Win a head-to-head bet with a stake of 1,000 or more.',
		kind: 'career',
		emojiName: 'p_ice_in_the_veins',
		progressLabel: 'Largest winning head-to-head stake',
	},
	hat_trick: {
		label: 'Hat Trick',
		criteria: 'Get 3 predictions right in a row.',
		kind: 'career',
		emojiName: 'p_hat_trick',
		progressLabel: 'Best run of correct predictions',
	},
	next_year_fc: {
		label: 'Next Year FC',
		criteria: 'Have predictions settle in 2 different seasons.',
		kind: 'career',
		emojiName: 'p_next_year_fc',
		progressLabel: 'Seasons with settled predictions',
	},
	clean_sweep: {
		label: 'Clean Sweep',
		criteria: 'Win a parlay with 4 or more legs.',
		kind: 'career',
		emojiName: 'p_clean_sweep',
		progressLabel: 'Won parlays with 4 or more legs',
	},
	long_shot: {
		label: 'Long Shot',
		criteria: 'Win a parlay priced at +600 or longer.',
		kind: 'career',
		emojiName: 'p_long_shot',
		progressLabel: 'Won parlays at +600 or longer',
	},
	buzzer_beater: {
		label: 'Buzzer Beater',
		criteria:
			'Win a parlay placed in the last 30 minutes before its first game starts.',
		kind: 'career',
		emojiName: 'p_buzzer_beater',
		progressLabel: 'Won parlays placed just before the first game',
	},
	one_leg_short: {
		label: 'One Leg Short',
		criteria: 'Lose a parlay on exactly one leg after every other leg won.',
		kind: 'career',
		emojiName: 'p_one_leg_short',
		progressLabel: 'Parlays lost on one leg',
	},
	reverse_jinx: {
		label: 'Reverse Jinx',
		criteria:
			'Win a head-to-head bet on a team whose last bet from you lost.',
		kind: 'career',
		emojiName: 'p_reverse_jinx',
		progressLabel: 'Wins on a team that lost your last bet on it',
	},
	emotional_hedge: {
		label: 'Emotional Hedge',
		criteria:
			'Bet on one team and predict the other on the same game, so one of them wins.',
		kind: 'career',
		emojiName: 'p_emotional_hedge',
		progressLabel: 'Games where your bet and prediction split',
	},
	underdog: {
		label: 'Underdog',
		criteria: 'Win 10 head-to-head bets placed at plus odds.',
		kind: 'career',
		emojiName: 'p_underdog',
		progressLabel: 'Head-to-head wins at plus odds',
	},
	home_turf: {
		label: 'Home Turf',
		criteria: 'Win 10 head-to-head bets on the home team.',
		kind: 'career',
		emojiName: 'p_home_turf',
		progressLabel: 'Head-to-head wins on the home team',
	},
	photo_finish: {
		label: 'Photo Finish',
		criteria:
			'Win a head-to-head bet on a game decided by 3 points or fewer.',
		kind: 'career',
		emojiName: 'p_photo_finish',
		progressLabel: 'Head-to-head wins in close games',
	},
	cashout_regret: {
		label: 'Cashout Regret',
		criteria: 'Cancel a head-to-head bet whose team went on to win.',
		kind: 'career',
		emojiName: 'p_cashout_regret',
		progressLabel: 'Cancelled bets whose team won',
	},
}

export const BADGE_EMOJI_NAMES: ReadonlySet<string> = new Set(
	Object.values(BADGE_PRESENTATION).map((badge) => badge.emojiName),
)
