# 心愿邮局：自播、平台音画与交付记录

2026-09-14，时区Asia/Bangkok。源码 https://github.com/shiftshen/ai-live-studio 。**自己的抖音进场/问候 → 中文语音与画面 → 平台回放已取得实证；全项目并未全部验收通过。**

## 两场实际直播分别记录

| 项目 | 第一场 | 第二场 |
| --- | --- | --- |
| 发起 | 本次助手从官方直播伴侣开播 | 用户再次开启直播，助手发现后接入 |
| 房间 | https://live.douyin.com/52415963297 | 同一自有账号/公开房间，新的平台场次 |
| 开始 | 16:47:53.947 | 17:25:58.441 |
| 结束 | 16:57:01.018 | 17:35:50.076 |
| 官方日志时长 | 547.071秒，9分7秒 | 591.635秒，9分52秒 |
| 平台统计 | 2人看过、0礼物 | 2人进房、2人评论、4次点赞、1新增关注、0礼物 |
| 本项目接通后事件 | 1条主播真实问候 | 8条真实评论、1次真实进场 |
| 自动反馈 | speech/overlay各1条 | 两次问候、一次进场，共3组、6个任务，全部completed且error=null |
| 新增实体打印 | 0 | 0 |

两场没有合并伪称一次10分钟；合计18分59秒，其中第二场不是助手发起，助手接入后仍在该场10分钟内关播。平台网页显示北京时间，较本机曼谷时间快1小时；第二场网页摘要为9分51秒，与日志秒级记录的差异保留。

第二场被发现时已开播约3分半；随后连接采集。初次先启动转发、后连接房间导致握手缺失，部分早期评论未进入业务队列。纠正顺序后实际收到上述9条事件。不能宣称覆盖了第二场从开播起的全部事件。

## 平台回放证明音画实际上传

第二场网页登录后的复盘已生成真实720×1280回放，整场591.103833秒。下载末尾171.133333秒片段，包含HEVC视频和AAC音轨。没有把本地WAV、播放器ACK或模拟事件冒充平台回放。

音轨中31.20–34.93秒、106.45–110.18秒为两次中文问候，163.72–167.86秒为真实进场欢迎（片段相对时间）。画面抽帧可见对应昵称和文字卡片。中文识别确认“欢迎笑对人生来到心愿邮局，很高兴遇见你”的主体内容；昵称中的英文/数字及个别同音字存在识别或发音歧义，不宣称逐字音色质量全部合格。

- 9秒音画证据：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/platform-voice-proof.mp4
- 平台原片段：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/platform-return.mp4
- 原音轨与识别：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/platform-return.wav、platform-return-asr.json
- 欢迎抽帧：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/platform-return-welcome-166.jpg
- 实时事件和任务：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/second-live-feedback.json
- 两场状态：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/own-live.json、second-live.json

此前手机显示“暂无回放”及网页要求相机扫码是当时真实情况。后来网页登录状态恢复，第二场平台回放可读取，因此平台音画验收结果已经更新。

## 发现并修复的问题

1. **转发启动顺序**：Dycast现在在直播房间连接成功时向已打开的转发连接补发房间握手。3个实际UI回调回归先复现失败，再全部通过。修订应用已重新编译、签名核验并安装；没有为此再次开第三场直播。
2. **屏幕长句裁切**：段落换行后仍被Flex压缩，已限制宽度并禁止压缩卡片/正文，调整头像和间距。本地截图证实欢迎句完整显示。
3. **屏幕头像过度黑白化**：屏幕保留彩色，只有打印分支转换黑白，使用独立缓存命名。像素及打印大小回归通过。
4. **素材截图有鼠标**：原生展示窗口新增“导出活动图片”（Command+E），使用WebKit页面快照生成无鼠标PNG。本机实导出2160×3840，两种语言均已查看。
5. **资源占用**：手机投影固定无音频、15fps、最大1000px；查询增加索引、过期扫描从每0.5秒改为每10秒。手机新闻混音的失败录制保留，停用手机声音后本地录制正常。

