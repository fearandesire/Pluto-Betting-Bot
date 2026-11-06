/**
 * Line icons for the cosmetic achievements, drawn on a 24x24 grid. Each value
 * is the inner SVG markup only; the card wraps it in a group that sets the
 * stroke and scales it, so the glyphs inherit one colour and one line weight.
 * Keys match Khronos's achievement catalogue (achievement-catalogue.ts).
 */
export const BADGE_ICON_SIZE = 24

const star =
	'<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>'

const BADGE_ICONS: Record<string, string> = {
	// One win: a single star.
	first_win: star,
	// Ten wins: a trophy.
	ten_wins: [
		'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/>',
		'<path d="M8 6H5.5a1 1 0 0 0-1 1c0 2.2 1.6 3.6 3.6 3.8"/>',
		'<path d="M16 6h2.5a1 1 0 0 1 1 1c0 2.2-1.6 3.6-3.6 3.8"/>',
		'<path d="M12 13v4"/>',
		'<path d="M9.5 20v-1.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20z"/>',
	].join(''),
	// Fifty wins: a crown.
	fifty_wins: [
		'<path d="M3.5 8.5l4.3 3.8L12 5.5l4.2 6.8 4.3-3.8-1.6 9.5H5.1z"/>',
		'<path d="M5.5 21h13"/>',
	].join(''),
	// Positive net profit: a rising line.
	in_the_black: [
		'<path d="M3.5 17l5-5 3.5 3.5 7.5-8"/>',
		'<path d="M15 7.5h4.5V12"/>',
		'<path d="M3.5 20.5h17"/>',
	].join(''),
	// Hit rate: an eye.
	sharp_eye: [
		'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>',
		'<circle cx="12" cy="12" r="3"/>',
		'<circle cx="12" cy="12" r="1" fill="currentColor"/>',
	].join(''),
	// Player props: a target.
	prop_hunter: [
		'<circle cx="12" cy="12" r="8"/>',
		'<circle cx="12" cy="12" r="4"/>',
		'<circle cx="12" cy="12" r="1" fill="currentColor"/>',
		'<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
	].join(''),
	// Parlay: stacked legs.
	parlay_pro: [
		'<path d="M12 3.5l9 4.5-9 4.5-9-4.5z"/>',
		'<path d="M3 12l9 4.5 9-4.5"/>',
		'<path d="M3 16l9 4.5 9-4.5"/>',
	].join(''),
	// NBA predictions: a basketball.
	courtside: [
		'<circle cx="12" cy="12" r="9"/>',
		'<path d="M3 12h18M12 3v18"/>',
		'<path d="M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/>',
	].join(''),
}

/** Inner markup for a badge key; unknown or missing keys get the star. */
export function badgeIconMarkup(key: string | undefined): string {
	return key && Object.prototype.hasOwnProperty.call(BADGE_ICONS, key)
		? BADGE_ICONS[key]
		: star
}

export const BADGE_ICON_KEYS = Object.keys(BADGE_ICONS)
