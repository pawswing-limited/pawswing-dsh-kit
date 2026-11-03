# pawswing-dsh-kit 计划

状态：v0 已开工（2026-11-03）。本文件是本仓的计划真源；
Kit 本体契约以 pawswing-kit 仓与当次 `kit info` 为准。

## 目标

让 PawSwing 的智能体在 dsh（DeepSeek Harness）里把 PawSwing Kit
用成一等公民：每个用户席位自带一台专用云主机，`kit` CLI 在其中
预装，智能体经它发现工位、取租约、完成测量并回取产物。硬件侧
的租约、审计、未知围栏语义不变：网络与框架只提供可达性与好用的
手，不提供绕过适配器的路。

## 网络层：全面走公司 Headscale

所有席位与工位的连通只走公司 Headscale（控制面
`https://vpn.pawswing.app:18480`，MagicDNS `ts.pawswing.app`），
不依赖局域网同网段、不开公网入口：

- **工位**：已在网（kit000 为首台），统一标签 `tag:pawswing-kit`，
  节点名即工位名（`kit000.ts.pawswing.app`）。工位侧固定
  `--accept-dns=false --accept-routes=false`，避免扰动工位局域网
  与仪器直连链路；工位从不主动外连席位。
- **席位云主机**：每台独立注册为一个节点，建议新标签
  `tag:pawswing-seat`（所有者 `ops@`），节点名用席位标识。
  注册用按席位签发的 preauth key（文件交付，不进 argv/日志；
  一次一席、带过期），席位销毁时删节点。
- **ACL（提议，应用前按旧例备份+预审）**：席位只需 Kit 的
  SSH 通道，给最小面——`tag:pawswing-seat -> tag:pawswing-kit:22`
  （仅 tcp/22）；现有 `office-client`/`agent-workstation` 的
  全端口规则维持不变（那是运维通道，不是席位通道）。
  席位之间不互通、席位不作出口节点、不宣告子网路由。
- **寻址**：席位开 MagicDNS，catalog 的 `ssh_target` 统一写
  `user@<kit名>.ts.pawswing.app`；100.96.0.0/10 地址只作
  排障兜底。首连必须核工位 SSH 主机指纹（随席位交付单下发）。
- **授权分层不变**：tailnet 只给可达性。能不能动仪器仍由
  板端 forced-command 钥匙（`--key-id <seat>-kit`）+ 租约决定；
  席位被攻破的爆炸半径 = 到工位 22 端口 + 它那一把操作员钥，
  两处都能独立撤销（删节点、删板端条目）。
- **席位自检**：`install-seat.sh` 检查 `tailscale status` 在线、
  目标工位可解析且 22 可达，再验 kit 二进制与 catalog；
  不在线就停，不降级回局域网直连。

## 分层

### L0 预装（已交付基础）

- 每席位云主机预装与架构匹配的 kit 发布包（`~/.local/bin/kit`，
  验 SHA256SUMS），席位工作区的 `.agents/skills/` 放
  `pawswing-kit` 与 `pawswing-kit-measure` 两份技能
  （dsh 的 skill-filesystem 根目录直接扫描 `.agents/skills`）。
- `~/.config/kit/catalog.json` 指向目标工位，`identity_file`
  指向该席位专用的 forced-command 操作员钥匙（板端对应
  `--key-id <seat>-kit` 条目）。一把席位一钥，撤销即删条目。
- `scripts/install-seat.sh` 把技能布到目标工作区并检查 kit
  二进制与 catalog 的存在性；钥匙生成与板端授权仍走人工
  对读指纹流程（见 pawswing-kit 手册 10.9）。

### L1 原生工具插件（本轮 v0 落地只读集）

一个 Cordis 插件包（本仓），用 `defineTool` 注册类型化工具，
内部经 catalog 调 kit CLI（`--json` 单行回执），把回执规范化为
工具返回值：

