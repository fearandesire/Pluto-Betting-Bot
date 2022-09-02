/**
 * @module AddPlusToPositive -
 *⁡⁣⁣⁢ Adds the '+' character to the input. Intended to be used with the 'gatherOdds' // 'odds' files⁡.
 * Odds returned from 'the-odds-api' will return pure integers without the '+' character. A
 * lack of a + character would make it unclear which team is favored.
 * @param {integer} num - The number to be manipulated.
 * @returns {string} -  A string with tnumber with the '+' character added.
 * @references {@link gatherOdds.js} & {@link odds.js}
 */

export function AddPlusToPositive(num) {
	if (num > 0) {
		return `+${num}`
	} else {
		return num
	}
}
