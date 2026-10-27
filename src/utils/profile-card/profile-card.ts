import sharp from 'sharp'
import type { AchievementSummary } from '../api/Khronos/achievements/achievements-wrapper.js'

export const PROFILE_CARD_WIDTH = 800
export const PROFILE_CARD_HEIGHT = 420
export const MAX_PROFILE_BADGES = 5

export interface ProfileCardData {
	displayName: string
	/** XP tier such as "Gold"; null when the profile could not be loaded. */
	tier: string | null
	/** XP level; null when the profile could not be loaded. */
	level: number | null
	/** null when achievements could not be loaded. */
	summary: AchievementSummary | null
	/** Names of earned badges, newest first. */
	badges: string[]
	/** Total earned badges, which may exceed `badges.length`. */
	earnedCount?: number
}

/**
 * The slim production image ships no fonts, so the first families listed must
 * be installed there (for example fonts-dejavu-core) or text renders blank.
 */
const FONT_STACK =
	"'DejaVu Sans', 'Liberation Sans', 'Noto Sans', Arial, Helvetica, sans-serif"

const COLORS = {
	bg: '#111214',
	panel: '#1e1f22',
	tile: '#2b2d31',
	text: '#f2f3f5',
	muted: '#949ba4',
	accent: '#c8eefb',
	gold: '#d8b21a',
	green: '#57f287',
	red: '#ed4245',
} as const

const AVATAR_COLORS = ['#5865f2', '#9b59b6', '#1abc9c', '#e67e22', '#e91e63']

const PAD = 40

const escapeXml = (value: string) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')

/** Control, zero-width and bidi-override code points never belong in a name. */
const isHiddenCodePoint = (cp: number) =>
	cp < 0x20 ||
	(cp >= 0x7f && cp <= 0x9f) ||
	(cp >= 0x200b && cp <= 0x200f) ||
	(cp >= 0x2028 && cp <= 0x202e)

const clean = (value: string) =>
	Array.from(value)
		.filter((ch) => !isHiddenCodePoint(ch.codePointAt(0) ?? 0))
		.join('')
		.trim()

/** Rough advance width in px: wide scripts count a full em, others 0.62 em. */
function textWidth(value: string, fontSize: number): number {
	let em = 0
	for (const ch of value) {
		const cp = ch.codePointAt(0) ?? 0
		em += cp >= 0x2e80 ? 1 : 0.62
	}
	return em * fontSize
}

function fitText(value: string, fontSize: number, maxWidth: number): string {
	if (textWidth(value, fontSize) <= maxWidth) return value
	const chars = Array.from(value)
	while (
		chars.length > 1 &&
		textWidth(`${chars.join('')}...`, fontSize) > maxWidth
	)
		chars.pop()
	return `${chars.join('')}...`
}

/** Largest font size (down to `min`) that fits `value` into `maxWidth`. */
function shrinkToFit(
	value: string,
	fontSize: number,
	min: number,
	maxWidth: number,
): number {
	let size = fontSize
	while (size > min && textWidth(value, size) > maxWidth) size -= 1
	return size
}

const formatMoney = (amount: number, signed = false): string => {
	const abs = Math.abs(amount).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
	if (amount < 0) return `-$${abs}`
	return `${signed && amount > 0 ? '+' : ''}$${abs}`
}

// Khronos sends the prediction hit rate as a 0-1 ratio.
const formatPercent = (rate: number): string => `${Math.round(rate * 100)}%`

function avatarInitial(name: string): string {
	for (const ch of name) {
		if (/[\p{L}\p{N}]/u.test(ch)) return ch.toUpperCase()
	}
	return '?'
}