- 只读集：`kit_list`、`kit_info`、`kit_lock_status`、`kit_params`、
  `kit_log`、`kit_artifact_stats`；
- 成品工作流：`kit_measure_analog`、`kit_measure_thermal`、
  `kit_measure_power`（v0 只放行 `mode=off`；上电类不在工具面
  暴露，等 L3 的人工确认卡）；
- 故意不提供通用 `kit_do`：参数探索走 `kit_params`，测量走成品
  命令，避免模型自由拼参数绕过纪律；
- 策略钩子（`tools/pre-execute`）：拦截 shell 类工具中形如直连
  工位 SSH 的命令（目标主机可配），把「不要绕过适配器」从技能
  文本变成框架级拒绝，并回一句该走哪个 kit 工具。

不变量：工具永不把 `outcome_unknown`/退出 5 渲染成成功；回执
原文整包透传给模型与持久化卡片；person/session 默认值来自插件
配置但可被单次调用覆盖，绝不写死虚构身份。

### L2 实时面（先准实时，后真流）

- 准实时（只用现有 kit 动作）：后台 job 按租约周期抓帧/抓波，
  经 Remote 流推送到会话：热成像/摄像头画面卡、示波器交互
  波形卡（吃产物统计规范值，支持缩放与游标）、逻辑时序卡、
  串口单发控制台卡。画面刷新率受有界采集约束，文档明示
  「准实时」不冒充直播。
- 真流（需要 kit 0.3 立项）：kit 侧新增「流会话」动作面
  （开流=持租约、心跳续租、关流=释放、超时自断），工位把
  RTSP/波形采样串成可订阅流；dsh 侧加一个 Kit Remote
  控制器承接流与租约状态看板。此层开工前在 pawswing-kit 仓
  先定流会话契约（帧格式、背压、未知围栏如何打断流）。

### L3 事件与确认

- kit 审计/租约变化注入会话通知（占用、未知围栏、到期）；
- 电源上电确认改为框架反馈卡：人点确认后服务端注入精确
  令牌，`on/never_cut` 才进工具面；
- 定时任务：热成像延时巡检、功耗浸泡与报告卡。

## 打包决定

- 独立仓、独立 npm 包（现名 `pawswing-dsh-kit`，v0 为纯 ESM
  JavaScript + node:test；TypeScript 化在工具面稳定后进行，
  因为上游 dsh 仍是开发者预览且破坏变更频繁）。
- `engines.dsh` 钉小范围，升级走显式验证，不跟随上游漂移。
- 上游 fork（pawswing-harness）保持干净镜像，不把业务代码
  写进 fork。席位经 `dsh plugin` 或本地路径安装本包。

## 施工顺序

1. L0：技能迁入 + `install-seat.sh` + 示例 catalog（本轮）。
2. L1：kit-client（命令行拼装/回执解析，假 kit 夹具测试）→
   只读工具集 → 成品工作流 → SSH 绕行门禁（本轮）。
3. 在测试席位 profile 挂载插件，真机跑只读发现与一次
   `probe.supply` 等价闭环（经 measure/params 只读路径），
   证据回填 pawswing-kit 仓。
4. L2 准实时卡片；kit 流会话契约在 pawswing-kit 仓立项。
5. L3 确认卡与事件通知。

## 非目标

- 不复刻旧 wb 的 machines/runs 台账；运行记录以 kit 审计为准。
- 不在本仓实现任何仪器协议；协议只住在 kit 板侧适配器。
- 不给智能体无限制 shell 到工位板的通道当后门。

## 待决

- 席位镜像的正册维护位置（当前部署在 .133 的 /data/pawswing，
  不在版本管理内）：配置应进仓（本仓的 `examples/` 只是起点）。
- npm 发布作用域（`@pawswing/*` 是否可用）与内网分发方式。
- 流会话的帧传输编码（MJPEG/WebRTC/原始分块）待 kit 0.3 契约。
