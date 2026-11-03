// Tool definitions for the PawSwing Kit plugin. The factory takes
// defineTool and a bound runKit so tests can inject fakes; the
// Cordis glue in index.js supplies the real ones.

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    ok: { type: 'boolean' },
    execution_state: { type: 'string' },
    request_id: { type: ['string', 'null'] },
    summary: { type: 'string' },
    receipt: { type: ['object', 'null'], additionalProperties: true },
  },
}

function receiptTool(defineTool, run, spec) {
  return defineTool({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
    output: {
      schema: RECEIPT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: `${value.summary}\n${JSON.stringify(value.receipt)}` }],
      presentationMeta: (_args, value) => ({
        ok: value.ok,
        execution_state: value.execution_state,
        request_id: value.request_id,
        summary: value.summary,
      }),
    },
    async execute(args, exec) {
      return run(spec.command, args, exec?.signal)
    },
  })
}

const KIT_PARAM = { type: 'string', description: 'Kit/station id from the catalog; omit to use the configured defaultKit' }
const PERSON = { type: 'string', description: 'Operator/agent name recorded on kit leases' }
const SESSION = { type: 'string', description: 'Current agent session identifier recorded on kit leases' }

export function kitTools(defineTool, run) {
  return [
    receiptTool(defineTool, run, {
      name: 'kit_list',
      command: 'list',
      description: 'List registered PawSwing kits and per-resource lease states. Read-only; run first.',
      parameters: {},
    }),
    receiptTool(defineTool, run, {
      name: 'kit_info',
      command: 'info',
      description: 'Read one kit live capability manifest (resources, actions, parameters). Always check this before choosing actions.',
      parameters: { kit: KIT_PARAM },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_lock_status',
      command: 'lock_status',
      description: 'Read the lease state of one resource (free/held/unknown). Unknown is never a retry signal.',
      parameters: {
        kit: KIT_PARAM,
        resource: { type: 'string', required: true, description: 'Resource id such as scope-1, dps-1, thm-1' },
      },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_params',
      command: 'params',
      description: 'Generate the manifest-driven parameter spec and args template for one action without executing it.',
      parameters: {
        kit: KIT_PARAM,
        action: { type: 'string', required: true, description: 'Action id such as capture.analog or probe.supply' },
        resource: { type: 'string', description: 'Optional resource to pin the template to' },
      },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_log',
      command: 'log',
      description: 'Read bounded audit entries, optionally for one original request id. Use after any unknown outcome.',
      parameters: {
        kit: KIT_PARAM,
        request_id: { type: 'string', description: 'Original request id to look up' },
        limit: { type: 'number', description: 'Max entries (default 50)' },
      },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_measure_analog',
      command: 'measure_analog',
      description: 'Finished analog scope capture plus statistics. Handles its own lease; on unknown it retains the lease and reports request ids.',
      parameters: {
        kit: KIT_PARAM,
        resource: { type: 'string', description: 'Scope resource id (default scope-1)' },
        channels: { type: 'array', items: { type: 'number' }, description: 'Channel numbers, default [1]' },
        range_mv: { type: 'number', description: 'Symmetric range in mV (default 5000)' },
        probe_factor: { type: 'number', description: 'Caller-declared probe attenuation (default 10); SDK does not read it back' },
        trigger: { type: 'string', description: 'edge (default) or none for DC levels without an edge' },
        person: PERSON,
        session: SESSION,
      },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_measure_thermal',
      command: 'measure_thermal',
      description: 'Finished thermal still capture. Frames are pseudo-color images, not radiometric temperature.',
      parameters: {
        kit: KIT_PARAM,
        resource: { type: 'string', description: 'Thermal resource id (default thm-1)' },
        timeout_ms: { type: 'number', description: 'Capture timeout in ms (default 20000)' },
        out: { type: 'string', description: 'Optional local output path for the frame' },
        person: PERSON,
        session: SESSION,
      },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_measure_power',
      command: 'measure_power',
      description: 'Bluebird power capture with output forced off (mode=off only in this plugin version). Plan names are operator-preset only.',
      parameters: {
        kit: KIT_PARAM,
        resource: { type: 'string', description: 'Power analyzer resource id (default pwr-1)' },
        plan: { type: 'string', required: true, description: 'Operator-preset plan name from kit_params available_plans' },
        mode: { type: 'string', required: true, description: 'Must be off in this version' },
        person: PERSON,
        session: SESSION,
      },
    }),
    receiptTool(defineTool, run, {
      name: 'kit_artifact_stats',
      command: 'artifact_stats',
      description: 'Statistics for an existing analog or power capture artifact.',
      parameters: {
        kit: KIT_PARAM,
        resource: { type: 'string', required: true },
        capture_request_id: { type: 'string', required: true },
        kind: { type: 'string', required: true, description: 'analog or power' },
        person: PERSON,
        session: SESSION,
      },
    }),
  ]
}
