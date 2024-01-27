import test from 'ava'
import IsoManager from '../utils/time/IsoManager.js'

// Mock date for consistent testing
const mockDate = '2023-12-24T00:10:00Z'

// Helper function to create an instance of IsoManager
function createIsoManager(time) {
	return new IsoManager(time)
}

// Test for NFL Week
test('IsoManager - withinNFLWeek', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.nflWeek,
		true,
		'Expected to be within NFL week for the given date',
	)
})

// Test for checking if the date is within this week
test('IsoManager - withinThisWeek', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.sevenDayWeek,
		true,
		'Expected to be within this week for the given date',
	)
})

// Test for MDY format
test('IsoManager - format MM/dd/yyyy', (t) => {
	const isoManager = createIsoManager(mockDate)
	t.is(
		isoManager.mdy,
		'12/23/2023',
		'Expected date to be formatted as MM/dd/yyyy',
	)
})

// Test for legible date format
test('IsoManager - format EEE, h:mm a', (t) => {
	const isoManager = createIsoManager(mockDate)
	t.is(
		isoManager.legible,
		'Sat, 12:00 PM',
		'Expected date to be formatted as EEE, h:mm a',
	)
})

// Test for time only format
test('IsoManager - format h:mm a', (t) => {
	const isoManager = createIsoManager(mockDate)
	t.is(
		isoManager.timeOnly,
		'12:00 PM',
		'Expected time to be formatted as h:mm a',
	)
})

// Test for checking if the date is in the past
test('IsoManager - isInPast', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.isInPast,
		false,
		'Expected the date to not be in the past',
	)
})

// Test for checking if the date is today
test('IsoManager - isToday', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.today,
		true,
		'Expected the date to be today',
	)
})

// Test for day name
test('IsoManager - dayName', (t) => {
	const isoManager = createIsoManager(mockDate)
	t.is(
		isoManager.dayName,
		'Saturday',
		'Expected day name to be Saturday',
	)
})

// Test for cron job format
test('IsoManager - toCron', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected cron format based on your implementation
	t.is(
		isoManager.cron,
		'10 19 23 12 6',
		'Expected cron format to match',
	)
})

// Test for cron job of the current time
test('IsoManager - cronRightNow', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected cron format based on your implementation
	t.is(
		isoManager.cronRightNow,
		'1 12 23 12 *',
		'Expected cron format for right now to match',
	)
})

// Test for checking if the time is before 1 PM
test('IsoManager - before1PM', (t) => {
	const isoManager = createIsoManager(mockDate)
	t.is(
		isoManager.before1PM,
		true,
		'Expected the time to be before 1 PM',
	)
})

// Test for checking if the date is before current time
test('IsoManager - isBefore', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.isBefore,
		false,
		'Expected the date to not be before the current time',
	)
})

// Test for checking if the date is after current time
test('IsoManager - isAfter', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.isAfter,
		true,
		'Expected the date to be after the current time',
	)
})

// Test for checking if the date is in the same week
test('IsoManager - isSameWeek', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.isSameWeek,
		true,
		'Expected the date to be in the same week',
	)
})

// Test for checking if the date is on the same day
test('IsoManager - isSameDay', (t) => {
	const isoManager = createIsoManager(mockDate)
	// Replace with the expected behavior based on your implementation
	t.is(
		isoManager.isSameDay,
		true,
		'Expected the date to be on the same day',
	)
})
