---
name: pawswing-kit
version: 1.0.0
description: "仪器 kit 操作命令行 kit：list/info/ui/log/do/lock 经 SSH 调资源侧适配器，单行 JSON 回执。先读 kit --help。持租约才能动作，unknown 绝不报成功。当用户要看 kit 目录、查占用租约、上报动作或读审计日志时使用。"
metadata:
  requires:
    bins: ["kit"]
  cliHelp: "kit --help"
---

# kit (v1)

先读：`kit --help`（命令与 flag 全量清单，不连网）；静态目录示例
`catalog.example.json`；用法与保证见仓 `/home/owner/Work/pawswing/pawswing-kit/kit-cli/README.md`。
安装：席位云主机预装 GitHub Release 的预编译客户端包（验
`SHA256SUMS` 后放到 `~/.local/bin/kit`；客户端只装操作员机，
不装工位板）。连通走公司 Headscale：`ssh_target` 写工位的
MagicDNS 名（如 `user@kit000.ts.pawswing.app`），`identity_file`
只写本席位专用钥匙路径，密钥内容永不进配置。
无参退出 2（用法走 stderr）；`--help`/`--version` 退出 0 且不读目录、不启动 SSH。

## 命令地图

```bash
kit --config catalog.json list
kit --config catalog.json info KIT                    # 能力与结构化参数清单（do 前先看）
kit --config catalog.json ui KIT                      # 回 URL 或 none，不自动打开/登录
kit --config catalog.json log KIT [--since T --limit N --cursor C]   # 有界审计页
kit --config catalog.json log KIT --request REQUEST   # 按请求编号查已落回执
kit --config catalog.json lock status KIT --resource R
kit --config catalog.json lock take KIT --resource R --ttl-secs 60 --person P [--session S --reason T]
kit --config catalog.json do KIT ACTION --resource R --lease-id L --args '{}' [--person P --session S]
kit --config catalog.json lock renew KIT --resource R --lease-id L
kit --config catalog.json lock free KIT --resource R --lease-id L
# 维护者确认已停止且安全后，用维护钥匙对应目录执行：
kit --config maintainer.json lock recover KIT --resource R --lease-id CURRENT --active-request-id REQ --reason '...' --confirm-safe
```

全局 flag：`--config`（默认 `~/.config/kit/catalog.json`）、`--timeout-secs`（1..300，
默认 15；超时不保证远端被杀）、`--request-id`（显式固定用于查询/去重，不是失败重试开关；
同 request_id + 同输入取缓存回执，不同输入/主体拒绝）。
标识符只许 `[A-Za-z0-9._-]` 且 ≤128 字符；`--args` 必须是 JSON 对象，不接受任意 shell。

## 回执与退出码契约

- 正常业务命令 stdout 只有一行 `pawswing.kit.v1` JSON
  （`request_id`/`kit`/`resource`/`lease_id`/`ok`/`execution_state`/`raw`/`raw_exit`/`transport_exit`），诊断不混入 stdout。
- `execution_state`：`succeeded`/`failed`/`refused`/`invalid_request`/`internal_error`/`connection_failed`/`outcome_unknown`。
- 退出码：0 确认成功；1 业务拒绝/底层失败；2 参数/协议；3 内部错误；
  4 确认未执行的连接失败（只读路径）；5 结果未知（已发出副作用的请求才用）。
- `raw.ok=false` 即使底层进程退出 0 也不能报成功（实现会强制 `ok=false` 并改写状态）。

## 租约纪律与 unknown 不假报

- `lock`/`do` 必须带 `--resource`；`renew`/`free`/`recover` 必须带**当前** `--lease-id`；
  旧 lease 影响不了新 lease；`renew`/`release` 不再按 person/session 续放。
- `do` 发之前先拉 `info` 拿能力清单做本地校验（action/resource 不在清单里直接退出 2，
  动作不发出）；资源侧的租约检查仍是最终权威。
- `recover` 只能由安装时认证为 `human-*` 的维护者发起，且适配器必须先停；
  原动作结果仍记 unknown，这只是维护者确认。
- SSH 超时/断线/坏回执：不自动重试拿锁或动作；`log --request` 查已落回执。
- 缺日志返回错误，绝不返回"没有操作"；`outcome_unknown`（退出 5）绝不能当成功汇报，
  必须先用 `log --request` 确认到已落回执再下结论。
