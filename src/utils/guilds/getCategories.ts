import axios from 'axios'
import { pluto_api_url } from '@pluto-server-config'

export async function getCategories() {
	try {
		const response = await axios.get(
			`${pluto_api_url}/discord/configs/games/all`,
			{
				headers: {
					'admin-token': `${process.env.PLUTO_API_TOKEN}`,
				},
			},
		)
		return response.data
	} catch (err) {
		console.error(err)
		return false
	}
}
