# 桌面精灵 (Desktop Pet)

一个基于 Electron + Live2D 的桌面宠物应用，支持 AI 对话、定时提醒等功能。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-33.0.0-blue.svg)

## ✨ 特性

- 🐱 **Live2D 动态立绘** - 可爱的白猫模型，支持多种动作和表情
- 💬 **AI 智能对话** - 接入 LLM API，支持自然语言交互
- ⏰ **定时提醒** - 上下班、午休等贴心提醒，陪伴你的工作日常
- 🎨 **自定义人设** - 可配置角色名称、性格、口头禅等
- 🔔 **气泡消息** - 待机时随机冒出可爱文案
- 🖱️ **窗口置顶** - 始终显示在桌面最上层，可拖拽移动

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 拉取模型（推荐，离线可用）

默认从远程 CDN 加载 Live2D 模型，断网 / CDN 不可达时狸宝会“消失”。
执行一次下面的命令把模型拉到本地 `assets/models/cat-white/`，之后会**优先用本地模型**：

```bash
npm run fetch-models
```

> **模型素材不随仓库分发**：`assets/models/` 已列入 `.gitignore`，需要时自行执行上面那条命令拉取。
> 狸宝用的白猫底层是 **Live2D 官方免费样本素材 tororo**（`model.json` 里的 `"name":"tororo"`），
> 经 l2d-widget 作者换皮后托管在 `model.hacxy.cn`。素材版权归 Live2D Inc. 及原改编者所有，
> 拉取后请遵守 Live2D 官方素材使用规约。未拉取时应用会回退到 CDN 加载，不影响使用。

### 配置 LLM（可选）

设置环境变量：

```bash
# Windows PowerShell
$env:LLM_API_KEY="your-api-key-here"
$env:LLM_BASE_URL="https://api.openai.com/v1"  # 或其他兼容 API
$env:LLM_MODEL="gpt-3.5-turbo"

# Linux/Mac
export LLM_API_KEY="your-api-key-here"
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-3.5-turbo"
```

或者在应用内通过设置面板配置。

### 运行

```bash
npm start
```

### 构建打包

```bash
npm run dist
```

## 📖 使用说明

### 与狸宝互动

- **点击猫** - 弹出输入框，输入文字后按回车或点击发送
- **再次点击猫** - 收起输入框
- **点击空白处** - 也会收起输入框

### 定时提醒

默认提醒时间：
- 09:30 - 早上上班提醒
- 12:00 - 午饭午休提醒
- 13:30 - 下午上班提醒
- 19:30 - 下班提醒
- 每 50 分钟 - 站立活动提醒

可在设置面板中自定义时间和文案。

### 设置面板

右键托盘图标 → 设置，可配置：
- 形象：模型路径、缩放、置顶、开机自启
- 人设：角色名、性格、语气、口头禅
- 提醒：时间、文案
- 对话：API 配置

### 开机自启

默认开启，注册在当前用户的 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，
重启电脑后狸宝自己回来。可在设置面板或托盘菜单的“开机自启”勾选框关闭。

> 注：开发态自启指向 `node_modules/electron/dist/electron.exe` + 项目路径，
> 删除 `node_modules` 后自启会失效；打包后的 portable exe 不建议开自启（每次运行解压目录不同）。

## 🔧 排查：狸宝没出现在桌面上？

按这个顺序查，每一步都能单独定位一类问题：

```powershell
# 1) 进程在不在（没进程 = 根本没启动，npm start 即可）
Get-Process electron | Where-Object { $_.Path -like '*desktop-pet*' }

# 2) 窗口标题在不在（有进程无标题 = 窗口被 hide 了，点托盘恢复）
Get-Process electron | Where-Object { $_.MainWindowTitle } | Select-Object Id,MainWindowTitle

# 3) 窗口位置是否落在已不存在的屏幕上（双屏/改分辨率后会发生）
Get-Content "$env:APPDATA\desktop-pet\settings.json" -Raw -Encoding UTF8 |
  ConvertFrom-Json | Select-Object -Expand windowPosition
```

仍然不对，带日志启动看渲染链路：

```powershell
$env:ELECTRON_ENABLE_LOGGING="1"; npm start
```

关键日志含义：

