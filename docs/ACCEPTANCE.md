# 验收记录

记录日期：2026-09-14。项目：`/Volumes/M2USB/Projects/ai-live-studio`。当前为可运行的本机工作台，**尚未全部通过现场验收**。持续报告未完成时，不能以预计终点或页面打开替代结果。

## 软件验证

- 自动测试50/50通过，覆盖权限、房间隔离、备份恢复、去重、累计礼物、历史事件、模拟隔离、未知打印、字体通道和并发打印额度。
- Dycast固定版本补丁：15项行为、3项接线、6项真实protobuf编解码断言通过；TypeScript、Vue及Rust发布构建通过。
- 前后端类型检查、前端生产构建通过。
- 本次修复真实联调发现的配置问题：Zod4 partial字段默认值会清空PATCH未提交的直播地址；现在仅修改显式提交字段，普通改名/绑定打印机保持原地址、语言和场次。
- 补打只允许真实打印的unknown/failed/completed状态，必须保存原因；未结束任务409。补打和重试事务检查设备可执行队列容量，满额409；held可在空位出现后逐个释放。已受理任务也占设备积压额度。
- 安装级实体测试模式默认开启，设备测试和真实直播打印共享10张额度，事务预留、重启不清零、补打重新计数；纸张计数不能以请求返回失败随意退回。

现场服务当前运行了字体及PATCH修复；其后的队列重试补强源码通过自动测试，部署会造成连接中断，需与长时观察结果分别记录。

## 实际设备与采集

| 项目         | 已核验证据                                                                       | 尚未证明                                     |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------- |
| 手机         | Android HONOR BVL-N49已连接，手机相机实际看到飞鹅打印机和纸面                    | 锁屏之后不能继续操作手机画面                 |
| 飞鹅         | 指定DAMO设备状态在线，5次实体测试有云端completed回执                             | completed不等于每个字都人工核对通过          |
| 文字出纸     | 相机看到泰语、英文纸面和长拉丁昵称换行；第5张采用Thai字体通道显示可读中文、泰语  | 最终版本自动字体通道的新一轮纸面复核尚未执行 |
| 字体失败保留 | 第4张Chinese字体通道使中文/泰语乱码；第5张Thai通道改善                           | 不能把第4张云端completed计为编码通过         |
| 实体头像     | 当前普通小票设备未证明支持动态图片；维持文字打印与屏幕头像                       | 实体头像未通过，不用二维码或固定LOGO替代     |
| 抖音         | 已启动修订Dycast1.4.1，认证转发收到真实评论/进场/点赞/关注；真实数字用户ID已保留 | 未出现可验收真实礼物及连送结束               |
| TikTok       | 无主播登录Cookie接入公开直播间，实际收到评论/进场/点赞/关注                      | 已收到真实礼物，但发现连送字段缺陷，未通过去重 |
| OBS          | 已安装官方32.2.2，启用浏览器独立音频，进行了本地录制                             | 当前录制黑屏静音；基础HTML探针也异常，未通过 |
| 语音         | 本地生成与普通浏览器播放ACK曾通过                                                | ACK/WAV不能替代OBS可听验收                   |
| AI           | qwen3.8:27b曾3次超过8秒而回退；备选granite4.1:3b三语短句410/544/260ms            | 延时和脚本匹配不等于语言表达质量完整通过     |

手机曾显示抖音开播准备页，但没有启动公开直播，实际公开开播时长0分钟。TikTok当前账户9粉丝，设备资格页明确要求至少50粉丝且无申请提交入口，只提供练习模式；没有伪造申请或年龄资料。

采集器独立运行于电脑，接收公开互动不依赖直播手机。公开礼物广播和主播收益/控制权限是不同接口；本次未以模拟礼物冒充真实收到礼物。

## 本机证据

这些证据包含本机设备/直播数据，保存在被Git忽略的目录，未上传GitHub。

- 设备预检：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/device-preflight-20260914.json`
- 字体失败：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/physical-camera-test04.json`
- 字体改善：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/physical-camera-test05.json`
- 相机图：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/printer-camera-test05.png`
- 当前事件及打印回执快照：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/current-verification-snapshot.json`
- TikTok实际资格页：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/tiktok-live-eligibility.png`
- 两平台头像下载/224×224转换：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/avatar-check.json`；仅图片处理，不是出纸。
- 真实事件持续采样：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/acceptance-corrected/report.json`

## 持续与负载

