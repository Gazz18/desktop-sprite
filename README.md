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
- 形象：模型路径、缩放、置顶
- 人设：角色名、性格、语气、口头禅
- 提醒：时间、文案
- 对话：API 配置

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
│   │   ├── main.js    # 窗口管理
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
├── assets/
│   └── vendor/        # 第三方库
└── package.json
```

### 配置版本管理

`store.js` 中的 `CONFIG_VERSION` 用于管理配置结构变更。当默认配置更新时，递增版本号，旧配置会自动合并新默认值。

## 🔒 安全说明

- API Key 通过环境变量或设置面板配置，不会硬编码在代码中
- 设置文件存储在用户数据目录，不包含在版本控制中
- 建议不要将包含真实 API Key 的配置文件提交到公共仓库

## 📄 许可证

MIT License

## 🙏 致谢

- [Live2D](https://www.live2d.com/) - 2D 动画技术
- [l2d-widget](https://github.com/niconi123/l2d-widget) - Live2D Widget 实现
- [Electron](https://www.electronjs.org/) - 桌面应用框架

---

**Enjoy your desktop companion! 🐱✨**