| 日志 | 含义 |
|---|---|
| `使用模型源: petres://...` | 走的本地内置模型 ✅ |
| `使用模型源: https://model.hacxy.cn/...` | 本地模型缺失，回退到 CDN |
| `模型源不可用，跳过: ...` | 该源拉不到，自动试下一个 |
| `cat top=... bottom=...` | **猫真的画出来了**（像素级扫描）✅ |
| `[window] 保存的位置 ... 已不在任何屏幕内` | 位置越界，已自动回到主屏右下角 |
| `[tray] 图标缺失或为空` | 托盘图标看不见，运行 `npm run make-icon` |

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用框架
- **Live2D Cubism SDK** - 2D 角色动画渲染
- **l2d-widget** - Live2D Widget 封装
- **Node.js** - 后端逻辑

## 📝 开发说明

### 项目结构

```
desktop-pet/
├── src/
│   ├── main/          # 主进程
│   │   ├── main.js    # 窗口/托盘/自启/本地资源协议
│   │   ├── store.js   # 配置存储
│   │   ├── llm.js     # LLM 对话
│   │   └── reminders.js # 提醒调度
│   ├── renderer/      # 渲染进程
│   │   ├── index.html # 主界面
│   │   ├── app.js     # 应用逻辑
│   │   ├── bubble.js  # 气泡消息
│   │   ├── bubble.css # 气泡样式
│   │   └── settings.* # 设置面板
│   └── preload.js     # 预加载脚本
├── scripts/
│   ├── fetch-models.mjs # 下载 Live2D 模型到 assets/models/
│   └── make-icon.ps1    # 生成托盘图标 assets/icon.png
├── assets/
│   ├── models/        # 本地内置模型（离线兜底）
│   ├── vendor/        # 第三方库
│   └── icon.png       # 托盘图标
└── package.json
```

### 本地模型怎么加载的

l2d-widget 内部用 `fetch()` 拉模型，而 `file://` 页面里 `fetch('file://...')` 会被 Chromium 拦掉。
所以主进程注册了一个特权协议 `petres://`（见 `main.js` 的 `registerResProtocol`），
把 `assets/` 目录映射为 `petres://models/cat-white/model.json`，本地模型才能走通。

### 配置版本管理

`store.js` 中的 `CONFIG_VERSION` 用于管理配置结构变更。当默认配置更新时，递增版本号，旧配置会自动合并新默认值。
注意：设置面板保存时必须把 `configVersion` 原样写回，否则每次启动都会被当成旧配置，
用户改过的提醒/模型会被默认值覆盖。

两条硬约束（都是踩过的坑）：

1. **迁移只能按版本精准触发，且只能重置“由代码维护”的默认项**。像 `llm.apiKey` / `llm.baseURL` / `llm.model`
   这类用户自己填的值不能碰——曾因为迁移把自建网关的模型改回 `gpt-3.5-turbo`，直接导致对话不可用。
2. **读盘失败时禁止写回**。`getAll()` 解析失败会降级返回默认值，如果此时还允许 `setAll()` 落盘，
   就会把用户的完整配置整片冲掉。现在会先把坏文件备份为 `settings.json.bad-<内容哈希>`（同一份坏内容只备一份），
   然后拒绝写入，设置面板会提示“保存失败”而不是误报“已保存”。

> 改 `settings.json` 不要用 PowerShell `Set-Content -Encoding UTF8`，它会写 BOM。
> 现在 BOM 已被兼容，但手写 JSON 仍建议用 `[IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false)))`。

## 🔒 安全说明

- API Key 通过环境变量或设置面板配置，不会硬编码在代码中
- 设置文件存储在用户数据目录，不包含在版本控制中
- 建议不要将包含真实 API Key 的配置文件提交到公共仓库

## 📄 许可证

MIT License

> 注意区分三层许可：本仓库代码为 MIT；`assets/vendor/l2d-widget.min.js` 是上游 MIT 产物
> （许可证全文与来源指纹见 [assets/vendor/NOTICE.md](./assets/vendor/NOTICE.md)）；
> 而这个 bundle 里打包的 **Live2D Cubism 运行时**、以及 `npm run fetch-models` 拉取的
> **模型素材**，都归 Live2D Inc. 的许可约束，不在 MIT 范围内。

## 🙏 致谢

- [Live2D](https://www.live2d.com/) - 2D 动画技术（Cubism 运行时与样本素材受 Live2D 官方许可约束）
- [l2d-widget](https://github.com/hacxy/l2d-widget) - Live2D Widget 实现（Hacxy，MIT）
- [Electron](https://www.electronjs.org/) - 桌面应用框架

---

**Enjoy your desktop companion! 🐱✨**
