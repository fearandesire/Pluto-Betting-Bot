import sharp from 'sharp'
import type { AchievementSummary } from '../api/Khronos/achievements/achievements-wrapper.js'
import { achievementPresentation } from './achievement-art.js'

export const PROFILE_CARD_WIDTH = 1000
export const PROFILE_CARD_HEIGHT = 800
export const MAX_PROFILE_BADGES = 5

export interface ProfileBadge {
	key?: string
	name: string
	description?: string
}

export interface ProfileCardData {
	displayName: string
	/** null represents an unavailable XP profile, never level zero. */
	tier: string | null
	level: number | null
	/** null represents unavailable achievements, never an empty record. */
	summary: AchievementSummary | null
	/** Earned awards in the order returned by Khronos, newest first. */
	badges: ProfileBadge[]
	earnedCount?: number
}

// Both families ship in the existing fonts-dejavu-core production package.
const SANS = "'DejaVu Sans', sans-serif"
const SERIF = "'DejaVu Serif', serif"
const MONO = "'DejaVu Sans Mono', monospace"
const C = {
	paper: '#f3eddd',
	ink: '#173e35',
	muted: '#59675e',
	line: '#d2d2c0',
	gold: '#d7b879',
	soft: '#b8c9be',
	loss: '#9b3f2c',
} as const

const escapeXml = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(ch) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&apos;',
			})[ch],
	)

/** Bounded, XML-safe text without invisible direction overrides. */
function clean(value: string): string {
	return Array.from(value.slice(0, 2000))
		.filter((ch) => {
			const cp = ch.codePointAt(0) ?? 0
			return !(
				cp < 0x20 ||
				(cp >= 0x7f && cp <= 0x9f) ||
				(cp >= 0xd800 && cp <= 0xdfff) ||
				(cp >= 0x200b && cp <= 0x200f) ||
				(cp >= 0x2028 && cp <= 0x202e) ||
				(cp >= 0x2060 && cp <= 0x206f) ||
				cp === 0xfffe ||
				cp === 0xffff
			)
		})
		.join('')
		.trim()
}

// Conservative advances, including full-width scripts and wide Latin letters.
const advance = (ch: string) =>
	(ch.codePointAt(0) ?? 0) >= 0x2e80 || /[MW@%]/.test(ch) ? 1.1 : 0.7
const width = (value: string, size: number) =>
	Array.from(value).reduce((total, ch) => total + advance(ch) * size, 0)

function fit(value: string, size: number, max: number): string {
	if (width(value, size) <= max) return value
	let used = width('…', size)
	let result = ''
	for (const ch of value) {
		used += advance(ch) * size
		if (used > max) break
		result += ch
	}
	return `${result}…`
}

function captionLines(value: string): string[] {
	const words = clean(value).split(/\s+/)
	let first = ''
	while (words.length && width(`${first} ${words[0]}`.trim(), 16) <= 308)
		first = `${first} ${words.shift()}`.trim()
	return first ? [first, words.join(' ')] : [value]
}

function text(
	x: number,
	y: number,
	body: string,
	size = 18,
	opts: {
		fill?: string
		font?: string
		bold?: boolean
		spacing?: number
		anchor?: 'end' | 'middle'
		max?: number
	} = {},
) {
	const safe = clean(body)
	return `<text x="${x}" y="${y}" font-size="${size}" fill="${opts.fill ?? C.ink}" font-family="${opts.font ?? SANS}"${opts.bold ? ' font-weight="700"' : ''}${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ''}${opts.anchor ? ` text-anchor="${opts.anchor}"` : ''}>${escapeXml(opts.max ? fit(safe, size, opts.max) : safe)}</text>`
}

const money = (amount: number, signed = false) => {
	if (!Number.isFinite(amount)) return '—'
	const value = Math.abs(amount).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
	return `${amount < 0 ? '−' : signed && amount > 0 ? '+' : ''}$${value}`
}