function avatarColor(name: string): string {
	let hash = 0
	for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
	return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function text(opts: {
	x: number
	y: number
	size: number
	fill: string
	body: string
	weight?: 'normal' | 'bold'
	anchor?: 'start' | 'middle' | 'end'
	spacing?: number
}): string {
	const weight = opts.weight === 'bold' ? ' font-weight="700"' : ''
	const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : ''
	const spacing = opts.spacing ? ` letter-spacing="${opts.spacing}"` : ''
	return `<text x="${opts.x}" y="${opts.y}" font-size="${opts.size}" fill="${opts.fill}"${weight}${anchor}${spacing}>${escapeXml(opts.body)}</text>`
}

interface Tile {
	label: string
	value: string
	color: string
}

function buildTiles(summary: AchievementSummary | null): Tile[] {
	const dash = '-'
	if (!summary) {
		return [
			{ label: 'RECORD', value: dash, color: COLORS.text },
			{ label: 'NET PROFIT', value: dash, color: COLORS.text },
			{ label: 'BEST WIN', value: dash, color: COLORS.text },
			{ label: 'PREDICTION HIT RATE', value: dash, color: COLORS.text },
		]
	}
	const profitColor =
		summary.net_profit > 0
			? COLORS.green
			: summary.net_profit < 0
				? COLORS.red
				: COLORS.text
	return [
		{
			label: 'RECORD',
			value: `${summary.wins}-${summary.losses}-${summary.pushes}`,
			color: COLORS.text,
		},
		{
			label: 'NET PROFIT',
			value: formatMoney(summary.net_profit, true),
			color: profitColor,
		},
		{
			label: 'BEST WIN',
			value:
				summary.best_win_payout === null
					? dash
					: formatMoney(summary.best_win_payout),
			color: COLORS.text,
		},
		{
			label: 'PREDICTION HIT RATE',
			value:
				summary.prediction_hit_rate === null
					? dash
					: formatPercent(summary.prediction_hit_rate),
			color: COLORS.text,
		},
	]
}

function buildBadgePills(badges: string[], originY: number): string {
	const maxRight = PROFILE_CARD_WIDTH - PAD
	const pillHeight = 34
	const gapX = 12
	const gapY = 12
	let x = PAD
	let y = originY
	const out: string[] = []
	for (const raw of badges.slice(0, MAX_PROFILE_BADGES)) {
		const name = fitText(clean(raw) || 'Badge', 15, 300)
		const width = Math.ceil(textWidth(name, 15)) + 36
		if (x + width > maxRight && x > PAD) {
			x = PAD
			y += pillHeight + gapY
		}
		out.push(
			`<rect x="${x}" y="${y}" width="${width}" height="${pillHeight}" rx="${pillHeight / 2}" fill="${COLORS.tile}" stroke="${COLORS.gold}" stroke-width="1.5"/>`,
			`<circle cx="${x + 17}" cy="${y + pillHeight / 2}" r="4" fill="${COLORS.gold}"/>`,
			text({
				x: x + 30,
				y: y + 22,
				size: 15,
				fill: COLORS.text,
				body: name,
			}),
		)
		x += width + gapX
	}
	return out.join('')
}

/** Builds the 800x420 profile card as an SVG string. Pure and deterministic. */
export function buildProfileCardSvg(data: ProfileCardData): string {
	const displayName = clean(data.displayName) || 'Unknown'
	const hasTier = data.tier !== null && clean(data.tier) !== ''
	const tierLabel = hasTier
		? `${clean(data.tier).toUpperCase()}${data.level === null ? '' : `  -  LVL ${data.level}`}`
		: ''
	const badgeWidth = hasTier ? Math.ceil(textWidth(tierLabel, 15)) + 40 : 0
	const nameMaxWidth =
		PROFILE_CARD_WIDTH -
		PAD -
		100 -
		PAD -
		(badgeWidth ? badgeWidth + 20 : 0)
	const nameSize = 30
	const name = fitText(displayName, nameSize, nameMaxWidth)

	const tileGap = 16
	const tileWidth = (PROFILE_CARD_WIDTH - PAD * 2 - tileGap * 3) / 4
	const tileY = 136
	const tileInner = tileWidth - 32
	const tileData = buildTiles(data.summary)
	// One value size for the whole row so the tiles read as a set.
	const valueSize = Math.min(
		...tileData.map((t) => shrinkToFit(t.value, 28, 16, tileInner)),
	)
	const tiles = tileData
		.map((tile, i) => {
			const x = PAD + i * (tileWidth + tileGap)
			return [
				`<rect x="${x}" y="${tileY}" width="${tileWidth}" height="92" rx="12" fill="${COLORS.tile}"/>`,
				text({
					x: x + 16,
					y: tileY + 30,
					size: 11,
					fill: COLORS.muted,
					body: fitText(tile.label, 11, tileInner),
					spacing: 1,
				}),
				text({
					x: x + 16,
					y: tileY + 68,
					size: valueSize,
					fill: tile.color,
					body: tile.value,
					weight: 'bold',
				}),
			].join('')
		})
		.join('')

	const earned = data.earnedCount ?? data.badges.length
	const sectionTitle =
		earned > 0 ? `RECENT BADGES  -  ${earned} EARNED` : 'RECENT BADGES'
	const badgeY = 290
	const badgeBody =
		data.badges.length > 0
			? buildBadgePills(data.badges, badgeY)
			: text({
					x: PAD,
					y: badgeY + 22,
					size: 15,
					fill: COLORS.muted,
					body:
						data.summary && data.summary.settled_bets > 0
							? 'No badges earned yet. Keep playing to unlock your first.'
							: 'No badges yet. Place a bet to start earning them.',
				})

	const tierBadge = hasTier
		? [
				`<rect x="${PROFILE_CARD_WIDTH - PAD - badgeWidth}" y="46" width="${badgeWidth}" height="36" rx="18" fill="${COLORS.tile}" stroke="${COLORS.accent}" stroke-width="1.5"/>`,
				text({
					x: PROFILE_CARD_WIDTH - PAD - badgeWidth / 2,
					y: 70,
					size: 15,
					fill: COLORS.accent,
					body: tierLabel,
					weight: 'bold',
					anchor: 'middle',
				}),
			].join('')
		: ''

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${PROFILE_CARD_WIDTH}" height="${PROFILE_CARD_HEIGHT}" viewBox="0 0 ${PROFILE_CARD_WIDTH} ${PROFILE_CARD_HEIGHT}" font-family="${FONT_STACK}">`,
		`<rect width="${PROFILE_CARD_WIDTH}" height="${PROFILE_CARD_HEIGHT}" fill="${COLORS.bg}"/>`,
		`<rect x="8" y="8" width="${PROFILE_CARD_WIDTH - 16}" height="${PROFILE_CARD_HEIGHT - 16}" rx="20" fill="${COLORS.panel}"/>`,
		`<circle cx="${PAD + 32}" cy="64" r="32" fill="${avatarColor(displayName)}"/>`,
		text({
			x: PAD + 32,
			y: 76,
			size: 32,
			fill: '#ffffff',
			body: avatarInitial(displayName),
			weight: 'bold',
			anchor: 'middle',
		}),
		text({
			x: PAD + 84,
			y: 74,
			size: nameSize,
			fill: COLORS.text,
			body: name,
			weight: 'bold',
		}),
		tierBadge,
		`<line x1="${PAD}" y1="108" x2="${PROFILE_CARD_WIDTH - PAD}" y2="108" stroke="${COLORS.tile}" stroke-width="2"/>`,
		tiles,
		text({
			x: PAD,
			y: 262,
			size: 12,
			fill: COLORS.muted,
			body: sectionTitle,
			spacing: 1,
		}),
		badgeBody,
		text({
			x: PROFILE_CARD_WIDTH - PAD,
			y: PROFILE_CARD_HEIGHT - 26,
			size: 11,
			fill: COLORS.muted,
			body: 'Pluto  -  achievements are cosmetic',
			anchor: 'end',
		}),
		'</svg>',
	].join('')
}

/** Renders the profile card to a PNG. Makes no network requests. */
export async function renderProfileCard(
	data: ProfileCardData,
): Promise<Buffer> {
	return await sharp(Buffer.from(buildProfileCardSvg(data)))
		.png()
		.toBuffer()
}
