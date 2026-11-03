// Pre-execute guard: refuse shell commands that try to reach a kit
// station over raw SSH, which would bypass the adapter's lease and
// audit discipline. Kit traffic must go through the kit_* tools
// (forced-command key), never an interactive board shell.

const SHELL_TOOL_NAMES = new Set(['bash', 'shell', 'sh', 'run_command', 'terminal'])

export function findStationSshBypass(toolName, args, stationHosts) {
  if (!SHELL_TOOL_NAMES.has(toolName)) return null
  const text = typeof args === 'string' ? args : JSON.stringify(args ?? {})
  if (!/\bssh\b/.test(text)) return null
  for (const host of stationHosts ?? []) {
    if (host && text.includes(host)) return host
  }
  return null
}

export function registerSshBypassGuard(ctx, config) {
  if (!config.guardSshBypass) return
  ctx.on('tools/pre-execute', async (exec, next) => {
    const host = findStationSshBypass(exec?.name, exec?.arguments, config.stationHosts)
    if (host) {
      return {
        kind: 'deny',
        reason: `Refused: raw SSH to kit station ${host} bypasses the kit adapter (leases/audit). Use the kit_* tools instead.`,
      }
    }
    return next()
  })
}
