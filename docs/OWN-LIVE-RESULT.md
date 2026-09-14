# 心愿邮局：自己的抖音实播记录

日期2026-09-14，时区Asia/Bangkok。源码 https://github.com/shiftshen/ai-live-studio 。这是实测记录，不是全项目验收通过声明。

| 项目 | 实际结果 |
| --- | --- |
| 房间 | https://live.douyin.com/52415963297 |
| 推流 | 官方Mac抖音直播伴侣10.0.2，专用WebKit直播窗口 |
| 开始 | 16:47:53.947，官方日志start-live-ok |
| 结束 | 16:57:01.018，官方日志stop-live-ok，界面确认已结束 |
| 时长 | 547.071秒，即9分7秒；平台摘要按分钟显示共10分钟 |
| 画面 | 30fps，约4.1–4.3Mbps，手机及电脑观众端看到心愿邮局 |
| 统计 | 2人看过，0送礼人数、0收入、0新增关注 |
| 真实评论 | 主播账号发送1条问候，采集origin=live、identityReliable=true |
| 真实反馈 | speech和overlay各1条，均completed、error=null |
| 本轮新增打印 | **0**；打印机禁用、房间解绑、活动规则不含print |
| 真实礼物 | **0，未通过真实送礼事件验收** |

平台“评论人数0”与后台采集1条主播评论不冲突；不把主播自测描述为粉丝送礼。

## 语音证据

开播前本地录制验证了中文问候和礼物感谢。第一段混入手机新闻音频，判定失败；关闭手机音频转发后，第二段66.816秒录制只识别到中文互动测试。录像 /Users/shift/Movies/2026-09-14-16-40-15.mkv。

实播评论有可追溯中文音频、原生窗口播放结束ACK和观众端画面。**这些不能单独证明观众端听到了语音。** 网页回放另需登录；抖音明确禁止相册登录二维码，要求相机扫一扫，未绕过。手机已登录主播中心同样显示“暂无回放数据”，截图replay-unavailable.jpg。观众端回放音频核验仍未完成。

## 活动交付

中泰各7条规则：进场欢迎、关注感谢、评论问候、免费祝福、礼物1/10/66份。礼物按同次连送最终数量，只执行最高档。免费评论互动60秒冷却，进场及关注同用户每场一次。语音、昵称、头像卡和画面组合，无打印动作。

礼物图标是本项目的通用礼盒，不冒充平台官方礼物，不虚构礼物ID或价格。当前映射“任意礼物 × 数量”，后台可配置已确认的指定giftId。回馈为数字感谢/祝福，不包含现金、抽奖、商品或实体打印承诺。

| 资产 | 完整路径 |
| --- | --- |
| 中文活动图 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.jpg |
| 泰文活动图 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.jpg |
| 原创背景 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/wish-post.png |
| 中文活动网页 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.html |
| 泰文活动网页 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.html |
| 中文完整文案 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/content-zh.json |
| 泰文完整文案 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/content-th.json |

JPG是实际432×768直播窗口导出，不宣称1080×1920。实时画面档位读取后台当前规则；静态导出改规则后需更新。

## 未完成项

观众端语音回放、真实礼物最终数量、自己的TikTok开播、实体头像及可靠打印纸面闭环。本轮不再以打印消耗替代这些验收。

私有现场证据 /Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin。原始二维码、观众身份、设备编号、订单和录像不公开；公共仓库仅放源码、通用资产及汇总。

## 最终软件检查

本轮最终执行57/57自动测试，失败0；前后端类型检查通过，Vite生产构建通过，Swift原生窗口编译通过。包含活动最高档匹配、重复连送结束只一组动作、启用规则动态读取及跨房间/非法令牌隔离。独立样例不触发实体打印。

新增源码集中在活动文案/规则、完整直播场景、原生窗口和静音手机投影构建脚本；另修复TikTok时间戳秒/毫秒适配、队列查询索引和过期扫描频率。完整变更以本次Git提交为准。

结束后关闭本次采集器和手机投影，停止直播推流；不结束其他项目服务。全局暂停、打印设备禁用、房间无绑定，当前活动规则中print动作数为0。

## 本次改动文件

- /Volumes/M2USB/Projects/ai-live-studio/README.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/ACCEPTANCE-HISTORY-20260914.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/ACCEPTANCE.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/NEXT-SESSION.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/OPERATIONS.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/OWN-LIVE-DESIGN.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/OWN-LIVE-RESULT.md
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.html
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.jpg
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.html
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.jpg
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/content-th.json
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/content-zh.json
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/wish-post.png
- /Volumes/M2USB/Projects/ai-live-studio/scripts/build-phone-app.sh
- /Volumes/M2USB/Projects/ai-live-studio/scripts/build-stage-app.sh
- /Volumes/M2USB/Projects/ai-live-studio/scripts/export-campaign.ts
- /Volumes/M2USB/Projects/ai-live-studio/scripts/install-campaign.ts
- /Volumes/M2USB/Projects/ai-live-studio/src/client/components/LiveStage.vue
- /Volumes/M2USB/Projects/ai-live-studio/src/client/components/Overlay.vue
- /Volumes/M2USB/Projects/ai-live-studio/src/native/LiveStage.swift
- /Volumes/M2USB/Projects/ai-live-studio/src/server/adapters.ts
- /Volumes/M2USB/Projects/ai-live-studio/src/server/routes/delivery.ts
- /Volumes/M2USB/Projects/ai-live-studio/src/server/store.ts
- /Volumes/M2USB/Projects/ai-live-studio/src/server/worker.ts
- /Volumes/M2USB/Projects/ai-live-studio/src/shared/campaign.ts
- /Volumes/M2USB/Projects/ai-live-studio/tests/campaign.test.ts
- /Volumes/M2USB/Projects/ai-live-studio/tests/tiktok-contract.test.ts
