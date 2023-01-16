/**
 * @module fecthGif
 * Use Giphy API to fetch a random gif
 * Currently being used in game channel creation/game intro embeds.
 * @param {string} term - The term to search for
 * @returns {string} - The direct image link of the gif
 */

export async function fetchGif(term) {
    const randomTerms = [
        `${term} basketball`,
        `${term} basketball hype`,
        `${term} score`,
        `${term} playoffs`,
        `${term} highlights`,
        `${term} celebrate`,
        `${term} warmup`,
    ]
    const selectRandomTerm =
        randomTerms[Math.floor(Math.random() * randomTerms.length)]
    const giphyKey = process.env.GIPHYAPIKEY
    console.log(`SELECTED RANDOM TERM: ${selectRandomTerm}`)
    // # Query Giphy API with team name + alt. term
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${selectRandomTerm}&limit=6&offset=0&rating=pg-13&lang=en`
    const giphy = await fetch(url).then((res) => res.json())
    // # Select 1 random gif from the 5 returned
    const gif = giphy.data[Math.floor(Math.random() * giphy.data.length)]
    // # Return the gif's direct image link
    return gif.images.original.url
}
