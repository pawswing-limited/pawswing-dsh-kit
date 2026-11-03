import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { buildArgs, parseReceipt, canonicalFromReceipt, runKit } from '../src/kit-client.js'
import { findStationSshBypass } from '../src/guard.js'
import { kitTools } from '../src/tools.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-kit.mjs', import.meta.url))
const config = {
  kitBin: FAKE,
  catalog: '/nonexistent/catalog.json',
  defaultKit: 'kit000',
  person: 'tester',
  session: 'test-session',
  timeoutMs: 10000,
}

async function execFileOk(file, argv, options) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [file, ...argv], { ...options, encoding: 'utf8' })
    return { stdout, stderr }
  } catch (error) {
    if (typeof error.code === 'number') return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', code: error.code }
    throw error
  }
}

test('parseReceipt picks the last kit receipt line', () => {
  const stdout = 'noise\n{"schema":"pawswing.kit.v1","ok":true,"request_id":"a"}\n{"x":1}\n'
  assert.equal(parseReceipt(stdout).request_id, 'a')
  assert.equal(parseReceipt('no json'), null)
})

test('unknown outcome is never a success', () => {
  const value = canonicalFromReceipt(
    { ok: false, execution_state: 'outcome_unknown', request_id: 'r1' }, 5, '',
  )
  assert.equal(value.ok, false)
  assert.equal(value.execution_state, 'outcome_unknown')
  const missing = canonicalFromReceipt(null, 3, 'boom')
  assert.equal(missing.ok, false)
  assert.equal(missing.execution_state, 'receipt_missing')
})

test('measure_power refuses powered modes before spawning', () => {
  assert.throws(() => buildArgs(config, 'measure_power', { plan: 'p', mode: 'on' }), /mode=off/)
  const argv = buildArgs(config, 'measure_power', { plan: 'p', mode: 'off' })
  assert.ok(argv.includes('--mode'))
})

test('measure tools refuse missing identity', () => {
  const bare = { ...config, person: '', session: '' }
  assert.throws(() => buildArgs(bare, 'measure_analog', {}), /person and session/)
})

test('runKit round-trips a fake kit receipt', async () => {
  const value = await runKit(execFileOk, config, 'list', {})
  assert.equal(value.ok, true)
  assert.equal(value.request_id, 'fake-req-1')
  assert.ok(value.receipt.raw.argv.includes('--config'))
})

test('runKit preserves outcome_unknown from a failing kit', async () => {
  process.env.FAKE_KIT_MODE = 'unknown'
  try {
    const value = await runKit(execFileOk, config, 'list', {})
    assert.equal(value.ok, false)
    assert.equal(value.execution_state, 'outcome_unknown')
  } finally {
    delete process.env.FAKE_KIT_MODE
  }
})

test('ssh bypass guard matches station hosts only in shell tools', () => {
  const hosts = ['100.96.0.5', 'kit000.ts.pawswing.app']
  assert.equal(findStationSshBypass('bash', { command: 'ssh root@100.96.0.5 true' }, hosts), '100.96.0.5')
  assert.equal(findStationSshBypass('bash', { command: 'ssh example.com true' }, hosts), null)
  assert.equal(findStationSshBypass('kit_list', {}, hosts), null)
})

test('tool factory registers the v1 surface without a raw do', () => {
  const defs = []
  const fakeDefine = (spec) => { defs.push(spec); return spec }
  const tools = kitTools(fakeDefine, async () => ({ ok: true }))
  const names = tools.map((t) => t.name)
  assert.ok(names.includes('kit_list'))
  assert.ok(names.includes('kit_measure_power'))
  assert.ok(!names.includes('kit_do'))
})
