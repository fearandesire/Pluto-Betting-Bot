/**
 * Original Pluto achievement illustrations on a 120 × 120 canvas. No remote
 * images, fonts, filters or generated assets. Presentation aliases only:
 * Khronos owns keys, eligibility and award history.
 */
interface AchievementArt {
	name: string
	caption: string
	markup: string
}

const paper = '#f3eddd'
const ink = '#173e35'
const orange = '#cf744e'
const gold = '#d7b879'

const catalogue = new Map<string, AchievementArt>([
	[
		'first_win',
		{
			name: 'Opening Score',
			caption: 'First head-to-head win',
			markup: `<path d="M22 17h76v86H22z" fill="${paper}"/><path d="M22 17h76v23H22z" fill="${orange}"/><path d="M33 28h54M33 88h54" stroke="${ink}" stroke-width="2"/><path d="M35 55l15-6v27h-8v5h30v-5h-9V45H53l-18 7z" fill="${ink}"/><path d="M16 25v17m88 36v17" stroke="${gold}" stroke-width="3"/><path d="M22 94h76" stroke="${ink}" stroke-width="2" stroke-dasharray="3 4"/>`,
		},
	],
	[
		'ten_wins',
		{
			name: 'Double Figures',
			caption: '10 head-to-head wins',
			markup: `<rect x="10" y="27" width="100" height="68" rx="3" fill="${ink}" stroke="${gold}" stroke-width="2"/><path d="M16 37h88M16 84h88M60 43v35" stroke="${gold}"/><path d="M30 49l9-5v30h-6V53l-3 2zM76 46h16v29H76z" fill="${paper}"/><path d="M81 52h6v17h-6z" fill="${ink}"/><path d="M22 20v7m76-7v7M32 95v8m56-8v8" stroke="${orange}" stroke-width="3"/><circle cx="20" cy="60" r="2" fill="${orange}"/><circle cx="100" cy="60" r="2" fill="${orange}"/>`,
		},
	],
	[
		'fifty_wins',
		{
			name: 'Club Fifty',
			caption: '50 head-to-head wins',
			markup: `<path d="M28 15v94" stroke="${gold}" stroke-width="4"/><path d="M32 18h74L82 49l24 30H32z" fill="${orange}"/><path d="M38 25h53L72 49l19 23H38z" fill="${ink}"/><path d="M48 39h12v5h-8v4h8v13H47v-5h8v-4h-7zM64 39h13v22H64z" fill="${paper}"/><path d="M68 44h5v12h-5z" fill="${ink}"/><path d="M20 109h17M16 100h26" stroke="${gold}" stroke-width="2"/>`,
		},
	],
	[
		'in_the_black',
		{
			name: 'In the Black',
			caption: 'Net positive · 10+ settled H2H bets',
			markup: `<path d="M26 15h67v91H26z" fill="${paper}"/><path d="M26 15h11v91H26z" fill="${orange}"/><path d="M43 31h41M43 87h41M43 97h41" stroke="${ink}" stroke-width="2"/><path d="M48 43v34M60 43v34M72 43v34M84 43v34M43 51h41M43 63h41M43 75h41" stroke="${ink}" stroke-opacity=".25"/><path d="M47 66l10-11 10 6 14-19M73 42h9v10" stroke="${ink}" stroke-width="3" fill="none"/><path d="M18 29h13M18 47h13M18 65h13M18 83h13" stroke="${gold}" stroke-width="3"/>`,
		},
	],
	[
		'sharp_eye',
		{
			name: 'The Line Reader',
			caption: '60%+ hit rate · 20+ predictions',
			markup: `<path d="M14 27h92v66H14z" fill="${ink}" stroke="${gold}" stroke-width="2"/><path d="M24 61c16-25 48-25 72 0-24 25-56 25-72 0z" stroke="${paper}" stroke-width="2" fill="none"/><circle cx="60" cy="61" r="12" fill="${orange}"/><circle cx="60" cy="61" r="5" fill="${ink}"/><path d="M60 20v14M60 87v14M7 61h14M99 61h14" stroke="${gold}" stroke-width="2"/><path d="M29 84l57-44" stroke="${gold}" stroke-width="2" stroke-dasharray="3 5"/>`,
		},
	],
	[
		'prop_hunter',
		{
			name: 'Player’s Edge',
			caption: '10 correct player props',
			markup: `<rect x="26" y="19" width="68" height="89" rx="3" fill="${paper}"/><path d="M45 14h30v13H45z" fill="${gold}"/><path d="M48 38l-13 7 8 17 7-4v23h26V58l7 4 8-17-15-7-13 6z" fill="${ink}"/><path d="M58 54h11v16H58z" stroke="${paper}" stroke-width="2" fill="none"/><path d="M37 93h25m8 0h12" stroke="${ink}" stroke-width="2"/><circle cx="91" cy="89" r="15" fill="${orange}"/><path d="M83 89l5 5 10-11" stroke="${paper}" stroke-width="3" fill="none"/>`,
		},
	],
	[
		'parlay_pro',
		{
			name: 'All Legs Home',
			caption: 'First winning parlay',
			markup: `<path d="M15 23h46v37H15zM40 47h46v37H40zM65 71h46v37H65z" fill="${paper}" stroke="${ink}" stroke-width="2"/><path d="M15 33h46M40 57h46M65 81h46" stroke="${orange}" stroke-width="3"/><path d="M24 45l7 6 13-12M49 69l7 6 13-12M74 93l7 6 13-12" stroke="${ink}" stroke-width="3" fill="none"/><path d="M7 29v19m50-32h17v16m20 15h17v16" stroke="${gold}" stroke-width="2" fill="none"/>`,
		},
	],
	[
		'courtside',
		{
			name: 'Courtside',
			caption: '10 correct NBA predictions',
			markup: `<path d="M12 25h96v81H12z" fill="${orange}"/><path d="M19 32h82v67H19zM44 32v25h32V32" stroke="${paper}" stroke-width="2" fill="none"/><path d="M44 57a16 16 0 0 0 32 0M19 39a41 41 0 0 0 82 0M19 84h82" stroke="${paper}" stroke-width="2" fill="none"/><path d="M50 42h20M60 42v8" stroke="${ink}" stroke-width="3"/><circle cx="86" cy="23" r="16" fill="${gold}" stroke="${ink}" stroke-width="2"/><path d="M70 23h32M86 7v32M75 12c11 5 11 17 0 22M97 12c-11 5-11 17 0 22" stroke="${ink}" stroke-width="1.5" fill="none"/>`,
		},
	],
])

/** An unrecognised award stays an unrecognised award, never a known badge. */
const fallbackArt = `<path d="M23 24h74v72H23z" fill="${paper}"/><path d="M23 24h74v14H23z" fill="${gold}"/><path d="M36 52h48M36 63h48M36 74h29" stroke="${ink}" stroke-width="3"/><path d="M17 31v58M103 31v58" stroke="${orange}" stroke-width="2"/>`

export const ACHIEVEMENT_ART_KEYS = [...catalogue.keys()]

export function achievementPresentation(badge: {
	key?: string
	name: string
	description?: string
}): AchievementArt {
	return (
		catalogue.get(badge.key ?? '') ?? {
			name: badge.name,
			caption: badge.description || 'Earned achievement',
			markup: fallbackArt,
		}
	)
}
