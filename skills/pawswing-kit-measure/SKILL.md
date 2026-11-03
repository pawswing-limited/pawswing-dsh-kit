---
name: pawswing-kit-measure
description: Use the PawSwing Kit CLI as the only interface for station inspection, instrument capture, artifact statistics/SVG plots, power measurement, and synchronized power-scope measurement.
---

# PawSwing Kit Measure

Use this skill whenever a task mentions PawSwing Kit, `kit`, a bench/station resource, oscilloscope or logic capture, camera/thermal capture, serial console access, Bluebird/BLU915 power, or synchronized voltage/current measurement.

## Operating rule

Complete the task through the `kit` CLI only. Do not inspect Kit source code, browse the handbook to rediscover parameters, write temporary orchestration scripts, or SSH around the adapter to operate an instrument. If the CLI cannot express a required operation, stop and report the CLI gap with the failing command and receipt; do not invent a bypass.

## Start every task this way

1. Run `kit --help` if the command surface is not already in context. Its tail contains the same new-machine/Agent install prompt as `kit prompt`.
2. Run `kit list`, then `kit info <KIT>`.
3. For any raw action, run `kit params <KIT> <ACTION>` and use its manifest-generated parameter specification/template. Never guess `--args` fields.
4. Check `kit lock status <KIT> --resource <RESOURCE>` before side-effecting work.
5. Use the actual operator/agent identity and current session identifier for `--person` and `--session`; never copy literal `P`/`S` placeholders from examples.

## Preferred finished workflows

- Analog waveform + statistics + optional SVG, with lease handling included:
  `kit measure analog <KIT> --resource scope-1 --channels 1 --range-mv 5000 --probe-factor 10 --plot-out scope.svg --person <PERSON> --session <SESSION>`
- Existing analog/power artifact statistics, with optional simultaneous SVG:
  `kit artifact stats <KIT> --resource <RESOURCE> --capture-request-id <ID> --kind analog|power --plot-out chart.svg --person <PERSON> --session <SESSION>`
- Existing artifact SVG only:
  `kit artifact plot <KIT> --resource <RESOURCE> --capture-request-id <ID> --kind analog|power --out chart.svg --person <PERSON> --session <SESSION>`
- Hash-verified artifact download:
  `kit artifact get <KIT> --resource <RESOURCE> --capture-request-id <ID> --artifact raw|metadata --out <FILE> --person <PERSON> --session <SESSION>`
- Bluebird power capture + current statistics + optional SVG:
  `kit measure power <KIT> --resource pwr-1 --plan <OPERATOR_PLAN> --mode off --plot-out power.svg --person <PERSON> --session <SESSION>`
- Same-session powered current capture overlapped with a scope capture:
  `kit measure power-scope <KIT> --plan <OPERATOR_PLAN> --confirm-token I_UNDERSTAND_DUT_WILL_BE_POWERED --resistance-ohm <OHMS> --setpoint-mv <MV> --probe-factor 10 --plot-power-out power.svg --plot-scope-out scope.svg --person <PERSON> --session <SESSION>`

Use `--baseline-request-id` for analog terminal-voltage correction only when the baseline capture used the same single channel, wiring, probe, and range.

## Safety and recovery

- A receipt, exit code 5, or `outcome_unknown` is never a success and never a retry signal. Preserve every request and lease ID from `raw.steps`.
- On unknown: stop; run `kit log <KIT> --request <ORIGINAL_REQUEST_ID> --limit 100` and `kit lock status <KIT> --resource <RESOURCE>`. Do not free or recover a lease until idleness and safety are independently verified.
- `measure` intentionally retains leases on unknown. On known success or known failure it releases them; always report the final live `lock status`, not merely the workflow receipt.
- Power plans are operator-preset names only. Never invent a plan, voltage, wiring state, resistance, or confirmation. `mode=off` must not carry a confirmation token; `on`/`never_cut` require the exact token and confirmed physical setup.
- BLU915 metadata reads can turn output off. Before `never_cut`, ensure calibration modifiers were seeded while the DUT was unpowered; never perform a live metadata-read workflow while output must remain on.
- Treat setpoint readback, scope readings, and BLU current readings as distinct observations. Do not call a setting a terminal measurement, and state uncalibrated/coarse-resolution limits when reporting accuracy.

## Reporting

Report the kit/resource, each capture request ID, statistics or derived comparison, artifact byte counts/SHA-256, SVG paths when generated, and fresh final lease state. Separate observed facts from inferences and name any unverified accuracy boundary.
