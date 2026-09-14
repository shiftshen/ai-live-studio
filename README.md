# AI Live Studio

本地直播互动工作台：接收 TikTok、抖音真实直播事件，按房间与场次执行规则，生成文字、头像、语音、OBS 展示及飞鹅打印任务。项目独立于 DAMO；不修改 DAMO 业务数据。

已搭建中泰双语“心愿邮局”直播场景：原创背景、活动图片、7条规则/语言、昵称与头像卡、语音感谢。自己的抖音号已通过官方Mac直播伴侣实际开播9分7秒，观众端看到画面，真实评论产生并完成语音和展示任务。本轮新增打印0张。

**全项目尚未全部现场验收通过**：真实礼物复验、观众端语音回放、自己的TikTok开播、实体头像和可靠纸面闭环仍未完成。软件自动测试57项通过；本地可听录制与观众端可听分开记录。详情见[本轮实播报告](https://github.com/shiftshen/ai-live-studio/blob/main/docs/OWN-LIVE-RESULT.md)。

![中文活动设计](https://raw.githubusercontent.com/shiftshen/ai-live-studio/main/public/live-assets/activity-zh.jpg)
![泰文活动设计](https://raw.githubusercontent.com/shiftshen/ai-live-studio/main/public/live-assets/activity-th.jpg)

## 启动

要求 Node.js 24 或更新版本；本机安装目录为 `/Volumes/M2USB/Projects/ai-live-studio`。现有实例运行时不要另起同数据目录实例。

```sh
cd /Volumes/M2USB/Projects/ai-live-studio
npm ci
npm run check
npm test
npm run build
npm run up
```

打开 [本地工作台](http://127.0.0.1:8890)。首次启动生成管理员访问令牌，保存在 `/Volumes/M2USB/Projects/ai-live-studio/var/admin-token`；在登录页使用，不提交到代码库或报告。`npm run doctor` 查看依赖诊断；`npm run down` 发送优雅停止信号。`npm run up` 会核验进程与健康接口，启动失败会明确报错；仍须实际打开页面验收业务。服务只监听本机回环地址。

本地 AI 依赖 [Ollama](http://127.0.0.1:11434)，语音调用 `/Users/shift/openclaw/scripts/omnivoice_local_tts.py`。模型、音色与设备能力以诊断和实际生成结果为准。

## 使用顺序

1. **系统与访问**：管理员设置打印速度、队列上限、保留周期和全局暂停；给操作员或观察员分配房间。
2. **直播间**：填写 TikTok 用户名或完整直播地址；抖音填写数字房间号或完整地址。选择中文、泰语或英文，填写人设与知识，管理员绑定打印机。
3. **内容模板 / 互动规则**：配置进场、关注、评论关键词、礼物、点赞里程碑；选择模板、冷却、每场一次、优先级与打印/语音/展示动作。模板变量为 `{{nickname}}`、`{{giftName}}`、`{{count}}`、`{{text}}`、`{{time}}`。
4. **事件实验室**：先预览命中原因，再模拟或回放。模拟及回放产生的普通打印任务为 `dry_run`，不发送实体打印。设备页的专用“测试打印”是单独的实体动作，默认安装级测试模式下，专用测试与真实直播打印共享十张额度。
5. **打印设备 / AI 与语音**：检查设备在线状态，测试文字与语音；头像开关表示配置能力，不表示设备已经验证能打印头像。语音预览返回文件不代表已经听见声音。
6. **连接直播**：TikTok 使用本地 connector；抖音通过独立修订 Dycast 1.4.1 的认证 WebSocket 转发，操作方式见运维文档。
7. **直播展示**：默认展示完整“心愿邮局”竖屏；添加 transparent=1 查询参数可用透明字幕版。官方直播伴侣已验证采集专用原生窗口；OBS浏览器黑屏仍未解决。使用房间展示 URL，按需启用播放。语音在播放器 `ended` 后 ACK；无播放器时 `ready` 任务会保留。展示 token 只授权该房间。
8. **执行队列 / 粉丝与屏蔽 / 数据统计**：检查任务原因，屏蔽指定房间用户，导出 CSV。状态快照仅展示最近 300 个事件、500 个任务；全量数据使用分页 API 或导出，不能把画面行数当总量。

`unknown` 打印结果禁止自动重试；如确实需要再次打印，管理员必须使用独立补打动作，新任务关联原任务并保存补打原因；原任务未结束或设备队列已满时拒绝补打。全局暂停不取消已经交给打印供应商的任务。

## 文档

- [架构、数据库与 API](/Volumes/M2USB/Projects/ai-live-studio/docs/ARCHITECTURE.md)
- [启动、权限、备份恢复与故障处理](/Volumes/M2USB/Projects/ai-live-studio/docs/OPERATIONS.md)
- [验收证据与未完成边界](/Volumes/M2USB/Projects/ai-live-studio/docs/ACCEPTANCE.md)
- [第三方组件及许可证](/Volumes/M2USB/Projects/ai-live-studio/docs/THIRD-PARTY.md)
- [前后端实施契约](/Volumes/M2USB/Projects/ai-live-studio/docs/IMPLEMENTATION.md)

当前 npm 元数据为 `private: true`，项目未声明自身开源许可证。依赖包含 **AGPL-3.0-only** 的 `tiktok-live-connector`，不能把整套交付称为纯 MIT 项目。
