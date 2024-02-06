// Base interface for API responses
export interface IApiResponse {
	statusCode: number
	message?: string
}

export interface IApiHttpError extends IApiResponse {
	path: string
	timestamp: string
	error: {
		errorName: ApiHttpErrorTypes // Use the enum type here
		[key: string]: any // Custom properties Khronos sends back, (E.g, `balance`)
	}
}

export enum ApiHttpErrorTypes {
	TeamNotFound = 'TeamNotFound',
	GameHasStarted = 'GameHasStarted',
	NoGamesForTeam = 'NoGamesForTeam',
	DuplicateBetslip = 'DuplicateBetslip',
	InsufficientBalance = 'InsufficientBalance',
}
