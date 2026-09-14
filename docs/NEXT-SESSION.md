# AI Live Studio 继续验收（用户已解锁后）

项目 /Volumes/M2USB/Projects/ai-live-studio，main，公开GitHub https://github.com/shiftshen/ai-live-studio。用户已正常解锁，手机和OBS已实际操作，不再沿用锁屏阻塞。52/52本地测试、类型检查和构建通过。项目仍未全部实机验收通过。

## 当前运行与授权

- 实体全局10/10额度已用完，绝不重置或新增出纸。公开房间只读，不发评论、不刷礼物；自播实际0分钟。
- 服务已部署TikTok v3礼物字段修复、重试容量修复、普通语音/画面2分钟过期及抖音转发健康状态修复。当前PID以var/instance.lock为准。
- 抖音原宇食同行已下播，Dycast UI明确显示。新房间 https://live.douyin.com/61478278588，名称玥杨。房间内部ID保持7e27f90c-55e3-46ff-afc5-cae7dc6c80aa，地址切换已生成新场次。TikTok仍为prettygirlthailandlive1，内部ID80c5b8c7-5b2f-4068-ad6f-ab9a558584f7。
- 当前有效30分钟观察PID83437，目录 /Volumes/M2USB/Projects/ai-live-studio/var/evidence/acceptance-after-unlock-connected，实际开始/预计结束见report.json。开始前已核对两平台connected。前一次acceptance-after-unlock在TikTok connecting时启动，保留失败报告并停止，不累计时长。
- 新版本连接状态：抖音握手只标waiting_events，收到新事件才connected；60秒无新事件回到waiting_events，不武断说主播下播。历史消息不恢复在线状态。
- 普通follow/comment/like画面及语音超过2分钟转expired并保留记录；礼物及对应实体任务不应用此过期规则。实际speech积压约200条已过期，待播放降到9条，仍需持续观测，不宣称所有队列永不积压。

## 已完成真实证据与未通过项

原两小时观察06:30:45.234—08:30:45.234 UTC，121点、7200秒、服务重启0，服务存活通过；全程双平台未通过，抖音末段disconnected/no_live_data_interval。共16264条，抖音10885、TikTok5379（礼物8条，旧字段映射）。证据var/evidence/acceptance-corrected/report.json和two-hour-summary.json。不能改写旧报告为全部通过。

用户解锁后相机看到真实纸面，泰语昵称、感谢语、中文占位“礼物”、数量1可读，且同昵称重复小票可见，支持旧连送字段缺陷。图片var/evidence/printer-after-unlock.png和printer-after-unlock-close.png。有纸面总体证据，但未逐张关联任务ID，修复后没有新增实体出纸，不能说修复后纸面通过。旧6条/3组消息已有5云端completed和1blocked，之后更多消息受额度限制，历史保持原样。

OBS32.2.2浏览器仍黑屏。已恢复正确var/overlay-url，不再是8891探针。官方remote-debugging-port=9229页面可列目标，但DevTools连接关闭；新缓存无改善。官方30.2.3对照进程启动但CUA无法稳定读取窗口，不能证明旧版渲染通过；已结束对照，恢复32.2.2无调试参数。新建macOS窗口采集曾显示实际窗口，但未成功选定Chrome展示窗口，已删除临时源，没有录制或公开直播该窗口。OBS音画仍未通过。

普通Chrome真实overlay已启用语音按钮，发生播放ACK，但不等于OBS可听证据。Chrome展示tab2130659218保留，需要再次markDeliverable。手机保持相机可看小票。CUA只能用受支持工具，不绕过权限。账号TikTok9粉丝/门槛50，无申请入口，未申请；实体动态头像不支持证据仍缺，不使用二维码替代。

## 后续工作

继续观察修复后的真实礼物，检查同组start/end只一任务，不通过刷礼物制造样本。有效报告完成后回读PID/事件/队列并更新GitHub；未出现真实礼物明确未通过。继续定位OBS浏览器或可维护备用路径，禁止以ACK代替录制音画。心跳需使用这个新目录，不再重复旧两小时检查；无新结果不发重复空状态，报告完成/故障再通知。

仅推main，勿push --all：旧本地codex/initial-implementation含旧设备编号。var内凭据/照片/原始直播信息均忽略，不提交。GitHub云端9e936e4运行34820057538已实际通过50项；最新52项需核验新CI。只读凭据位置var/admin-token、var/secrets/feie.json，禁止输出值。