当前持续采样起点06:30:45 UTC、预计终点08:30:45 UTC。完整起止、实际事件增量、PID、内存及队列见报告。早期运行包含重启及PATCH清空房间地址故障，保留失败记录，不包装成通过。

既有600秒/60000条普通评论测试入库60000，jobs=0，最大百条135ms，只证明普通模拟入库。新增`/Volumes/M2USB/Projects/ai-live-studio/scripts/load-http.ts`在独立库使用真实HTTP认证和SQLite事务，20%评论命中规则且并发读取状态；Worker关闭，不能证明供应商或OBS吞吐。结果在独立http-load目录生成，完成前不得宣称通过。

## 尚未通过

真实礼物→唯一任务→实体纸面闭环；真实礼物连送最终数量；实体头像；OBS实际可听音画；两小时稳定运行；最终代码重启部署后的设备复核。

Mac锁屏阻止后续CUA手机/OBS操作。没有尝试绕过锁屏。开发、接口测试和后台采集仍可继续。解除锁屏后应继续未通过项目，而不是重复已消耗的实体额度。

## 自查

- 串账/租户越界：按房间、场次及平台隔离，访问/聚合/导出先隔离后分页；测试通过。
- 幂等：事件去重墓碑、连送最大累计数量、每动作唯一ID、未知打印禁止盲重试；测试通过。
- 越权：管理员设备绑定及补打、操作员房间范围、只读角色、OBS/接入/管理令牌分离；测试通过。
- 契约漂移：修复TikTok正文content和Dycast真实ID/groupId；缺失字段继续标记不可靠，不猜数据。
- 密钥：凭据与原始证据仅在var；交付前扫描源码及历史，不提交真实令牌、序列号或打印密钥。

## GitHub交付

