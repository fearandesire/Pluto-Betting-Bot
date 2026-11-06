import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
	ACHIEVEMENT_ART_KEYS,
	achievementPresentation,
} from '../achievement-art.js'
import {
	buildProfileCardSvg,
	describeProfileCard,
	type ProfileCardData,
	renderProfileCard,
} from '../profile-card.js'
import { emptyCard, fullCard, stressCard } from './fixtures.js'

/** Offline native proof. No Discord, APIs, real profiles or remote artwork.
 * PROFILE_CARD_SAMPLE_DIR=... PROFILE_CARD_BASE_DIR=/path/to/base pnpm vitest run src/utils/profile-card/__tests__/sample
 * Optional baseline is an unmodified checkout; both renderers receive identical fixture values.
 */
const dir = process.env.PROFILE_CARD_SAMPLE_DIR
const baselineDir = process.env.PROFILE_CARD_BASE_DIR
const xml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;')

describe.skipIf(!dir)('profile card visual evidence', () => {
	it('captures native states, all original artwork, bounds and timings', async () => {
		const output = path.resolve(dir as string)
		mkdirSync(output, { recursive: true })
		const baseline = baselineDir
			? await import(
					pathToFileURL(
						path.join(
							baselineDir,
							'src/utils/profile-card/profile-card.ts',
						),
					).href
				)
			: null
		const samples: Record<string, ProfileCardData> = {
			populated: fullCard,
			empty: emptyCard,
			unavailable: {
				displayName: 'FenixPlays',
				tier: 'Gold',
				level: 38,
				summary: null,
				badges: [],
			},
			stress: stressCard,
		}
		const metrics: Record<string, unknown> = {}
		const manifests: Record<string, unknown> = {}
		const frames: string[] = []
		const { default: puppeteer } = await import('puppeteer')
		const browser = await puppeteer.launch({
			executablePath:
				process.env.PROFILE_CARD_BROWSER ?? '/usr/bin/chromium',
			headless: true,
			args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
		})
		try {
			const page = await browser.newPage()
			await page.emulateMediaFeatures([
				{ name: 'prefers-reduced-motion', value: 'reduce' },
			])
			// Prove all captures are self-contained. Only generated data: images load.
			await page.setRequestInterception(true)
			page.on('request', (request) =>
				request.url().startsWith('data:') ||
				request.url() === 'about:blank'
					? request.continue()
					: request.abort(),
			)
			for (const [state, data] of Object.entries(samples)) {
				const after = await renderProfileCard(data)
				const svg = buildProfileCardSvg(data)
				writeFileSync(path.join(output, `${state}-after.png`), after)
				writeFileSync(path.join(output, `${state}-after.svg`), svg)
				const beforeData = {
					...data,
					badges: data.badges.map((b) => b.name),
				}
				const before: Buffer | null = baseline
					? await baseline.renderProfileCard(beforeData)
					: null
				if (before)
					writeFileSync(
						path.join(output, `${state}-before.png`),
						before,
					)
				await page.setContent(svg)
				await page.evaluate(() => document.fonts.ready)
				const bounds = await page.evaluate(() =>
					Array.from(document.querySelectorAll('svg text')).map(
						(node) => {
							const box = (node as SVGTextElement).getBBox()
							return {
								text: node.textContent,
								x: box.x,
								y: box.y,
								width: box.width,
								height: box.height,
							}
						},
					),
				)
				const overflow = bounds.filter(
					(box) =>
						box.x < 0 ||
						box.y < 0 ||
						box.x + box.width > 1000 ||
						box.y + box.height > 800,
				)
				expect(
					overflow,
					`${state} has no text outside native canvas`,
				).toEqual([])
				const renderTimes: Record<string, number[]> = {
					before: [],
					after: [],
				}
				for (let i = 0; i < 12; i++) {
					if (baseline) {
						const started = performance.now()
						await baseline.renderProfileCard(beforeData)
						renderTimes.before.push(performance.now() - started)
					}
					const started = performance.now()
					await renderProfileCard(data)
					renderTimes.after.push(performance.now() - started)
				}
				const timings = Object.fromEntries(
					Object.entries(renderTimes).map(([key, times]) => {
						const sorted = [...times].sort((a, b) => a - b)
						return [
							key,
							{
								samples: times.length,
								warmMedianMs:
									sorted[Math.floor(sorted.length / 2)] ??
									null,
								warmMaxMs: sorted[sorted.length - 1] ?? null,
							},
						]
					}),
				)
				metrics[state] = {
					before: before
						? { bytes: before.length, width: 800, height: 420 }
						: null,
					after: { bytes: after.length, width: 1000, height: 800 },
					timings,
					textBounds: bounds,
					textOutsideCanvas: overflow,
				}
				manifests[state] = {
					data,
					beforeData,
					imageDescription: describeProfileCard(data),
				}
				const figure = (bytes: Buffer, label: string, alt: string) =>
					`<figure><figcaption>${label}</figcaption><img alt="${xml(alt).replace(/"/g, '&quot;')}" src="data:image/png;base64,${bytes.toString('base64')}" /></figure>`
				frames.push(
					`<section class="slide" id="${state}" ${state === 'populated' ? '' : 'hidden'}><h2>${state}</h2><div class="pair">${before ? figure(before, 'Before · current main', 'Previous Pluto profile card using the same fixture values') : '<p>Baseline unavailable</p>'}${figure(after, 'After · clubhouse scorecard', describeProfileCard(data))}</div></section>`,
				)
			}
			const artSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f3eddd"/><text x="48" y="65" font-family="DejaVu Serif" font-size="32" fill="#173e35">The Pluto honours collection</text><text x="48" y="99" font-family="DejaVu Sans" font-size="16" fill="#59675e">Original SVG artwork · presentation names · existing Khronos eligibility</text>${ACHIEVEMENT_ART_KEYS.map(
				(key, i) => {
					const x = 48 + (i % 4) * 294
					const y = 142 + Math.floor(i / 4) * 305
					const art = achievementPresentation({ key, name: key })
					return `<g transform="translate(${x} ${y})"><g transform="translate(35 0) scale(1.5)">${art.markup}</g><text x="0" y="215" font-family="DejaVu Serif" font-size="22" fill="#173e35">${xml(art.name)}</text><text x="0" y="244" font-family="DejaVu Sans" font-size="12" fill="#59675e">${xml(art.caption)}</text><text x="0" y="270" font-family="DejaVu Sans Mono" font-size="11" fill="#59675e">${key}</text></g>`
				},
			).join('')}</svg>`
			writeFileSync(
				path.join(output, 'achievement-collection.svg'),
				artSvg,
			)
			writeFileSync(
				path.join(output, 'achievement-collection.png'),
				await sharp(Buffer.from(artSvg)).png().toBuffer(),
			)
			const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pluto profile · before and after</title><style>*{box-sizing:border-box}body{margin:0;background:#e5e4dd;color:#173e35;font:16px system-ui}main{max-width:1440px;margin:auto;padding:28px}h1{font:36px Georgia;margin:0 0 8px}p{max-width:1000px;line-height:1.5}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}figure{margin:0}figcaption{padding:12px 0;font-weight:600}img{display:block;width:100%;height:auto}nav{display:flex;gap:8px;flex-wrap:wrap}button{font:inherit;background:#f3eddd;color:#173e35;border:1px solid #173e35;padding:10px 14px;cursor:pointer}button[aria-current=true]{background:#173e35;color:#f3eddd}:focus-visible{outline:3px solid #a44725;outline-offset:3px}h2{text-transform:capitalize;font:24px Georgia;margin:24px 0 6px}@media(max-width:700px){main{padding:16px}h1{font-size:30px}.pair{grid-template-columns:1fr}}@media(prefers-reduced-motion:no-preference){button{transition:background .15s}}</style><noscript><style>.slide[hidden]{display:block}</style></noscript><main><h1>The record, reimagined.</h1><p>Pluto /profile · Local native renders with synthetic fixtures, never real user stats. Both sides receive identical values. This is a visual review, not a live Discord capture.</p><nav aria-label="Profile states">${Object.keys(
				samples,
			)
				.map(
					(state) =>
						`<button type="button" data-state="${state}" aria-current="${state === 'populated'}">${state}</button>`,
				)
				.join(
					'',
				)}</nav>${frames.join('')}<p>Before: main at ${baselineDir ? execFileSync('git', ['-C', baselineDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() : 'unavailable'}. After: working-tree renderer. Achievement eligibility and /profile visibility are unchanged.</p></main><script>(()=>{const buttons=[...document.querySelectorAll('[data-state]')];function show(state){document.querySelectorAll('.slide').forEach(s=>s.hidden=s.id!==state);buttons.forEach(b=>b.setAttribute('aria-current',String(b.dataset.state===state)))}buttons.forEach((b,i)=>{b.onclick=()=>show(b.dataset.state);b.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=buttons[(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length];next.focus();show(next.dataset.state)}}});})();</script></html>`
			writeFileSync(path.join(output, 'index.html'), html)
			for (const viewport of [1440, 390]) {
				await page.setViewport({
					width: viewport,
					height: 1000,
					deviceScaleFactor: 1,
				})
				await page.setContent(html)
				await page.evaluate(() =>
					Promise.all(
						Array.from(document.images, (img) => img.decode()),
					),
				)
				await page.focus('[data-state="populated"]')
				await page.keyboard.press('ArrowRight')
				expect(
					await page.$eval(
						'#empty',
						(el) => !(el as HTMLElement).hidden,
					),
				).toBe(true)
				await page.keyboard.press('ArrowLeft')
				for (const state of Object.keys(samples)) {
					await page.click(`[data-state="${state}"]`)
					await page.screenshot({
						path: path.join(output, `${state}-${viewport}.png`),
						fullPage: true,
					})
					const frame = await page.evaluate(() => ({
						viewport: innerWidth,
						contentWidth: document.documentElement.scrollWidth,
					}))
					expect(frame.contentWidth).toBe(frame.viewport)
				}
			}
		} finally {
			await browser.close()
		}
		writeFileSync(
			path.join(output, 'manifest.json'),
			JSON.stringify(
				{
					synthetic: true,
					sourceSha256: Object.fromEntries(
						['profile-card.ts', 'achievement-art.ts'].map(
							(name) => [
								name,
								createHash('sha256')
									.update(
										readFileSync(
											path.join(
												import.meta.dirname,
												'..',
												name,
											),
										),
									)
									.digest('hex'),
							],
						),
					),
					baselineRevision: baselineDir
						? execFileSync(
								'git',
								['-C', baselineDir, 'rev-parse', 'HEAD'],
								{ encoding: 'utf8' },
							).trim()
						: null,
					fixtures: manifests,
				},
				null,
				2,
			),
		)
		writeFileSync(
			path.join(output, 'metrics.json'),
			JSON.stringify(metrics, null, 2),
		)
	}, 60000)
})
