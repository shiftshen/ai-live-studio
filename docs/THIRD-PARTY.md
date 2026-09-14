# 第三方组件与许可清单

核对日期：2026-09-14。版本和许可证来自 `/Volumes/M2USB/Projects/ai-live-studio/package-lock.json`、实际安装包元数据与 LICENSE；不是按组件印象填写。二进制和临时构建缓存位于被忽略的var目录；仓库只保留可复现补丁和许可。根 package.json 标记 private，当前没有项目自身 LICENSE 文件，不能推定本项目已采用 MIT 或其他开源许可证。

## 直接运行依赖

| 组件                  | 锁定版本 | 声明许可证        | 使用位置                              |
| --------------------- | -------- | ----------------- | ------------------------------------- |
| @fastify/static       | 8.3.0    | MIT               | 静态前端分发                          |
| @fastify/websocket    | 11.3.0   | MIT               | 抖音 WebSocket 接收                   |
| fastify               | 5.12.4   | MIT               | HTTP 服务                             |
| lucide-vue-next       | 0.468.0  | ISC               | 图标；LICENSE另保留Feather部分MIT归属 |
| sharp                 | 0.34.5   | Apache-2.0        | 头像处理                              |
| tiktok-live-connector | 2.4.4    | **AGPL-3.0-only** | TikTok 事件接入                       |
| vue                   | 3.5.42   | MIT               | 工作台界面                            |
| zod                   | 4.6.5    | MIT               | 输入验证                              |

## 直接开发依赖

| 组件               | 锁定版本 | 声明许可证 |
| ------------------ | -------- | ---------- |
| @types/node        | 24.13.4  | MIT        |
| @types/ws          | 8.18.1   | MIT        |
| @vitejs/plugin-vue | 6.0.8    | MIT        |
| prettier           | 3.9.6    | MIT        |
| tsx                | 4.23.13  | MIT        |
| typescript         | 5.9.3    | Apache-2.0 |
| vite               | 7.3.6    | MIT        |
| vue-tsc            | 3.3.11   | MIT        |

## 需要单独保留的依赖事实

- `tiktok-live-proto` 0.2.4 同样为 **AGPL-3.0-only**，属于传递依赖。两者许可证正文应从 `/Volumes/M2USB/Projects/ai-live-studio/node_modules/tiktok-live-connector/LICENSE` 及相应包文件保留。不能因其他主要依赖采用MIT就把整个运行环境标记为MIT。
- 本机图像原生包 `@img/sharp-libvips-darwin-arm64` 1.2.4 元数据声明 **LGPL-3.0-or-later**；sharp 自身的 Apache-2.0 不能替代 libvips 及其打包组件许可。实际版本清单位于 `/Volumes/M2USB/Projects/ai-live-studio/node_modules/@img/sharp-libvips-darwin-arm64/versions.json`。
- 锁文件还包含MIT、ISC、BSD、BlueOak、0BSD及混合许可表达式；按完整锁文件留存，而不是只保留本页直接依赖表。锁文件包含跨平台可选包，不代表这些包全部安装在此Mac。
- 本文记录组件声明与文件来源，不宣称完成整套产品重新分发的许可证审查。若改变分发或托管方式，需按实际包含的软件及各自许可证重新核对；不要擅自删除署名、LICENSE或源码来源信息。

## 外部应用与服务

**Dycast**：外部桌面程序1.4.1，固定上游提交`70050e27092fc726e3f7c84339b0edfd36d70130`。MIT许可证、NOTICE、字段补丁、构建脚本与编解码验证保存于`/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast`。独立本机构建应用已实际运行并接收真实用户ID；它不是Apple公证发行包。原始发布程序保持独立，固定补丁应用关闭自动覆盖更新。

**Ollama 与模型**：应用只调用本地API，不把Ollama或模型权重包含进本项目。当前模型由设置选择；模型许可与Ollama程序许可不同，本页没有认证任意模型可商用。

**OmniVoice**：调用现有 `/Users/shift/openclaw/scripts/omnivoice_local_tts.py`；脚本、模型、音色资源不在本项目锁文件内，不能由npm许可证表推断其授权范围。

**飞鹅云、TikTok、抖音、可选签名服务**：属于外部服务或平台，不因使用开源客户端而变成开源服务。应用目前不打包平台Cookie，不购买签名服务，不替用户发送礼物。外部密钥仅通过本机凭据文件或环境读取，报告不列出值。

## 更新时的核对方法

升级后对照 `/Volumes/M2USB/Projects/ai-live-studio/package.json` 与 `/Volumes/M2USB/Projects/ai-live-studio/package-lock.json`，检查新增直接及传递依赖的version/license字段；再核对实际安装包LICENSE。保留上游声明和锁文件，对变更范围重跑自动测试、类型检查及对应真实平台探测。版本升级成功不等于平台接入、礼物或设备验收成功。
