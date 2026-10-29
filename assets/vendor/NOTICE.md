# 第三方资源说明（assets/vendor）

## l2d-widget.min.js

| 项 | 值 |
|---|---|
| 文件 | `assets/vendor/l2d-widget.min.js` |
| 来源 | npm 包 [`l2d-widget`](https://www.npmjs.com/package/l2d-widget) 的 `dist/index.min.js` |
| 版本 | **0.1.2** |
| 上游仓库 | https://github.com/hacxy/l2d-widget （作者 Hacxy，文档站 https://l2d-widget.hacxy.cn ） |
| 许可证 | MIT —— 全文见同目录 [`LICENSE-l2d-widget.txt`](./LICENSE-l2d-widget.txt) |
| 是否改动 | **未做任何修改**，与 npm 发布产物逐字节一致 |
| SHA256 | `63b28d73b69abe6822905f006d7437344d5cdbca087d99503fcf5fdd6741c7ac` |
| 体积 | 659445 字节 |

MIT 许可证要求「所有副本或实质部分都必须附带版权声明和许可声明」，所以本目录保留上游
LICENSE 全文，而不是只在 README 里提一句。

### 重新获取与校验

```powershell
# 拉取上游发布产物
Invoke-WebRequest "https://cdn.jsdelivr.net/npm/l2d-widget@0.1.2/dist/index.min.js" -OutFile l2d-widget.min.js

# 校验指纹应与上表一致
(Get-FileHash l2d-widget.min.js -Algorithm SHA256).Hash.ToLower()
```

### 不要把它声明回 npm 依赖

运行时只认这个 vendor 文件（`window.L2D_WIDGET`），全仓没有任何 `require/import 'l2d-widget'`。
`package.json` 曾声明过该依赖，但升级 npm 包**不会**更新 vendor，两份会静默漂移，
所以已移除，保持仓库内只有这一份拷贝。

需要升版时：手工替换本文件 + 同步更新上面的版本号与 SHA256。

### ⚠️ 这个 bundle 里不只有 MIT 代码

`l2d-widget` 自身是 MIT，但它把上游依赖 [`l2d`](https://github.com/hacxy/l2d) 以及
**Live2D Cubism 2 运行时**一起打包进了这个 min.js（文件开头那一大段 `_$MT` / `_$5S`
风格的混淆代码就是 Cubism 2 SDK 的框架部分，bundle 内还保留了 `www.live2d.com` 字样）。
那部分归 **Live2D Inc. 的 SDK / 开放素材许可**约束，不是 MIT 授权范围。

本项目作为桌面应用运行时依赖分发，属于 SDK 许可通常覆盖的用途，但**商用或对外分发前请对照
Live2D 官方 SDK 使用条款自行确认**，不要以为整个 659KB 都能按 MIT 随意处置。

## 模型素材（不在本目录）

Live2D 模型（含官方免费样本素材 tororo）**不随仓库分发**，需要时执行 `npm run fetch-models`
拉取到 `assets/models/`（已列入 `.gitignore`）。版权归 Live2D Inc. 及原改编者所有，
详见根目录 README 的「拉取模型」章节。
