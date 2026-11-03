// Pure kit CLI client logic: argv building, receipt parsing, and a
// runner over an injected execFile. No Cordis imports here so unit
// tests can drive everything with a fake kit binary.

import { homedir } from 'node:os'
import { join } from 'node:path'

export function expandHome(path) {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path
}

export function parseReceipt(stdout) {
  const lines = String(stdout).split(/\r?\n/).filter((line) => line.trim().startsWith('{'))
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const value = JSON.parse(lines[i])
      if (value && value.schema === 'pawswing.kit.v1') return value
    } catch {
      // Keep scanning: diagnostics may share the stream in some hosts.
    }
  }
  return null
}

// Canonical tool value: the receipt verbatim plus a lossy, model-first
// summary. outcome_unknown / exit 5 stays ok:false exactly as the CLI
// reports it; this layer never upgrades a receipt into a success.
export function canonicalFromReceipt(receipt, exitCode, stderrTail) {
  if (!receipt) {
    return {
      ok: false,
      execution_state: 'receipt_missing',
      request_id: null,
      summary: `kit exited ${exitCode} without a pawswing.kit.v1 receipt${stderrTail ? `: ${stderrTail}` : ''}`,
      receipt: null,
    }
  }
  const state = receipt.execution_state ?? 'unknown_state'
  const ok = receipt.ok === true && state === 'succeeded'
  return {
    ok,
    execution_state: state,
    request_id: receipt.request_id ?? null,
    summary: ok
      ? `kit ${receipt.kit ?? ''} ${state} (request ${receipt.request_id ?? 'n/a'})`.trim()
      : `kit did not confirm success: state=${state} exit=${exitCode} request=${receipt.request_id ?? 'n/a'}; keep request/lease ids and check kit_log before any retry`,
    receipt,
  }
}

function requireIdentity(config, args) {
  const person = args.person || config.person
  const session = args.session || config.session
  if (!person || !session) {
    throw new Error('kit measure tools need a real person and session: set them in plugin config or pass them per call; never invent placeholders')
  }
  return { person, session }
}

export function buildArgs(config, command, args = {}) {
  const kit = args.kit || config.defaultKit
  if (!kit) throw new Error('no kit id: pass kit or set defaultKit in plugin config')
  switch (command) {
    case 'list':
      return ['list']
    case 'info':
      return ['info', kit]
    case 'lock_status':
      return ['lock', 'status', kit, '--resource', args.resource]
    case 'params': {
      const out = ['params', kit, args.action]
      if (args.resource) out.push('--resource', args.resource)
      return out
    }
    case 'log': {
      const out = ['log', kit, '--limit', String(args.limit ?? 50)]
      if (args.request_id) out.push('--request', args.request_id)
      return out
    }
    case 'measure_analog': {
      const { person, session } = requireIdentity(config, args)
      const out = ['measure', 'analog', kit,
        '--resource', args.resource || 'scope-1',
        '--channels', (args.channels ?? [1]).join(','),
        '--range-mv', String(args.range_mv ?? 5000),
        '--probe-factor', String(args.probe_factor ?? 10),
        '--person', person, '--session', session]
      if (args.trigger) out.push('--trigger', args.trigger)
      return out
    }
    case 'measure_thermal': {
      const { person, session } = requireIdentity(config, args)
      const out = ['measure', 'thermal', kit,
        '--resource', args.resource || 'thm-1',
        '--timeout-ms', String(args.timeout_ms ?? 20000),
        '--person', person, '--session', session]
      if (args.out) out.push('--out', args.out)
      return out
    }
    case 'measure_power': {
      if (args.mode !== 'off') {
        throw new Error('kit_measure_power in this plugin version only allows mode=off; powered modes wait for the human confirmation card (plan L3)')
      }
      const { person, session } = requireIdentity(config, args)
      return ['measure', 'power', kit,
        '--resource', args.resource || 'pwr-1',
        '--plan', args.plan, '--mode', 'off',
        '--person', person, '--session', session]
    }
    case 'artifact_stats': {
      const { person, session } = requireIdentity(config, args)
      return ['artifact', 'stats', kit,
        '--resource', args.resource,
        '--capture-request-id', args.capture_request_id,
        '--kind', args.kind,
        '--person', person, '--session', session]
    }
    default:
      throw new Error(`unsupported kit command: ${command}`)
  }
}

export async function runKit(execFileImpl, config, command, args = {}, signal) {
  const argv = ['--config', expandHome(config.catalog), ...buildArgs(config, command, args), '--json']
  let stdout = ''
  let stderr = ''
  let exitCode = 0
  try {
    const result = await execFileImpl(expandHome(config.kitBin), argv, {
      timeout: config.timeoutMs ?? 120000,
      maxBuffer: 16 * 1024 * 1024,
      signal,
    })
    stdout = result.stdout ?? ''
    stderr = result.stderr ?? ''
    exitCode = result.code ?? 0
  } catch (error) {
    if (error && typeof error.code === 'number') {
      exitCode = error.code
      stdout = error.stdout ?? ''
      stderr = error.stderr ?? ''
    } else {
      throw error
    }
  }
  const tail = String(stderr).trim().split(/\r?\n/).slice(-2).join(' ').slice(0, 300)
  return canonicalFromReceipt(parseReceipt(stdout), exitCode, tail)
}
