# 当前交接：自己的抖音已实播

2026-09-14，项目 /Volumes/M2USB/Projects/ai-live-studio，公开仓库 https://github.com/shiftshen/ai-live-studio ，只推main。此前锁屏、未自播、旧观察PID的描述已经过时。

- 官方Mac抖音直播伴侣10.0.2已安装 /Applications/Douyin Webcast Mate.app，用户账号已登录，电脑直播权限已申请并显示开通。
- 自己的直播：https://live.douyin.com/52415963297 ，标题“心愿邮局｜中文语音互动测试”。官方日志16:47:53.947开始、16:57:01.018结束（曼谷时间），547.071秒，低于10分钟。已确认直播结束，不再开播凑测试。
- 观众端收到竖屏画面，平台统计2人看过。主播本人发送1条真实评论，采集origin=live，生成并完成speech和overlay各1条。账号实际昵称就是null，不擅自改名。
- 真实礼物0；本地礼物样例不算真实送礼。观众端声音仍须按验收报告单独确认。
- 中文/泰文“心愿邮局”背景、活动图片、文案及7条规则/语言已安装。任意礼物最终连送1/10/66份触发最高档语音及画面，份数不是价格。
- **当前禁止继续打印**：全局暂停、所有打印机禁用、房间解绑打印机、新活动无print动作。此前已取消116条未发送任务，飞鹅云队列清空返回true。不要再启用、补打或重放实体任务。

## 展示与语音

官方直播伴侣窗口采集“AI Live Studio · 直播画面”，麦克风关闭，确认桌面音频来源。专用窗口由 /Volumes/M2USB/Projects/ai-live-studio/scripts/build-stage-app.sh 构建，启动后粘贴工作台生成的本机房间展示地址，带令牌地址不公开。

手机投影固定 --no-audio --max-fps=15 --max-size=1000，避免手机其他直播混入自己的直播。第一次本地录制混入手机新闻，停掉手机音频后第二段只有中文互动测试。OBS32.2.2浏览器黑屏未解决，本轮采用官方直播伴侣窗口采集。

## 证据与余项

本轮详情 /Volumes/M2USB/Projects/ai-live-studio/docs/OWN-LIVE-RESULT.md。私有证据 /Volumes/M2USB/Projects/ai-live-studio/var/evidence/own-douyin：live-feedback.json、own-live.json、own-live-ended.jpg。实际推流画面、本地可听录制、播放器ACK、观众端可听必须分别验收。

未完成：观众端语音回放、自己的TikTok开播资格、真实礼物最终连送复验、实体头像与可靠打印纸面闭环。此前浪费纸张的公开房间打印不算完整自播验收。原始凭据、观众身份、二维码、日志、录像只留var及本机Movies，不上传GitHub。自动续测保持暂停。
