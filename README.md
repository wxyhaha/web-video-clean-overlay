# Web Video Clean Overlay (网页视频暂停浮层净化工具)

基于 WebExtensions Manifest V3 标准构建的轻量级浏览器扩展与油猴用户脚本（UserScript），专为清除网页视频播放暂停时弹出的干扰性大幅悬浮图层而设计。

## ⚠️ 免责声明 (Disclaimer)

1. **学习与交流用途**：本项目仅供前端技术研究、WebExtension API 学习以及 DOM 观察器（MutationObserver）与 CSS 优化实践，不以商业盈利为目的。
2. **非破坏性原则**：本项目不修改任何远程网络传输数据，不拦截或篡改流媒体协议，亦不提供任何会员权限破解功能；所有操作仅限于用户本地浏览器端视口样式渲染调整。
3. **知识产权**：文中及代码提及的第三方网站商标与版权归其各自所有者所有。如权利人认为本项目涉及侵权，请通过 Issue 或邮件与作者联系，作者将及时配合下架或归档处理。

---

## 🌟 功能特性

- **轻量克制**：不使用 `declarativeNetRequest` 拦截网络请求，不干扰视频流加载，不触发反爬风控提示。
- **全新特征拦截**：完美覆盖优酷新版动态混淆广告容器（如 `#click-close`、`.ad-effect`、`.ad-button`、`#youku-pause-resource-container` 等）。
- **安全渲染控制**：采用无害化 CSS 样式隐藏与事件穿透（`pointer-events: none`），避免直接移除 DOM 导致现代单页播放器框架（React / Rax）状态崩溃或暂停后点击失效。
- **三重防护架构**：
  1. **静态 CSS 规则（主力）**：页面加载早期注入，毫秒级隐式消除，杜绝广告闪烁；
  2. **暂停事件 + 延时复查**：针对暂停后异步网络拉取物料的延迟渲染进行精准打击；
  3. **微轮询兜底**：应对前端框架状态更新（Virtual DOM Diff）导致的样式重置。
- **双模运行**：同时提供 **浏览器独立扩展版**（支持可视化手动点选）与 **油猴脚本版**（即装即用）。

---

## 🚀 安装与使用

### 方式一：油猴脚本安装（最推荐，简单快捷）
1. 确保浏览器已安装脚本管理器：[Tampermonkey (篡改猴)](https://www.tampermonkey.net/) 或 [Violentmonkey (暴力猴)](https://violentmonkey.github.io/)；
2. 安装项目内的脚本：打开本仓库的 [`youku-pause-ad-killer.user.js`](https://github.com/wxyhaha/web-video-clean-overlay/raw/main/youku-pause-ad-killer.user.js) 点击安装（或前往 Greasy Fork 安装）；
3. **重要提示（Edge / Chrome 新版用户）**：
   - 打开浏览器扩展管理页面（`edge://extensions/` 或 `chrome://extensions/`）；
   - 找到 Tampermonkey 的「详细信息」；
   - **开启「允许用户脚本」/「允许访问用户脚本」开关**，否则浏览器默认会静默拦截所有用户脚本；
4. 刷新优酷视频页面，暂停时广告即可自动消失。

### 方式二：浏览器独立扩展安装 (Edge / Chrome)
1. 从 [GitHub Releases](https://github.com/wxyhaha/web-video-clean-overlay/releases) 下载最新的 `web-video-clean-overlay-v*.zip` 并解压；
2. 打开 Chromium 系浏览器，在地址栏访问：
   - Edge: `edge://extensions/`
   - Chrome: `chrome://extensions/`
3. 开启页面上的 **“开发人员模式”** (Developer Mode)；
4. 点击 **“加载解压缩的扩展”** (Load unpacked)，选择解压后的文件夹；
5. 打开或刷新优酷播放页面，即刻生效。

---

## 📁 目录结构

```text
├── manifest.json                 # Manifest V3 扩展配置文件
├── icons/                        # 扩展图标 (16x16, 48x48, 128x128)
├── background/
│   └── service-worker.js         # 后台状态与存储初始化
├── content/
│   ├── content.css               # 样式注入与防闪烁规则
│   └── content.js                # 暂停监听、DOM 观察与动态净化逻辑
├── popup/
│   ├── popup.html                # 扩展交互弹窗
│   ├── popup.css                 # 弹窗样式（自适应深浅主题）
│   └── popup.js                  # 交互控制逻辑
├── youku-pause-ad-killer.user.js # 单文件油猴用户脚本 (Tampermonkey)
├── LICENSE                       # MIT 开源协议
└── README.md                     # 说明文档与免责声明
```

---

## 📄 License

[MIT License](LICENSE)
