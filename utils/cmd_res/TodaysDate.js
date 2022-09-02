/**
 * @module TodaysDate -
 * A function that returns a string in the format of mm/dd/yyyy
 * @returns {string} - Today's date in the format of mm/dd/yyyy
 */

export function TodaysDate() {
	var today = new Date()
	var dd = String(today.getDate()).padStart(2, '0')
	var mm = String(today.getMonth() + 1).padStart(2, '0') //January is 0!
	var yyyy = today.getFullYear()
	return (today = mm + '/' + dd + '/' + yyyy)
}
