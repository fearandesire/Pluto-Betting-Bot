import sharp from 'sharp'
import type { AchievementSummary } from '../api/Khronos/achievements/achievements-wrapper.js'
import { BADGE_ICON_SIZE, badgeIconMarkup } from './badge-icons.js'

export const PROFILE_CARD_WIDTH = 800
export const PROFILE_CARD_HEIGHT = 480
/** One medallion per achievement; the catalogue has eight today. */
export const MAX_PROFILE_BADGES = 8

export interface ProfileBadge {
	/** Khronos achievement key; picks the icon. Unknown keys get a star. */
	key?: string
	name: string
}

export interface ProfileCardData {
	displayName: string
	/** XP tier such as "Gold"; null when the profile could not be loaded. */
	tier: string | null
	/** XP level; null when the profile could not be loaded. */
	level: number | null
	/** null when achievements could not be loaded. */
	summary: AchievementSummary | null
	/** Earned badges, newest first. */
	badges: ProfileBadge[]
	/** Badges still to earn; drawn dimmed after the earned ones. */
	locked?: ProfileBadge[]
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
	bg: '#0a0b0f',
	panel: '#12151c',
	tile: '#1b1f2a',
	tileEdge: '#2a3040',
	line: '#232734',
	text: '#f2f3f5',
	muted: '#8c94a5',
	accent: '#c8eefb',
	gold: '#f5cf47',
	goldDeep: '#b8860b',
	lockedFill: '#12141a',
	lockedEdge: '#2a2f3c',
	lockedIcon: '#454c5f',
	lockedText: '#5f6779',
	green: '#57f287',
	red: '#ed4245',
} as const

/** Tier names come from Pluto's XP ladder (Bronze through Diamond). */
const TIER_COLORS: Record<string, string> = {
	bronze: '#d98a48',
	silver: '#c5ccd8',
	gold: '#f5cf47',
	emerald: '#3ddc97',
	diamond: '#6cc7ff',
}
const tierColor = (tier: string | null): string =>
	TIER_COLORS[(tier ?? '').trim().toLowerCase()] ?? COLORS.accent

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

const SLOT_PITCH = (PROFILE_CARD_WIDTH - PAD * 2) / MAX_PROFILE_BADGES
const MEDAL_RADIUS = 30

/** Gradients and the blur used by the medallions and the backdrop. */
function buildDefs(accent: string): string {
	return [
		'<defs>',
		`<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.panel}"/><stop offset="1" stop-color="${COLORS.bg}"/></linearGradient>`,
		`<radialGradient id="glow" cx="0.88" cy="0.04" r="0.7"><stop offset="0" stop-color="${accent}" stop-opacity="0.26"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`,
		`<linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.tile}"/><stop offset="1" stop-color="#151821"/></linearGradient>`,
		`<linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0.35"/></linearGradient>`,
		`<radialGradient id="medal" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#4a3b0c"/><stop offset="1" stop-color="#17130a"/></radialGradient>`,
		`<linearGradient id="medalEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe681"/><stop offset="1" stop-color="${COLORS.goldDeep}"/></linearGradient>`,
		'<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>',
		'</defs>',
	].join('')
}

function buildMedallion(
	badge: ProfileBadge,
	index: number,
	earned: boolean,
	cy: number,
): string {
	const cx = PAD + SLOT_PITCH / 2 + index * SLOT_PITCH
	const iconSize = 28
	const scale = iconSize / BADGE_ICON_SIZE
	const color = earned ? COLORS.gold : COLORS.lockedIcon
	const label = fitText(clean(badge.name) || 'Badge', 11, SLOT_PITCH - 8)
	return [
		earned
			? `<circle cx="${cx}" cy="${cy}" r="${MEDAL_RADIUS}" fill="${COLORS.gold}" opacity="0.4" filter="url(#blur)"/>`
			: '',
		`<circle cx="${cx}" cy="${cy}" r="${MEDAL_RADIUS}" fill="${earned ? 'url(#medal)' : COLORS.lockedFill}" stroke="${earned ? 'url(#medalEdge)' : COLORS.lockedEdge}" stroke-width="2"/>`,
		earned
			? `<circle cx="${cx}" cy="${cy}" r="${MEDAL_RADIUS - 6}" fill="none" stroke="${COLORS.gold}" stroke-opacity="0.18" stroke-width="1"/>`
			: '',
		`<g transform="translate(${cx - iconSize / 2} ${cy - iconSize / 2}) scale(${scale})" color="${color}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${badgeIconMarkup(badge.key)}</g>`,
		text({
			x: cx,
			y: cy + MEDAL_RADIUS + 24,
			size: 11,
			fill: earned ? COLORS.text : COLORS.lockedText,
			body: label,
			anchor: 'middle',
		}),
	].join('')
}

