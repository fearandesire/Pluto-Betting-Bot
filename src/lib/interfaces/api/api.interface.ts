// Base interface for API responses
export interface IApiResponse {
	statusCode: number;
	message?: string;
}

export enum ApiHttpErrorTypes {
	TeamNotFound = 'TeamNotFoundException',
	GameHasStarted = 'GameHasStartedException',
	NoGamesForTeam = 'NoGamesForTeamException',
	DuplicateBetslip = 'DuplicateBetslipException',
	InsufficientBalance = 'InsufficientBalanceException',
	InternalError = 'InternalErrorException',
	AccountNotFound = 'AccountNotFoundException',
	UnableToFindBalance = 'UnableToFindBalanceException',
	ClaimCooldown = 'ClaimCooldownException',
	HasPendingBet = 'HasPendingBetException',
	AccountExists = 'AccountExistsException',
	NoActiveBets = 'NoActiveBetsFoundException',
	InvalidTeamForMatch = 'InvalidTeamForMatchException',
	MultipleGamesForTeam = 'MultipleGamesForTeamException',
	MatchNotFound = 'MatchNotFoundException',
}

export enum ApiModules {
	betting = 'betting',
	account = 'account',
	unknown = 'unknown',
	odds = 'odds',
	props = 'props',
	predictions = 'predictions',
}
