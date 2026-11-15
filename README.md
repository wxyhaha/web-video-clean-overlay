# Web Video Clean Overlay (网页视频暂停浮层净化工具)

基于 WebExtensions Manifest V3 标准构建的轻量级浏览器扩展，专为清除网页视频播放暂停时弹出的干扰性大幅悬浮图层而设计。

## ⚠️ 免责声明 (Disclaimer)

1. **学习与交流用途**：本项目仅供前端技术研究、WebExtension API 学习以及 DOM 观察器（MutationObserver）与 CSS 优化实践，不以商业盈利为目的。
2. **非破坏性原则**：本项目不修改任何远程网络传输数据，不拦截或篡改流媒体协议，亦不提供任何会员权限破解功能；所有操作仅限于用户本地浏览器端视口样式渲染调整。
3. **知识产权**：文中及代码提及的第三方网站商标与版权归其各自所有者所有。如权利人认为本项目涉及侵权，请通过 Issue 或邮件与作者联系，作者将及时配合下架或归档处理。

---

## 🌟 功能特性

- **轻量克制**：不使用 `declarativeNetRequest` 拦截网络请求，不干扰视频流加载，不触发反爬风控提示。
- **安全渲染控制**：采用无害化 CSS 样式隐藏与事件穿透（`pointer-events: none`），避免直接移除 DOM 导致现代单页播放器框架（React / Rax）状态崩溃或暂停后点击失效。
- **动态识别**：结合 `pause` 事件监听与 `MutationObserver` 节流扫描，自适应识别暂停状态下的推荐浮层、大幅广告图层。
- **手动点选扩展**：提供弹窗控制台，支持手动点选特定浮层生成自定义屏蔽规则并持久化保存。

---

## 🚀 安装与使用 (Edge / Chrome)

1. 将本项目 Clone 或下载解压至本地。
2. 打开 Chromium 系浏览器（如 Microsoft Edge / Google Chrome），在地址栏访问：
   - Edge: `edge://extensions/`
   - Chrome: `chrome://extensions/`
3. 开启页面上的 **“开发人员模式”** (Developer Mode)。
4. 点击 **“加载解压缩的扩展”** (Load unpacked)。
5. 选择本项目所在根目录。
6. 打开或刷新优酷播放页面（`https://v.youku.com/`），视频暂停时即可自动净化悬浮图层。

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
├── LICENSE                       # MIT 开源协议
└── README.md                     # 说明文档与免责声明
```

---

## 📄 License

[MIT License](LICENSE)
