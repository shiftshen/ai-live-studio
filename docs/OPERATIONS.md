# 本机运维与交接

根目录 `/Volumes/M2USB/Projects/ai-live-studio`。默认只服务本机 `127.0.0.1:8890`。不应把管理服务直接暴露到公网。

## 安装、启动与停止

```sh
cd /Volumes/M2USB/Projects/ai-live-studio
npm ci
npm run check
npm test
npm run build
npm run up
npm run doctor
```

打开 [工作台](http://127.0.0.1:8890)，确认登录、状态刷新及所需房间状态。`npm run dev` 与 `npm start` 是前台服务；不要和后台实例同时运行。`npm run down` 发送 SIGTERM，等待旧实例退出后再 `npm run up`。程序会等待活跃 Worker 通道结束、断开连接并关闭数据库。

`PORT` 可以修改监听端口，`STUDIO_DATA_DIR` 可以修改数据目录；当前 `service.mjs` 的 PID/日志和运维脚本仍使用默认 `/Volumes/M2USB/Projects/ai-live-studio/var`，若改目录或端口，需同步调整调用方，不能认为 doctor/soak 会自动跟随。

| 路径                                                           | 用途                                       |
| -------------------------------------------------------------- | ------------------------------------------ |
| `/Volumes/M2USB/Projects/ai-live-studio/var/server.log`        | 后台 stdout/stderr                         |
| `/Volumes/M2USB/Projects/ai-live-studio/var/server.pid`        | 启动器记录的 PID                           |
| `/Volumes/M2USB/Projects/ai-live-studio/var/instance.lock`     | 同数据目录实例锁                           |
| `/Volumes/M2USB/Projects/ai-live-studio/var/studio.sqlite3`    | 主数据库；运行时伴随 WAL/SHM               |
| `/Volumes/M2USB/Projects/ai-live-studio/var/admin-token`       | 管理员登录凭据，文件权限0600               |
| `/Volumes/M2USB/Projects/ai-live-studio/var/relay-token`       | 抖音转发凭据，文件权限0600                 |
| `/Volumes/M2USB/Projects/ai-live-studio/var/secrets/feie.json` | 飞鹅设备凭据，文件权限0600；不是加密保险箱 |
| `/Volumes/M2USB/Projects/ai-live-studio/var/media`             | WAV、头像、回退语音                        |
| `/Volumes/M2USB/Projects/ai-live-studio/var/backups`           | 应用生成的 SQLite 备份                     |
| `/Volumes/M2USB/Projects/ai-live-studio/var/evidence`          | 测试与验收报告，不是生产数据库备份         |

不输出 token、完整设备凭据或认证 URL 到日志、截图和交接。外部凭据入口只记录 `/Users/shift/.openclaw/secrets` 与 `/Users/shift/.codex/skills/openclaw-secrets/SKILL.md`；不会自动从这些路径导入任何钥匙。

## 角色与权限

| 操作                                               | 管理员 | 操作员     | 观察员   |
| -------------------------------------------------- | ------ | ---------- | -------- |
| 查看数据、下载授权房间媒体/CSV                     | 全部   | 指定房间   | 指定房间 |
| 编辑现有房间、连接、规则、模拟、屏蔽、安全任务操作 | 可以   | 仅指定房间 | 不可以   |
| 新建房间、重绑打印机、设备管理、实体补打           | 可以   | 不可以     | 不可以   |
| 共享模板编辑、全局配置、备份恢复、发放账号         | 可以   | 不可以     | 不可以   |
| 获取 relay 配置、完整房间展示 token                | 可以   | 不可以     | 不可以   |

登录会话为 HttpOnly、SameSite=Strict，12小时到期；注销会删除服务端会话。访问 token 在 API 数据表中以哈希标识，打印秘密不进入普通状态响应。授权接口目前提供新增与查看，没有图形化令牌撤销接口；不要假设删浏览器 Cookie 能撤销其他人的 Bearer token。

同源检查拒绝不匹配 Origin。只有 `/api/v1/relay/` 可接受 Dycast 的 `tauri://localhost`、`http://tauri.localhost`、`https://live.douyin.com`；仍须有效转发 token，不能用这个 Origin 绕过其他管理接口。

## 平台连接

**TikTok**：房间地址填写用户名或 `https://www.tiktok.com/@用户名/live`。连接选项禁用初始化历史处理与认证 WebSocket；可选环境变量 `EULER_API_KEY` 提供签名服务凭据，未配置时不保证所有直播间都可连接。失败查看房间 error；已建立连接断开后最多三次退避重连。能力标记 `observed` 只表示该类事件实际到达过，不表示整个平台所有能力已经验收。

**抖音**：管理员建立数字房间并点击连接，出现 `waiting_relay` 表示等待外部转发。获取该房间 relay 配置，将 URL 设置到 Dycast 1.4.1 的 WebSocket 转发目标；URL 含秘密，不截图。Dycast 先发送与配置一致的房间编号，再发消息数组。一个房间只接受一条转发连接。Dycast 自身“已连接”不代表工作台收到事件，需同时核对事件列表与能力标记。

若网络连续失败，比较宿主 VPN、系统/进程代理与本地可达情况；不要仅增加重试，也不要把浏览器成功当作 Node 请求成功。平台或第三方签名服务变更可能需要重新验证 adapter。应用不导入平台登录 Cookie，也不主动购买签名或发送礼物。

## 规则与设备

规则可以通过预览看到命中原因；预览不落事件。模拟/回放可用于重现，但普通打印保持 dry_run。设备测试按钮会真实发送一张，安装级 `testPages` 最多十张；恢复旧备份不会回退该计数。仅开启 `imageSupported` 不会让未验证硬件自动获得头像打印能力。

队列显示 `accepted` 时等供应商回执；`unknown` 必须先核对设备记录。API 禁止对 sending/accepted/completed/unknown/dry_run 打印做普通 retry。管理员“补打”创建新的 live 打印任务，保留 parentId；这是再次实体发送，不应以刷新按钮代替。全局暂停阻止新调度与展示 ACK，但不能撤回供应商已受理的打印。

本地 AI 配置限制到 `http://127.0.0.1:11434` 或 `http://localhost:11434`。语音调用 `/Users/shift/openclaw/scripts/omnivoice_local_tts.py`，正常生成限时15秒，可使用预生成语言回退文件；检查原文、实际语言和声音后再给通过结论。

OBS 使用工作台生成的房间展示 URL 添加“浏览器”来源；页面通过本机媒体 URL 播放，语音结束事件才 ACK。查看 ready 任务时先确认浏览器源存在、音频播放已启动、OBS 混音器及监听设备正确。HTTP200、WAV存在、浏览器 ACK 都不能单独证明观众听见。

## 备份与恢复

备份按钮调用 SQLite 原生在线 backup，返回名称，文件存到 `/Volumes/M2USB/Projects/ai-live-studio/var/backups`。这是数据库备份，**不包含** `/Volumes/M2USB/Projects/ai-live-studio/var/secrets`、管理员/转发 token、媒体和外部语音模型。整机迁移需分别安全保存这些目录，且数据库本身包含会话数据，应按敏感文件管理。

恢复流程：

1. 在系统页暂停动作，断开全部直播间；确保当前 Worker 已不忙。
2. 选择已有备份名称发起恢复。API 校验文件命名、完整性和迁移表，生成 `/Volumes/M2USB/Projects/ai-live-studio/var/restore-pending.sqlite3`。
3. 待恢复数据库强制 paused；非终结旧打印设为 unknown，其他旧动作取消；移除登录会话，保留当前更高测试页计数与备份之后审计。
4. API 返回 `restartRequired: true`，此时运行实例仍使用当前库。停止旧实例，再启动；启动程序切换待恢复库。
5. 重新登录，确认仍暂停、旧任务未自动发送、设备凭据可用、房间配置正确；再按需要重新连接和启用动作。

启动时会保留 `before-restore-时间戳.sqlite3`。该文件来自原数据库主文件复制，不应视为独立在线 WAL 一致性备份；恢复前另外执行应用 backup 才有明确的 SQLite 一致性快照。不要运行中只复制主库或手工删除 WAL。

## 保留、清理和巡检

维护周期60秒。事件与终结任务按配置清理，活跃任务的事件与媒体引用保留；accepted/unknown 打印引用也不会被媒体过期误删。审计保持追加，当前没有自动审计删除。清理不会回收所有去重、连击、冷却记录，应定期检查磁盘与数据库体积。

诊断项 `configured` 只代表配置或脚本存在。每次交接分别记录：服务访问、真实平台事件、真实礼物、打印供应商回执、纸面观察、音频文件、OBS 实听、运行时长。

```sh
cd /Volumes/M2USB/Projects/ai-live-studio
npm run doctor
npx tsx /Volumes/M2USB/Projects/ai-live-studio/scripts/load-test.ts 600
npx tsx /Volumes/M2USB/Projects/ai-live-studio/scripts/soak.ts 120
```

load-test 写独立测试数据库，模拟100条/秒、600秒，默认不匹配动作；不测平台网络或实体设备。soak 每分钟采样状态120分钟，`healthy` 只检查 HTTP 响应，双平台持续事件、无积压和音频/打印仍需额外核对。两者可花实际时长，不能把脚本启动当作通过。

## 2026-09-14 设备字体与实体测试保护

当前飞鹅设备应选择“多语言兼容（Thai）”字体通道，中文、泰语、英文文案都使用该设备通道发送。它不同于房间回复语言。Chinese通道实测出现中文/泰语乱码，不能按文案语言自动切换字体通道。选择“设备默认”会省略language参数；必须重新验证目标型号纸面。

系统“实体测试模式”默认开启：本机专用设备测试和真实直播打印合计最多10张，已用额度展示于设置页，保留在备份恢复保护中。不要清零testPages以重复测试。正式运营关闭测试模式会解除这项总额度，但仍保留每分钟速度和设备队列上限。

历史测试规则快照（已停用，不可按旧额度继续打印）：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/rules-before-bounded-live-test.json`。

补打需要理由且原任务必须结束（unknown、failed或completed）。设备可执行积压包含pending/sending/processing/accepted；held不自动派发，可在容量释放后人工逐个重试。补打与重试满额返回409，保留原任务。

## 公共直播间与开播资格

电脑采集器不依赖直播手机；连接他人的公开直播间可以观察公开互动，不代表获得主播后台收益、管理或账号权限。本次使用公开直播观察，没有发表评论、送礼物或替别人执行互动。公开礼物是否实际收到，单独看事件证据。

本次手机TikTok资格页显示至少50粉丝，当前9粉丝，没有申请入口；不得伪称已申请成功，也不购买粉丝。门槛可能因地区/账号变化，应以设备当前资格页为准。官方说明：[TikTok LIVE安全指南](https://www.tiktok.com/safety/en/live-safety-guide?sc_version=2024)。

抖音现已完成自己的账号9分7秒实际开播，并确认结束。公开房间采集不能替代自己的直播音画验收；详见本轮实播报告。

## OBS验收恢复

官方OBS32.2.2已放置于`/Volumes/M2USB/Projects/ai-live-studio/var/vendor/OBS.app`。首次本地浏览器源录制出现黑屏静音，软件渲染与基础HTML探针也未通过。后续已解锁并续测，OBS浏览器问题仍未解决；本轮使用官方Mac抖音直播伴侣采集原生展示窗口。

正常配置是本机工作台给出的房间展示URL、1920×1080或1080×1920、启用“通过OBS控制音频”。URL包含只读房间令牌，不写入公共截图/仓库。仅保留一个该房间的播放消费者，避免多个浏览器源重复播放同一任务。

历史诊断本机代理8891不是生产启动依赖；OBS需使用工作台生成的房间展示URL。[OBS浏览器源说明](https://obsproject.com/kb/browser-source)。

普通关注、评论、点赞的语音和画面超过2分钟不再自动播放，任务标为expired保留；礼物与打印不套用此规则。抖音转发握手只表示传输可用，收到真实新事件后才显示已连接，60秒无事件提示检查开播状态。

## 当前活动部署与实播（2026-09-14最终续测）

当前停播并全局暂停；打印机全部禁用，房间解绑打印机，新活动只有speech/overlay。禁止依据旧额度或旧规则重新打印。旧云队列已清空，未发送任务已取消。

安装活动预设会暂停全局、禁用全部设备、禁用各房间旧规则，再按平台安装7条中/泰规则，不自动恢复动作。它是整套活动替换，不是无副作用预览。需要部署到新的安装时执行：

```sh
cd /Volumes/M2USB/Projects/ai-live-studio
node --import tsx scripts/install-campaign.ts
node --import tsx scripts/export-campaign.ts
sh scripts/build-stage-app.sh
```

现有机器已安装，无需重复执行。改文案/规则使用工作台“模板/规则”页面；任务保存原版本，修改只影响新任务。展示页的奖励档位直接读取启用规则；静态JPG与HTML须另行更新，不自动随着运营编辑变化。

从Finder打开 /Volumes/M2USB/Projects/ai-live-studio/var/vendor/AI Live Stage.app，粘贴后台提供的本机房间展示地址。窗口为432×768，默认自动播放；若出现语音按钮需在开播前启用。只保留一个该房间播放器。

官方直播伴侣选择“窗口采集”，目标“AI Live Studio · 直播画面”，匹配竖屏画布；麦克风关闭，桌面音频启用。先本地录制并检查语音，没有通过不要推流。自己的房间地址必须填入工作台和Dycast，连接后观察真实事件再判断采集成功。场次结束关播、暂停工作台、断开采集。

手机查看观众画面使用静音投影，构建入口 /Volumes/M2USB/Projects/ai-live-studio/scripts/build-phone-app.sh；依赖已安装scrcpy/adb，不自动安装或请求新权限。关闭不需要的OBS、旧浏览器播放器及重复投影，避免混音和资源浪费。自播结束后，不为补证据再次自动开播。