画面修复进行了标注“本地画面检查”的短暂模拟/重放，后续校验静音，没有开播或打印。这些记录不能加入9条真实事件统计。最终本地画面证据：/Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin/layout-wrap-final.jpg。

## 中泰活动完整内容

中泰各7条规则：进场欢迎、关注感谢、评论问候、免费祝福、礼物1/10/66份。礼物取同次连送最终数量，只执行最高档；免费评论60秒冷却，进场/关注同用户每场一次。

礼物图为本项目通用礼盒，映射“任意礼物 × 最终数量”，不冒充平台官方礼物图、不虚构giftId或价格。回馈为数字语音、昵称/头像卡及祝福，不承诺现金、抽奖、实物或打印。后台可按已核实giftId进一步配置指定礼物。

| 资产 | 完整路径 |
| --- | --- |
| 中文高清活动图 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.png |
| 泰文高清活动图 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.png |
| 原创背景 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/wish-post.png |
| 中文活动网页 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.html |
| 泰文活动网页 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.html |
| 中文完整文案 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/content-zh.json |
| 泰文完整文案 | /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/content-th.json |

实时画面档位读取后台启用规则；静态PNG/HTML不是自动更新的广告，改规则后重新导出。原始背景分辨率与输出画布分辨率不同，不宣称背景细节被重新生成。

泰语欢迎和礼物感谢实际生成耗时8.339秒、9.504秒，均低于15秒时限。音频可解析，识别到泰语主要内容；数量及专有词发音仍须语音质量复核，不等于TikTok自播或平台音频验收。最初本地探针误用相对输出路径失败，改为与业务Worker一致的绝对路径后成功，未隐去失败报告。

## 软件验证与剩余项

- 58/58主项目测试通过；前后端类型检查、生产构建和Swift窗口编译通过。
- Dycast 15项字段行为、3项接线、6项真实protobuf断言、3项启动顺序回归通过；Vue类型检查及Rust应用构建通过。
- GitHub会运行主项目和固定版本Dycast契约检查。云端运行结果以对应提交页面为准。
- 隔离/幂等自查：房间及角色隔离、非法令牌、重复事件/累计连送、未知打印禁止盲重试、规则和模板快照均有回归。直播评论不能修改设备、额度或执行权限。
- 未通过：真实礼物连送最终数量的完整复验、自己的TikTok开播、实体头像及可靠打印纸面闭环、昵称/数量语音逐字质量。
- 当前全局暂停、设备禁用、房间解绑、启用print规则为0。**两场及后续画面修复均未新增实体打印。**

原始回放、观众身份、订单、设备编号、二维码和凭据只存私有var目录；公共仓库只发布源码、通用素材和汇总。

## 本次收尾改动文件

- /Volumes/M2USB/Projects/ai-live-studio/.github/workflows/check.yml
- /Volumes/M2USB/Projects/ai-live-studio/README.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/ACCEPTANCE.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/NEXT-SESSION.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/OPERATIONS.md
- /Volumes/M2USB/Projects/ai-live-studio/docs/OWN-LIVE-RESULT.md
- /Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/README.md
- /Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/build-report.json
- /Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/build.sh
- /Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/relay-order.patch
- /Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/test-relay-order.mjs
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.jpg
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-th.png
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.jpg
- /Volumes/M2USB/Projects/ai-live-studio/public/live-assets/activity-zh.png
- /Volumes/M2USB/Projects/ai-live-studio/src/client/components/LiveStage.vue
- /Volumes/M2USB/Projects/ai-live-studio/src/native/LiveStage.swift
- /Volumes/M2USB/Projects/ai-live-studio/src/server/providers.ts
- /Volumes/M2USB/Projects/ai-live-studio/src/server/worker.ts
- /Volumes/M2USB/Projects/ai-live-studio/tests/providers.test.ts
