import axios from 'axios'

export default class ReqManager {
	constructor() {
		this.apiURL = process.env.KH_API_URL
	}

	async oddsFor(id) {
		const oddsQuery = await axios.get(
			`${this.apiURL}/odds/${id}`,
		)

		const {
			home_team,
			away_team,
			home_team_odds,
			away_team_odds,
			favored,
		} = oddsQuery.data

		return {
			home_team,
			away_team,
			home_team_odds,
			away_team_odds,
			favored,
		}
	}
}
