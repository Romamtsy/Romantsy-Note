# Romantsy-Note 二次开发贡献记录

这份记录用于区分原开源项目能力和 Romantsy 二次开发新增内容。原许可证、原作者署名和历史贡献不应删除。

## 已完成改造

- 品牌改造：应用名、窗口标题、构建配置、欢迎页标题和图标切换为 `Romantsy-Note`。
- 圆形图标：新增 `public/romantsy.png`、`public/romantsy.svg`、`build-resources/icon.png`、`build-resources/icon.ico`。
- 首次启动引导：欢迎页新增“生成演示笔记库”，用于快速创建可演示的 Demo Vault。
- Demo Vault：新增 `src/services/demoVault.ts`，自动生成复现清单、RAG 测试素材、Agent 任务样例和源码阅读路线。
- AI Provider 状态卡：AI 面板空状态下展示未配置、已配置、运行中、启动失败等状态。
- RAG 索引诊断：系统设置页新增文件数、索引进度、标签数、失败文件和手动重建索引入口。
- 插件安全模式：插件设置页新增生产可见的安全模式入口，可快速禁用外观插件样式。
- Cloud/License 收敛：账号页从设置导航中隐藏；Lumina Cloud Provider 默认不展示，除非显式设置 `VITE_ROMANTSY_ENABLE_CLOUD=1`。
- Windows 复现文档：新增 `docs/windows-reproduction.md`，补齐 Rust、Bun、Python、opencode bundle 和开发启动步骤。
- Electron 命名收敛：新增 `hostFetch` / `host-invoke` / `isHostBridgeAvailable`，把业务代码从 Tauri 迁移遗留命名中解耦；旧 Tauri 形状入口仅作为兼容别名保留。

## 后续可继续增强

- Demo Vault 支持从欢迎页选择生成位置，而不是默认写入 Documents。
- Provider 状态卡接入主进程 opencode server 健康检查，区分 server 未启动、启动中、运行中。
- RAG 索引诊断增加耗时、跳过大文件数量、最近失败原因和导出诊断报告。
- 设置页增加“教学演示模式”，一键打开 Demo Vault、AI 面板和索引诊断。
- 插件安全模式记录最近导致崩溃的插件，并提供一键禁用所有第三方插件。
- 将 Cloud/License 改造成自有 Romantsy 后端前，保持默认隐藏，避免误导用户。
