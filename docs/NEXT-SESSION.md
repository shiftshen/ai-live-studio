# AI Live Studio 继续验收

项目 `/Volumes/M2USB/Projects/ai-live-studio`，当前分支main，公开远端https://github.com/shiftshen/ai-live-studio。本地50/50测试、类型检查、生产前端构建通过；Dycast补丁24断言通过。没有全部实机验收完成。

## 已授权范围

继续开发、真实测试并更新GitHub，不需重复确认。公开直播间只读，不发表评论、不送礼物、不付费。本人公开开播必须少于10分钟，本轮实际0分钟。实体打印累计上限10张，目前10张已用完，后续打印已blocked保留，不重置计数。

## 当前持续任务

- 双平台30分钟采集已通过（1801.404秒/31采样点，抖音1882条、TikTok1367条，重启0，未出现礼物）；证据var/evidence/acceptance-corrected/30min-final.json。两小时仍在运行。
- 真实双平台监测PID75195，起点2026-09-14 06:30:45.233 UTC，预计2小时终点08:30:45.233 UTC。读`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/acceptance-corrected/report.json`及samples.jsonl；只有completed/passed满足才报告相应门槛。
- 当前运行服务包含真实ID/Thai字体/共享10张额度/PATCH显式键修复。之后源码的retry/reprint容量强化、accepted占用入队额度、去除导入硬编码只在本地隔离测试通过，尚未重启部署。不得宣称这些后续改动已完成长时验收。
- 持续测试结束前不要无故重启。若必须修复实际故障，保留失败报告、新目录重新计时。不要把新开始当旧时长累计。
- HTTP负载已完成600.006秒，60000请求/接收/入库，36000任务，0错误，600次状态读取，最大827ms；报告passed=true。原PID85583，脚本`/Volumes/M2USB/Projects/ai-live-studio/scripts/load-http.ts`，独立目录`/Volumes/M2USB/Projects/ai-live-studio/var/evidence/http-load-1789368121458`，600秒/100每秒，20%规则命中+并发状态HTTP读取，Worker关闭。原始report必须限定验证范围。
- 临时TikTok礼物观察`beellaa_19`和`t.r.b.o0`，脚本var/gift-observe.mjs，10分钟自动结束。第二个不在线，第一个当时仅收到评论/进场/点赞/关注。读var/evidence/gift-observe-*.json。不是工作台打印闭环。
- 已创建当前任务心跳，automation id `ai-live-studio`，每10分钟检查；未完成且无新故障时保持安静。最终报告和GitHub更新后暂停它，避免无限重复。

## 现场限制与继续动作

Mac于约06:38 UTC锁屏，CUA明确自动解锁失败。不要绕过锁屏。需用户正常解锁后才能继续手机/OBS交互；只读服务测试不受影响。最终汇报必须区分锁屏阻塞和项目代码问题。

TikTok设备账户当时9粉丝，资格页要求50粉丝，没有申请入口，仅练习模式。没有申请成功，不买粉丝。抖音仅检查准备页，从未公开开播。公开互动采集运行在电脑，不要求直播手机连接；TikTok真实礼物已收到，但字段契约缺陷导致疑似重复动作，未通过去重验收。

普通飞鹅当前只验证文字，动态头像打印硬件能力未通过。官方普通小票接口的固定LOGO不能替代每人头像；不要调用标签打印接口试错，不拿二维码冒充头像。相机第4张Chinese通道乱码，第5张Thai通道中文与泰语可读；英文纸面及长拉丁昵称此前可见。源码已统一设备Thai字体通道，最终自动通道纸面复验因锁屏未做。

OBS官方32.2.2 app在`/Volumes/M2USB/Projects/ai-live-studio/var/vendor/OBS.app`。本地录像确实黑屏无声，关闭硬件加速、基础HTML探针无效，不是通过。Mac26.7、CEF127、签名正常、无崩溃报告。官方30.2.3不同CEF对照DMG已下载但未运行，路径var/vendor/OBS-Studio-30.2.3-macOS-Apple.dmg。下次可按官方参数--remote-debugging-port=9229启动，通过受支持CUA浏览器检查DevTools；不要绕过电脑使用限制。当前OBS浏览器源被换成诊断地址8891/obs-probe.html，测试恢复需改回var/overlay-url的本机房间URL（含令牌，勿输出）。

两平台房间ID：抖音7e27f90c-55e3-46ff-afc5-cae7dc6c80aa；TikTok80c5b8c7-5b2f-4068-ad6f-ab9a558584f7。地址在受认证state中读取。抖音应用var/vendor/Dycast AI Live Studio.app，独立bundle local.ai-live-studio.dycast。后端重启会使转发断开，当前Dycast需要在界面重新点击转发；锁屏不能操作时不要假称已恢复。

## GitHub与凭据

仓库已推main，首次发布commit2f83148099de512826da88b2a6a14d558c5e845f。GitHub首轮run34814961125未启动任何步骤：账户支付失败或spending limit，不能称云端测试失败于代码，也不能未经授权修改账单/购买额度。本地检查正常。

main是清理后的首次发布历史，原codex/initial-implementation分支仅保留本机开发历史，含旧的设备编号硬编码；不要push --all。main不含真实设备编号/管理令牌/飞鹅密钥/展示令牌。凭据var/admin-token、var/secrets/feie.json；只读必要字段，禁止写入日志、文档或提交。GitHub只提交源码与脱敏报告，原始直播/手机照片留var。

继续时先核对git status、运行PID、报告时间与平台连接；完整结果见docs/ACCEPTANCE.md。更新真实报告后提交main并推送。若继续存在真实礼物、实体头像、OBS或锁屏阻塞，明确列出而不是勾选完成。

## 07:50 UTC 真实礼物发现与修复

TikTok在07:16:21—07:18:37收到6条live礼物消息，3个分组各两条，5个打印任务有不同providerId及completed回执，第6个因额度10张用尽blocked。不能称为5笔独立礼物或完整可靠闭环：原适配器仍读v2 giftDetails和布尔repeatEnd，当前连接器2.4.4直接发v3 gift.type/name和数字repeatEnd，丢失连送属性。已修复源码并新增真实protobuf编码/解码→规则引擎回归，开始/结束/重复结束只生成一组动作；50/50测试、类型检查、构建通过。此修复尚未部署，运行态仍有该缺陷但硬额度阻止继续打印。原始记录保留，禁止改写历史为通过。

本机证据 /Volumes/M2USB/Projects/ai-live-studio/var/evidence/live-print-audit.json。锁屏后这5张没有纸面证据，真实连送正确性仍待修复部署后验证。用户已明确要求并核验GitHub PUBLIC；心跳提示已同步。队列speech ready持续增加、OBS无消费者，完整队列稳定性不能仅凭服务无重启通过。
