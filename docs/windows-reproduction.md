# Romantsy-Note Windows 复现手册

这份文档用于从全新 Windows 环境复现 Romantsy-Note。原项目许可证和署名必须保留；本仓库的 Romantsy 改造属于二次开发、复现文档、诊断 UI 和演示体验增强。

## 1. 基础环境

建议版本：

- Node.js 20+ 或 22+
- Git
- Rust stable，安装时选择 `x86_64-pc-windows-msvc`
- Visual Studio Build Tools，勾选 `Desktop development with C++`
- Python 3，用于 native dependency 构建
- Bun，用于构建 `thirdparty/opencode`

验证命令：

```powershell
node -v
npm -v
git --version
rustc --version
cargo --version
python --version
bun --version
```

## 2. 下载代码

```powershell
git clone https://github.com/blueberrycongee/Lumina-Note.git D:\Lumina-Note
cd D:\Lumina-Note
npm install
```

如果使用 Romantsy 二次开发分支，先切到你自己的分支再安装依赖。

## 3. 准备 opencode 子项目

首次复现时必须准备 `thirdparty/opencode`，否则会报：

```text
opencode server bundle missing at thirdparty\opencode\packages\opencode\dist\node\node.js
```

执行：

```powershell
git clone https://github.com/anomalyco/opencode thirdparty/opencode
cd thirdparty/opencode
bun install --registry=https://registry.npmjs.org
cd D:\Lumina-Note
npm run opencode:bundle
```

如果 `bun install` 因 node-gyp 或 Python 报错，先确认 `python --version` 可用，再重新执行 `bun install`。

## 4. 启动开发环境

PowerShell 下推荐显式使用 `npm.cmd`：

```powershell
cd D:\Lumina-Note
npm.cmd run dev
```

成功时会看到：

```text
electron main process built successfully
electron preload scripts built successfully
dev server running for the electron renderer process at http://localhost:5174/
starting electron app...
```

注意：`localhost:5174` 是 renderer 调试页面。真实桌面体验以自动弹出的 Electron 窗口为准。

## 5. 功能验收

启动后建议按这个顺序检查：

1. 欢迎页显示 `Romantsy-Note` 和圆形图标。
2. 点击“生成演示笔记库”，自动创建并打开 `Documents\Romantsy-Demo-Vault`。
3. 打开设置 -> 系统，确认能看到 `RAG 索引诊断`。
4. 打开设置 -> 插件，确认能看到 `插件安全模式`。
5. 打开 AI 面板，确认顶部能看到 Provider 状态卡。
6. 如果没有配置模型，状态卡应提示未完成配置。

## 6. 常见问题

### npm run tauri dev 报 Missing script

这个项目当前是 Electron + Vite，不是 Tauri 启动方式。正确命令是：

```powershell
npm.cmd run dev
```

### opencode bundle missing

说明 `thirdparty/opencode` 没准备好，回到第 3 步执行 `bun install` 和 `npm run opencode:bundle`。

### Electron 窗口空白或打不开

先查看终端里是否有 `UnhandledPromiseRejectionWarning`。如果出现路径相关错误，优先检查：

- `out/main/index.js` 是否已重新构建
- `thirdparty/opencode/packages/opencode/dist/node/node.js` 是否存在
- 是否误删了 `build-resources/icon.ico` 或 `public/romantsy.png`

### AI 不工作

先看 AI 面板 Provider 状态卡：

- 未配置：进入设置 -> AI，配置 Provider、Model 和 API Key
- Ollama：确认本地 Ollama 服务已启动
- 启动失败：检查网络代理、API Key、opencode server 日志

## 7. 推荐学习入口

- `src/App.tsx`：应用启动、Vault 打开、Demo Vault 创建入口
- `src/components/onboarding/WelcomeScreen.tsx`：首次启动引导
- `src/components/layout/MainAIChatShell.tsx`：AI 面板和 Provider 状态卡
- `src/stores/useNoteIndexStore.ts`：本地 Markdown 索引
- `src/components/settings/IndexDiagnosticsSection.tsx`：索引诊断 UI
- `src/components/settings/PluginSection.tsx`：插件安全模式
- `electron/main/index.ts`：Electron 主进程入口
