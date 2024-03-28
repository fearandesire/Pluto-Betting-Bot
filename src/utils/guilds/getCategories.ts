import axios from 'axios'

export async function getCategories() {
	try {
		const response = await axios.get(
			`${process.env.KH_API_URL}/discord/configs/games/all`,
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
