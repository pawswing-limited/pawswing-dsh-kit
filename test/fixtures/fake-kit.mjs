#!/usr/bin/env node
// Fake kit binary for tests: emits one pawswing.kit.v1 JSON line
// whose shape depends on argv. FAKE_KIT_MODE selects the scenario.
const argv = process.argv.slice(2)
const mode = process.env.FAKE_KIT_MODE || 'ok'
const joined = argv.join(' ')

function emit(obj, code = 0) {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
  process.exit(code)
}

const base = { schema: 'pawswing.kit.v1', request_id: 'fake-req-1', kit: 'kit000', lease_id: null, raw_exit: 0, transport_exit: 0 }

if (mode === 'unknown') {
  emit({ ...base, ok: false, execution_state: 'outcome_unknown', raw: { error: 'timeout' } }, 5)
}
if (mode === 'noreceipt') {
  process.stderr.write('boom\n')
  process.exit(3)
}
if (joined.includes(' list')) {
  emit({ ...base, ok: true, execution_state: 'succeeded', raw: { argv } })
}
emit({ ...base, ok: true, execution_state: 'succeeded', raw: { argv } })