function stats(summary: AchievementSummary | null) {
	return [
		{
			x: 48,
			max: 226,
			label: 'RECORD',
			value: summary
				? `${summary.wins}–${summary.losses}–${summary.pushes}`
				: '—',
			note: 'Wins / losses / pushes',
		},
		{
			x: 304,
			max: 220,
			label: 'NET PROFIT',
			value: summary ? money(summary.net_profit, true) : '—',
			note: 'Settled head-to-head bets',
		},
		{
			x: 556,
			max: 210,
			label: 'BEST WIN',
			value:
				summary?.best_win_payout == null
					? '—'
					: money(summary.best_win_payout),
			note: 'Highest payout',
		},
		{
			x: 800,
			max: 152,
			label: 'HIT RATE',
			value:
				summary?.prediction_hit_rate == null
					? '—'
					: `${Math.round(summary.prediction_hit_rate * 100)}%`,
			note: 'Predictions',
		},
	]
}

function honours(data: ProfileCardData): string {
	const badges = data.badges.slice(0, MAX_PROFILE_BADGES)
	if (badges.length === 0) {
		const unavailable = data.summary === null
		return [
			`<path d="M48 460h904M48 718h904" stroke="${C.line}"/>`,
			`<g transform="translate(73 495) scale(1.25)">${achievementPresentation({ name: '' }).markup}</g>`,
			text(
				280,
				542,
				unavailable
					? 'The honours are unavailable.'
					: 'A fresh scorecard.',
				34,
				{ font: SERIF },
			),
			text(
				280,
				582,
				unavailable
					? 'Achievement data could not be loaded.'
					: 'Your earned achievements will appear here.',
				20,
				{ fill: C.muted },
			),
			text(
				280,
				620,
				unavailable
					? 'Try /profile again in a moment.'
					: 'Every honour records a settled result.',
				18,
				{ fill: C.muted },
			),
		].join('')
	}
	return badges
		.map((badge, index) => {
			const art = achievementPresentation(badge)
			if (index === 0)
				return [
					`<rect x="48" y="450" width="356" height="284" rx="2" fill="${C.ink}"/>`,
					`<g transform="translate(66 468) scale(1.35)">${art.markup}</g>`,
					text(378, 485, 'LATEST', 13, {
						fill: C.gold,
						spacing: 2,
						anchor: 'end',
					}),
					`<path d="M72 638h308" stroke="${C.soft}" stroke-opacity=".4"/>`,
					text(72, 674, art.name, 28, {
						font: SERIF,
						fill: C.paper,
						max: 308,
					}),
					...captionLines(art.caption).map((line, i) =>
						text(72, 704 + i * 20, line, 16, {
							fill: C.soft,
							max: 308,
						}),
					),
				].join('')
			const y = 450 + (index - 1) * 72
			return [
				`<g transform="translate(438 ${y - 1}) scale(.54)">${art.markup}</g>`,
				text(521, y + 27, art.name, 24, { font: SERIF, max: 431 }),
				text(521, y + 52, art.caption, 16, { fill: C.muted, max: 431 }),
				`<path d="M521 ${y + 67}h431" stroke="${C.line}"/>`,
			].join('')
		})
		.join('')
}

