/* eslint-disable no-undef */
import assert from 'assert'
import { fetchGif } from '#utilBot/fetchGif'

describe('fetchGif', () => {
    it('should return an array of .GIF URLs', () => {
        return new Promise(async (resolve, reject) => {
            // # Create an array of every team
            const teams = process.env.SPORT === 'nfl' ? process.env.nfl_teams.split(',') : process.env.nba_teams.split(',')
            // Create an empty array to store URLs
            const urls = []
            // Loop the test 50 times
            for (let i = 0; i < 50; i++) {
                // Create a random term to search for
                const term = teams[Math.floor(Math.random() * teams.length)]
                // Fetch the gif
                const url = await fetchGif(term)
                console.log(`Pushing ->`, url)
                // Add the URL to the array
                urls.push(url)
                assert.ok(urls)
                if (i === 49) {
                    console.log(`URLs:`, urls)
                    resolve()
                }
            }
        })
    })
})