/** Earned badges first (newest first), then the ones still locked. */
function buildMedallions(data: ProfileCardData, cy: number): string {
	const slots = [
		...data.badges.map((badge) => ({ badge, earned: true })),
		...(data.locked ?? []).map((badge) => ({ badge, earned: false })),
	].slice(0, MAX_PROFILE_BADGES)
	return slots
		.map((slot, i) => buildMedallion(slot.badge, i, slot.earned, cy))
		.join('')
}

/** Builds the 800x480 profile card as an SVG string. Pure and deterministic. */
export function buildProfileCardSvg(data: ProfileCardData): string {
	const displayName = clean(data.displayName) || 'Unknown'
	const hasTier = data.tier !== null && clean(data.tier) !== ''
	const accent = hasTier ? tierColor(clean(data.tier)) : COLORS.accent
	const tierLabel = hasTier
		? `${clean(data.tier).toUpperCase()}${data.level === null ? '' : `  -  LVL ${data.level}`}`
		: ''
	const chipWidth = hasTier
		? Math.ceil(textWidth(tierLabel, 15)) + tierLabel.length + 44
		: 0
	const nameMaxWidth =
		PROFILE_CARD_WIDTH - PAD - 98 - PAD - (chipWidth ? chipWidth + 20 : 0)
	const nameSize = 30
	const name = fitText(displayName, nameSize, nameMaxWidth)

	const tileGap = 16
	const tileWidth = (PROFILE_CARD_WIDTH - PAD * 2 - tileGap * 3) / 4
	const tileY = 152
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
				`<rect x="${x}" y="${tileY}" width="${tileWidth}" height="92" rx="14" fill="url(#tile)" stroke="${COLORS.tileEdge}" stroke-width="1"/>`,
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
	const sectionTitle = earned > 0 ? `BADGES  -  ${earned} EARNED` : 'BADGES'
	const medalY = 346
	const hasSlots = data.badges.length + (data.locked?.length ?? 0) > 0
	const emptyHint = text({
		x: PAD,
		y: hasSlots ? medalY + MEDAL_RADIUS + 58 : medalY + 5,
		size: hasSlots ? 13 : 15,
		fill: COLORS.muted,
		body:
			data.summary && data.summary.settled_bets > 0
				? 'No badges earned yet. Keep playing to unlock your first.'
				: 'No badges yet. Place a bet to start earning them.',
	})
	const badgeBody = [
		hasSlots ? buildMedallions(data, medalY) : '',
		data.badges.length === 0 ? emptyHint : '',
	].join('')

	const tierChip = hasTier
		? [
				`<rect x="${PROFILE_CARD_WIDTH - PAD - chipWidth}" y="56" width="${chipWidth}" height="40" rx="20" fill="${accent}"/>`,
				text({
					x: PROFILE_CARD_WIDTH - PAD - chipWidth / 2,
					y: 82,
					size: 15,
					fill: '#10131a',
					body: tierLabel,
					weight: 'bold',
					anchor: 'middle',
					spacing: 1,
				}),
			].join('')
		: ''

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${PROFILE_CARD_WIDTH}" height="${PROFILE_CARD_HEIGHT}" viewBox="0 0 ${PROFILE_CARD_WIDTH} ${PROFILE_CARD_HEIGHT}" font-family="${FONT_STACK}">`,
		buildDefs(accent),
		`<rect width="${PROFILE_CARD_WIDTH}" height="${PROFILE_CARD_HEIGHT}" fill="${COLORS.bg}"/>`,
		`<rect x="8" y="8" width="${PROFILE_CARD_WIDTH - 16}" height="${PROFILE_CARD_HEIGHT - 16}" rx="22" fill="url(#bg)" stroke="${COLORS.line}" stroke-width="1"/>`,
		`<rect x="8" y="8" width="${PROFILE_CARD_WIDTH - 16}" height="${PROFILE_CARD_HEIGHT - 16}" rx="22" fill="url(#glow)"/>`,
		`<circle cx="${PAD + 36}" cy="76" r="36" fill="${avatarColor(displayName)}"/>`,
		`<circle cx="${PAD + 36}" cy="76" r="41" fill="none" stroke="url(#ring)" stroke-width="3"/>`,
		text({
			x: PAD + 36,
			y: 88,
			size: 34,
			fill: '#ffffff',
			body: avatarInitial(displayName),
			weight: 'bold',
			anchor: 'middle',
		}),
		text({
			x: PAD + 98,
			y: 88,
			size: nameSize,
			fill: COLORS.text,
			body: name,
			weight: 'bold',
		}),
		tierChip,
		`<line x1="${PAD}" y1="132" x2="${PROFILE_CARD_WIDTH - PAD}" y2="132" stroke="${COLORS.line}" stroke-width="2"/>`,
		tiles,
		text({
			x: PAD,
			y: 286,
			size: 12,
			fill: COLORS.muted,
			body: sectionTitle,
			spacing: 1.5,
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
