# pawswing-dsh-kit

把 PawSwing Kit 带进 dsh（DeepSeek Harness）的插件与席位预装件。

每个 PawSwing 用户席位都有一台专用云主机。`kit` CLI 预装在其中，
智能体先用它完成工位发现、租约、测量与产物回取；本仓再把 Kit
封装成 dsh 的原生类型化工具，并为后续的实时仪器画面预留面。

## 组成

| 路径 | 作用 |
|---|---|
| `src/` | Cordis 插件：kit-client（拼命令/解回执）、工具集、SSH 绕行门禁 |
| `skills/` | `pawswing-kit` 与 `pawswing-kit-measure` 技能（布到席位 `.agents/skills/` 即可被扫描） |
| `scripts/install-seat.sh` | 把技能布到目标工作区并自检 kit 二进制与 catalog |
| `examples/` | catalog 模板与 profile 挂载片段 |
| `docs/PLAN.md` | 分层计划、打包决定与施工顺序（计划真源） |
| `test/` | 以假 kit 夹具驱动的 `node:test` 套件 |

## 快速开始（席位内）

```sh
./scripts/install-seat.sh /path/to/seat-workspace
kit --version
kit list
```

板端授权新席位走指纹对读流程（专用 Ed25519 → 板端 forced-command
条目 → 回读指纹 → 只读三条首验），见 pawswing-kit 手册第 10.9 节。

## 工具面（L1 当前）

只读：`kit_list`、`kit_info`、`kit_lock_status`、`kit_params`、
`kit_log`、`kit_artifact_stats`；成品：`kit_measure_analog`、
`kit_measure_thermal`、`kit_measure_power`（仅 `off`）。
未知结果（退出 5）按原回执透传，永不报成成功。

## 安全语义

本插件不持有任何绕过 Kit 适配器的板端通道；工位 SSH 的
forced-command 钥匙就是唯一入口。不把回执里的设定值说成
端子实测；电源写入面在人工确认卡（计划 L3）就绪前保持关闭。
