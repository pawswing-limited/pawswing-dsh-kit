// PawSwing Kit plugin for dsh: typed instrument-bench tools over
// the kit CLI. Network reachability comes from the company
// Headscale tailnet (catalog ssh_target); authorization stays with
// the station's forced-command key and leases.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { runKit, expandHome } from './kit-client.js'
import { kitTools } from './tools.js'
import { registerSshBypassGuard } from './guard.js'

export const name = 'pawswing-kit'
export const inject = ['tools']

export const Config = Schema.object({
  kitBin: Schema.string().default('kit').description('kit CLI binary path or name on PATH'),
  catalog: Schema.string().default('~/.config/kit/catalog.json').description('kit catalog JSON path'),
  defaultKit: Schema.string().default('kit000').description('Default kit id when a call omits kit'),
  person: Schema.string().default('').description('Default operator/agent name recorded on leases'),
  session: Schema.string().default('').description('Default agent session id recorded on leases'),
  timeoutMs: Schema.number().default(120000).description('Per-call kit subprocess timeout in ms'),
  guardSshBypass: Schema.boolean().default(true).description('Deny shell commands that ssh directly to a kit station'),
  stationHosts: Schema.array(Schema.string()).default([]).description('Station hostnames/IPs the SSH bypass guard watches'),
})

const execFileAsync = promisify(execFile)

async function defaultExecFile(file, argv, options) {
  try {
    const { stdout, stderr } = await execFileAsync(file, argv, { ...options, encoding: 'utf8' })
    return { stdout, stderr }
  } catch (error) {
    // Normalize non-zero exits into the same shape kit-client expects:
    // numeric code plus captured streams (receipt parsing decides).
    if (error && typeof error.code === 'number') {
      return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', code: error.code }
    }
    throw error
  }
}

export function apply(ctx, config) {
  const effective = {
    kitBin: expandHome(config.kitBin || 'kit'),
    catalog: config.catalog || '~/.config/kit/catalog.json',
    defaultKit: config.defaultKit || 'kit000',
    person: config.person || '',
    session: config.session || '',
    timeoutMs: config.timeoutMs ?? 120000,
    guardSshBypass: config.guardSshBypass !== false,
    stationHosts: config.stationHosts ?? [],
  }
  const run = (command, args, signal) => runKit(defaultExecFile, effective, command, args, signal)
  for (const tool of kitTools(defineTool, run)) ctx.tools.register(tool)
  registerSshBypassGuard(ctx, effective)
}
