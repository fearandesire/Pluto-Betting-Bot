import { z } from 'zod';

export const SportKeysSchema = z.enum([
	'basketball_nba',
	'americanfootball_nfl',
]);

export const SupportedSportsSchema = z.enum(['nfl', 'nba']);

export const SportKeysEnumSchema = z.object({
	nfl: z.literal('americanfootball_nfl'),
	nba: z.literal('basketball_nba'),
});

export const MainBettingMarketSchema = z.enum(['h2h', 'totals']);

export const NFLPlayerPropMarketSchema = z.enum([
	'player_pass_tds',
	'player_pass_yds',
	'player_pass_completions',
	'player_pass_attempts',
	'player_pass_interceptions',
	'player_pass_longest_completion',
	'player_rush_yds',
	'player_rush_attempts',
	'player_rush_longest',
	'player_receptions',
	'player_reception_yds',
	'player_reception_longest',
	'player_kicking_points',
	'player_field_goals',
	'player_tackles_assists',
	'player_1st_td',
	'player_last_td',
	'player_anytime_td',
]);

export const NFLAlternatePlayerPropMarketSchema = z.enum([
	'player_pass_tds_alternate',
	'player_pass_yds_alternate',
	'player_rush_yds_alternate',
	'player_rush_reception_yds_alternate',
	'player_reception_yds_alternate',
	'player_receptions_alternate',
]);

export const BasketballPlayerPropMarketSchema = z.enum([
	'player_points',
	'player_rebounds',
	'player_assists',
	'player_threes',
	'player_blocks',
	'player_steals',
	'player_blocks_steals',
	'player_turnovers',
	'player_points_rebounds_assists',
	'player_points_rebounds',
	'player_points_assists',
	'player_rebounds_assists',
	'player_first_basket',
	'player_double_double',
	'player_triple_double',
]);

export const NBAAlternatePlayerPropMarketSchema = z.enum([
	'player_points_alternate',
	'player_rebounds_alternate',
	'player_assists_alternate',
	'player_blocks_alternate',
	'player_steals_alternate',
	'player_threes_alternate',
	'player_points_assists_alternate',
	'player_points_rebounds_alternate',
	'player_rebounds_assists_alternate',
	'player_points_rebounds_assists_alternate',
]);

export const BettingMarketSchema = z.enum([
	'h2h',
	'totals',
	'player_pass_tds',
	'player_pass_yds',
	'player_pass_completions',
	'player_pass_attempts',
	'player_pass_interceptions',
	'player_pass_longest_completion',
	'player_rush_yds',
	'player_rush_attempts',
	'player_rush_longest',
	'player_receptions',
	'player_reception_yds',
	'player_reception_longest',
	'player_kicking_points',
	'player_field_goals',
	'player_tackles_assists',
	'player_1st_td',
	'player_last_td',
	'player_anytime_td',
	'player_pass_tds_alternate',
	'player_pass_yds_alternate',
	'player_rush_yds_alternate',
	'player_rush_reception_yds_alternate',
	'player_reception_yds_alternate',
	'player_receptions_alternate',
	'player_points',
	'player_rebounds',
	'player_assists',
	'player_threes',
	'player_blocks',
	'player_steals',
	'player_blocks_steals',
	'player_turnovers',
	'player_points_rebounds_assists',
	'player_points_rebounds',
	'player_points_assists',
	'player_rebounds_assists',
	'player_first_basket',
	'player_double_double',
	'player_triple_double',
	'player_points_alternate',
	'player_rebounds_alternate',
	'player_assists_alternate',
	'player_blocks_alternate',
	'player_steals_alternate',
	'player_threes_alternate',
	'player_points_assists_alternate',
	'player_points_rebounds_alternate',
	'player_rebounds_assists_alternate',
	'player_points_rebounds_assists_alternate',
]);

export const OutcomeSchema = z.object({
	name: z.string(),
	price: z.number(),
	point: z.number().optional(),
});

export const MarketDataSchema = z.object({
	key: BettingMarketSchema,
	outcomes: z.array(OutcomeSchema),
});