/** Native SVG → PNG renderer. No browser, network, avatar lookup or asset I/O. */
export function buildProfileCardSvg(data: ProfileCardData): string {
	const name = clean(data.displayName) || 'Unknown'
	const tier =
		data.tier === null
			? 'XP profile unavailable'
			: `${clean(data.tier).toUpperCase()}${data.level === null ? '' : ` / LEVEL ${data.level}`}`
	const earned = data.earnedCount ?? data.badges.length
	const shown = Math.min(data.badges.length, MAX_PROFILE_BADGES)
	const count =
		data.summary === null
			? 'DATA UNAVAILABLE'
			: `${earned} EARNED${earned > shown ? ` / LATEST ${shown}` : ''}`
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${PROFILE_CARD_WIDTH}" height="${PROFILE_CARD_HEIGHT}" viewBox="0 0 1000 800" role="img" aria-labelledby="card-title card-description">`,
		`<title id="card-title">${escapeXml(`${name} · Pluto profile`)}</title>`,
		`<desc id="card-description">${escapeXml(describeProfileCard(data))}</desc>`,
		`<rect width="1000" height="800" fill="${C.paper}"/><path d="M0 0h1000v234H0z" fill="${C.ink}"/>`,
		// A quiet court diagram, deliberately confined to the header margin.
		`<g stroke="${C.soft}" stroke-opacity=".18" fill="none" stroke-width="2"><path d="M838 82h114v114H838zM874 82v34h42V82"/><path d="M874 116a21 21 0 0 0 42 0M838 92a57 57 0 0 0 114 0"/><path d="M838 170h114M883 95h24"/></g>`,
		`<g transform="translate(48 30)" fill="none" stroke="${C.gold}" stroke-width="2"><circle cx="15" cy="15" r="10"/><ellipse cx="15" cy="15" rx="20" ry="6" transform="rotate(-30 15 15)"/></g>`,
		text(91, 52, 'PLUTO', 20, { fill: C.paper, bold: true, spacing: 4 }),
		text(952, 51, 'PLAYER PROFILE', 14, {
			fill: C.soft,
			spacing: 2,
			anchor: 'end',
		}),
		text(48, 137, name, 52, { fill: C.paper, font: SERIF, max: 750 }),
		`<path d="M48 174h32" stroke="${C.gold}" stroke-width="3"/>`,
		text(96, 181, tier, 17, { fill: C.gold, spacing: 1, max: 680 }),
		...stats(data.summary).map((stat, index) => {
			const size = Math.max(
				20,
				Math.min(
					32,
					Math.floor(
						(32 * stat.max) /
							Math.max(stat.max, width(stat.value, 32)),
					),
				),
			)
			return [
				index > 0
					? `<path d="M${stat.x - 17} 270v83" stroke="${C.line}"/>`
					: '',
				text(stat.x, 278, stat.label, 14, {
					spacing: 1,
					fill: C.muted,
				}),
				text(stat.x, 323, stat.value, size, {
					font: MONO,
					bold: true,
					max: stat.max,
					fill:
						index === 1 && (data.summary?.net_profit ?? 0) < 0
							? C.loss
							: C.ink,
				}),
				text(stat.x, 351, stat.note, 13, { fill: C.muted }),
			].join('')
		}),
		`<path d="M48 388h904" stroke="${C.ink}"/>`,
		text(48, 424, 'THE HONOURS', 16, { bold: true, spacing: 2 }),
		text(952, 424, count, 14, { fill: C.muted, anchor: 'end', spacing: 1 }),
		honours(data),
		text(48, 776, 'PLUTO / THE RECORD SPEAKS', 12, {
			fill: C.muted,
			spacing: 1,
		}),
		text(952, 776, 'Achievements are cosmetic', 13, {
			fill: C.muted,
			anchor: 'end',
		}),
		'</svg>',
	].join('')
}

/** Text equivalent for Discord's image description; no additional private data. */
export function describeProfileCard(data: ProfileCardData): string {
	const values = stats(data.summary)
		.map((s) => `${s.label}: ${fit(s.value, 1, 40)}`)
		.join('. ')
	const awards = data.badges
		.slice(0, MAX_PROFILE_BADGES)
		.map((badge) => {
			const art = achievementPresentation(badge)
			return `${fit(clean(art.name), 1, 30)} (${fit(clean(art.caption), 1, 65)})`
		})
		.join('; ')
	return clean(
		[
			`${fit(clean(data.displayName) || 'Unknown', 1, 60)} · Pluto profile.`,
			data.tier === null
				? 'XP profile unavailable.'
				: `${fit(clean(data.tier), 1, 30)}${data.level === null ? '' : `, level ${data.level}`}.`,
			data.summary ? `${values}.` : 'Stats and achievements unavailable.',
			awards
				? `Recent earned achievements: ${awards}.`
				: data.summary
					? 'No earned achievements yet.'
					: '',
			'Achievements are cosmetic.',
		].join(' '),
	).slice(0, 1024)
}

export async function renderProfileCard(
	data: ProfileCardData,
): Promise<Buffer> {
	return await sharp(Buffer.from(buildProfileCardSvg(data)))
		.png()
		.toBuffer()
}