源码已推送公开仓库[shiftshen/ai-live-studio](https://github.com/shiftshen/ai-live-studio)，默认分支main。50/50本地测试、类型检查通过。首次[GitHub检查](https://github.com/shiftshen/ai-live-studio/actions/runs/34814961125)未执行任何测试步骤：GitHub报告账户支付失败或消费额度限制。没有修改账单或购买额度，不能把这次未启动说成云端通过，也不能归因于代码测试失败。

后台持续验收结束后将自动回查报告、更新文档并再次推送。原始纸面、设备秘密和直播数据不上传。后续现场恢复说明见`/Volumes/M2USB/Projects/ai-live-studio/docs/NEXT-SESSION.md`。

## HTTP负载最终结果

2026-09-14 06:42:01.553—06:52:01.559 UTC，实际600.006秒：请求60000、接收60000、入库60000、生成任务36000，错误0；并发读取状态600次，最慢827ms，百条批次P95 370ms、最大840ms，未落后目标节奏。报告passed=true。

证据：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/http-load-1789368121458/result.json`。这是独立模拟HTTP和规则入队性能，Worker关闭，不代表真实直播、AI/语音供应商或实体输出性能。

## 本次改动文件

- `/Volumes/M2USB/Projects/ai-live-studio/README.md`
- `/Volumes/M2USB/Projects/ai-live-studio/docs/ACCEPTANCE.md`
- `/Volumes/M2USB/Projects/ai-live-studio/docs/NEXT-SESSION.md`
- `/Volumes/M2USB/Projects/ai-live-studio/docs/OPERATIONS.md`
- `/Volumes/M2USB/Projects/ai-live-studio/docs/TEST-RUN-20260914.md`
- `/Volumes/M2USB/Projects/ai-live-studio/docs/THIRD-PARTY.md`
- `/Volumes/M2USB/Projects/ai-live-studio/docs/task-cards/2026-09-14-completion.md`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/LICENSE`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/NOTICE`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/README.md`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/build-config.json`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/build-report.json`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/build.sh`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/public-fields.patch`
- `/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/test-public-fields.mjs`
- `/Volumes/M2USB/Projects/ai-live-studio/scripts/acceptance-soak.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/scripts/import-damo.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/scripts/load-http.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/client/App.vue`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/adapters.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/app.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/engine.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/providers.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/routes/data.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/routes/devices.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/routes/management.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/store.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/server/worker.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/src/shared/types.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/tests/acceptance-soak.test.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/tests/core.test.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/tests/final-regression.test.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/tests/printer-config.test.ts`
- `/Volumes/M2USB/Projects/ai-live-studio/tests/worker.test.ts`

## 双平台30分钟采集通过

2026-09-14 06:30:45.234—07:00:46.638 UTC，1801.404秒，31个采样点。`dualPlatform30min.completed=true`、`passed=true`，重启0、失败项0；每个后续一分钟间隔两平台均有非历史live事件。

- 抖音：评论175、关注36、进场1014、点赞657，共1882条。
- TikTok：评论37、关注39、进场1248、点赞43，共1367条。
- 合计3249条。未出现真实礼物；实体打印仍为5张，没有用模拟事件替代礼物验收。

证据：`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/acceptance-corrected/30min-final.json`。这是采样连续性门槛，不能证明采样点之间绝无短暂中断，也不替代真实礼物、纸面、OBS或完整两小时验收。两小时观察仍在运行，未重启部署后续代码。

## 真实礼物触发与字段缺陷（07:50 UTC复核）

TikTok公开房间07:16:21—07:18:37收到6条live礼物消息，分属3个分组；5个任务获得各自飞鹅订单完成回执，第6个因全局10张测试额度用尽被拦截并保留。无主播登录Cookie、无本机发送礼物。当前累计额度10/10，不再追加实体测试。

**该结果证明公开礼物可接收和触发云端打印，不证明礼物去重、最终数量或纸面成功。** 核查发现连接器2.4.4实际使用v3 protobuf的gift.type/name及数字repeatEnd，旧适配器读取v2 giftDetails并只接受布尔结束值；同组开始/结束疑似分别触发，原始记录不得改写。源码已修正字段映射，新增真实protobuf编解码进入规则引擎的回归：开始、结束、不同消息ID的重复结束只形成一组动作。50/50自动测试、类型检查、构建通过，尚未重启部署或完成修复后的真实礼物复验。

私有本机证据：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/live-print-audit.json；公众报告仅含汇总，不含观众身份及订单编号。抖音真实礼物仍未收到，OBS无声黑屏、实体头像及新增5张纸面仍未通过。语音ready队列持续增长，不能以服务存活代表全部队列稳定。

仓库已按用户要求改为PUBLIC；此前CI受账户支付限制是历史结果，后续运行另行核验。

## GitHub云端验证通过

公开仓库提交9e936e4的[GitHub Actions运行34820057538](https://github.com/shiftshen/ai-live-studio/actions/runs/34820057538)于2026-09-14 07:55:06 UTC完成：依赖安装、类型检查、50/50测试（失败0）、生产构建全部成功。此前私有仓库账单限制导致未启动的记录仍保留；未修改账单或购买额度。云端通过只证明源码验证，不替代尚未结束的持续观察及现场设备验收。

## 解锁后的实际续测与新修复

2026-09-14约08:37 UTC用户解锁后，已实际操作手机相机：可见泰语感谢小票、昵称、数量及中文“礼物”占位，同昵称重复小票也可见。证据 /Volumes/M2USB/Projects/ai-live-studio/var/evidence/printer-after-unlock-close.png。仅确认整体纸面与重复现象，未逐张映射订单；修复后新增打印0张，额度仍10/10。

两小时原报告已结束：7200秒、121采样点、重启0，服务存活passed=true；双平台全程passed=false，抖音末段断开。Dycast现场随后显示主播已下播。抖音10885条（评论432、关注69、进场9331、点赞1053），TikTok5379条（评论140、关注166、进场4883、点赞182、礼物8）。采样总计16264条，旧礼物字段缺陷仍适用于这些旧事件。内存RSS起始196000KB、最终101424KB、最大196000KB；speech ready最终191，不能认定全部队列稳定通过。

已部署TikTok v3礼物修复；新增普通非礼物画面/语音2分钟过期，保留可追溯记录，保护礼物和打印任务；实际约200个普通语音转expired、ready降到9。抖音握手改为waiting_events，新事件才显示connected，60秒无事件提示检查开播状态，历史批次不误报在线。52/52测试、类型检查、前端构建通过；相关改动为src/server/worker.ts、src/server/adapters.ts、src/server/routes/delivery.ts、src/server/app.ts、src/client/api.ts及对应回归测试。

OBS浏览器黑屏仍复现：正确URL、官方远程诊断、新缓存均未解决；30.2.3对照未完成可用验证；临时窗口采集能捕获窗口但未完成准确展示窗口配置，已删除临时源。恢复32.2.2及正确展示地址，无公开推流。OBS可听音画、动态头像、修复后真实礼物去重仍不勾选通过。

新的30分钟观察见 /Volumes/M2USB/Projects/ai-live-studio/var/evidence/acceptance-after-unlock-connected/report.json，未完成前不宣称通过。普通Chrome的播放ACK只属浏览器证据。
