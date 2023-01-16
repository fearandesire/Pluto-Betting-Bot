/* eslint-disable no-undef */
import dotenv from 'dotenv'
dotenv.config()
import assert from 'assert'
import { fetchGif } from '#utilBot/fetchGif'

describe('fetchGif', () => {
    it('should return an array of .GIF URLs', () => {
        return new Promise(async (resolve, reject) => {
            // # Create an array of every NBA team
            const teams = [
                'Atlanta Hawks',
                `Boston Celtics`,
                `Brooklyn Nets`,
                `Charlotte Hornets`,
                `Chicago Bulls`,
                `Cleveland Cavaliers`,
                `Dallas Mavericks`,
                `Denver Nuggets`,
                `Detroit Pistons`,
                `Golden State Warriors`,
                `Houston Rockets`,
                `Indiana Pacers`,
                `Los Angeles Clippers`,
                `Los Angeles Lakers`,
                `Memphis Grizzlies`,
                `Miami Heat`,
                `Milwaukee Bucks`,
                `Minnesota Timberwolves`,
                `New Orleans Pelicans`,
                `New York Knicks`,
                `Oklahoma City Thunder`,
                `Orlando Magic`,
                `Philadelphia 76ers`,
                `Phoenix Suns`,
                `Portland Trail Blazers`,
                `Sacramento Kings`,
                `San Antonio Spurs`,
                `Toronto Raptors`,
                `Utah Jazz`,
                `Washington Wizards`,
            ]
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
