#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, lstat, readlink } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(resolve(root, 'scripts/verification/config.json'), 'utf8'))
const git = (args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 })
async function source() {
  const sha = git(['rev-parse', 'HEAD']).toString().trim()
  const tree = git(['rev-parse', 'HEAD^{tree}']).toString().trim()
  const diff = git(['diff', '--binary', 'HEAD', '--'])
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean).sort()
  const hash = createHash('sha256').update(tree).update(diff)
  for (const file of untracked) {
    const path = resolve(root, file)
    hash.update(file).update('\0')
    const info = await lstat(path)
    hash.update(info.isSymbolicLink() ? await readlink(path) : await readFile(path))
  }
  return { sha, tree, dirty: diff.length > 0 || untracked.length > 0, fingerprint: hash.digest('hex') }
}
const initial = await source()
const run = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`
const out = resolve(root, '.verification', run)
await mkdir(out, { recursive: true })
const manifestPath = resolve(out, 'manifest.json')
const seed = Number(process.env.VERIFY_SEED ?? randomInt(0, 0x7fffffff))
if (!Number.isInteger(seed) || seed < -0x80000000 || seed > 0x7fffffff) throw new Error('VERIFY_SEED must be a signed 32-bit integer')
const manifest = {
  schemaVersion: 1, project: config.project, run, command: 'node scripts/verify.mjs',
  source: initial, startedAt: new Date().toISOString(), completedAt: null,
  status: 'running', propertySeed: seed, scope: config.scope,
  checks: config.steps.map((step) => ({ name: step.name, required: true, command: step.command, status: 'pending' })),
  skipped: config.skipped, cleanup: false,
}
const save = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
let current
let interrupted
const kill = (child, signal) => {
  if (!child?.pid) return
  try {
    if (process.platform === 'win32') {
      if (child.exitCode === null) execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else process.kill(-child.pid, signal)
  } catch (error) { if (error.code !== 'ESRCH') throw error }
}
const handleSignal = (signal) => {
  interrupted = signal
  kill(current, 'SIGTERM')
}
process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)
await save()
let failed = false
try {
  for (const [index, step] of config.steps.entries()) {
    const check = manifest.checks[index]
    if (failed || interrupted) {
      Object.assign(check, { status: 'skipped', reason: interrupted ?? 'Earlier required check failed' })
      continue
    }
    check.startedAt = new Date().toISOString()
    check.status = 'running'
    const logPath = resolve(out, `${index + 1}.log`)
    check.log = relative(out, logPath)
    const log = createWriteStream(logPath)
    const started = Date.now()
    await save()
    console.log(`VERIFY ${step.name}`)
    let timer
    let escalation
    try {
      current = spawn(step.command[0], step.command.slice(1), {
        cwd: root, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...step.env, VERIFY_EVIDENCE_DIR: out, VERIFY_SEED: String(seed), VITEST_MAX_WORKERS: '2' },
      })
      current.stdout.pipe(log, { end: false })
      current.stderr.pipe(log, { end: false })
      let timedOut = false
      timer = setTimeout(() => {
        timedOut = true
        kill(current, 'SIGTERM')
        escalation = setTimeout(() => kill(current, 'SIGKILL'), 5000)
      }, step.timeoutMs ?? 180000)
      const child = current
      const result = await new Promise((done, reject) => {
        child.once('error', reject)
        child.once('close', (code, signal) => done({ code, signal }))
      })
      check.exitCode = result.code
      check.signal = result.signal
      check.status = result.code === 0 && !timedOut && !interrupted ? 'passed' : 'failed'
      if (timedOut) check.reason = 'Command exceeded timeout'
      if (interrupted) check.reason = interrupted
    } catch (error) {
      check.status = 'failed'
      check.reason = error.code ?? error.name
    } finally {
      clearTimeout(timer)
      clearTimeout(escalation)
      kill(current, 'SIGKILL')
      current = undefined
      await new Promise((done) => log.end(done))
      check.durationMs = Date.now() - started
      check.completedAt = new Date().toISOString()
      await save()
    }
    if (check.status !== 'passed') {
      failed = true
      console.error(`FAILED ${step.name}; see ${logPath}`)
    }
  }
  const final = await source()
  manifest.sourceUnchanged = initial.sha === final.sha && initial.fingerprint === final.fingerprint
  if (!manifest.sourceUnchanged) { failed = true; manifest.reason = 'Source changed during verification; rerun on final source' }
  manifest.status = !failed && !interrupted && manifest.checks.every((check) => check.status === 'passed') ? 'passed' : 'failed'
} finally {
  kill(current, 'SIGKILL')
  manifest.cleanup = true
  manifest.completedAt = new Date().toISOString()
  if (manifest.status === 'running') manifest.status = 'failed'
  await save()
  await readFile(manifestPath)
  process.removeListener('SIGINT', handleSignal)
  process.removeListener('SIGTERM', handleSignal)
  console.log(`${manifest.status.toUpperCase()} ${manifestPath}`)
}
process.exitCode = manifest.status === 'passed' ? 0 : 1
