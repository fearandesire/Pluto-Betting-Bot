export class Endpoints {
	static readonly paths = {
		bets: {},
		notifiy: {
			betResults: '/notifications/bets/results',
		},
		channels: {
			incoming: '/channels/incoming',
			remove: '/channels/remove',
		},
		schedule: {
			daily: `/schedule/daily/all`,
		},
	}
}

export class OutgoingEndpoints {
	static readonly paths = {
		bets: {
			create: 'betslips/create', // Initalize
			pending: `betslips/pending`,
			place: `betslips/place`, // Finalizes & stores - If there's only one matchup, this can be used.
		},
		game_schedule: 'discord/config/type',
		categories: {
			by_sport: 'discord/configs/categories',
			all: 'discord/configs/categories/sports/all',
		},
		odds: {
			by_sport: 'odds/sport',
			by_game: 'odds/games',
		},
		matches: {
			getAll: 'matches/all',
		},
	}
}
