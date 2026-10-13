# Romantsy-Note 项目上下文

> 本文件集中定义 Romantsy-Note 的项目专属上下文，供逆向文档生成时读取。
> 由 hc-delivery `reverse` skill 方法论驱动，基于代码仓库实际状态逆向生成。
> **基线说明**：本文档以"实现现状"为准，对未实现/死代码/空实现明确标注缺口。

---

## 0. 代码仓库

| 属性 | 值 |
|------|-----|
| 仓库本地路径 | `.`（本仓库根） |
| 远程地址 | `https://github.com/blueberrycongee/Romantsy-Note` |
| 默认分支 | `main` |
| 文档基线 commit | `92e125c7` |
| 基线日期 | 2026-05-30 |
| 应用版本 | `1.4.4`（`package.json:3`） |

### 依赖项目（跨项目文档引用）

| 依赖项目标识 | 依赖关系 | 说明 |
|-------------|---------|------|
| `lumina-cloud` | 外部闭源服务 | Lumina Cloud 商业后端（许可证签发、AI 网关），契约见 `cloud/CONTRACT.md`，本仓库不包含其实现 |
| `opencode` | 内嵌运行时 | 通过 `@opencode-ai/sdk` 内嵌为 Electron 主进程内 HTTP 服务，源码在构建期从 pinned commit 拉取 |

### 部署基线关联

无外部部署项目依赖（`server/` 为仓库内自部署中继，非外部部署包）。

## 1. 项目基本信息

| 属性 | 值 |
|------|-----|
| 项目名称 | Romantsy-Note（本地优先 AI 笔记应用） |
| 项目类型 | fullstack（Electron 桌面应用：前端渲染进程 + Node 主进程 + Rust 自部署后端） |
| 语言 | TypeScript 5.6（前端/主进程）、Rust（`server/`）、Swift（iOS）、Kotlin（Android） |
| 框架 | Electron 41 + electron-vite 5 + Vite 7；Rust axum + sqlx（后端） |
| UI 框架 | React 18 + Tailwind CSS 3 + 自研 UI 组件（`src/components/ui`） |
| 状态管理 | Zustand 5（约 30+ store） |
| 路由 | 无 URL 路由；基于"标签页 + 视图"的客户端状态机（`useFileStore` / `useUIStore`） |
| ORM / 数据访问 | 前端直读本地文件系统（经 IPC）；后端 sqlx + SQLite |
| 数据库 | SQLite（仅 `server/` 自部署后端）；桌面端数据为本地 Markdown 文件 |
| 缓存 | 内存缓存（`pdfDataCache`、wiki 预览 FIFO、note index） |
| 消息队列 | 无；实时协作走 WebSocket（Yjs CRDT，仅后端） |
| 构建工具 | npm + electron-vite + electron-builder；后端 cargo |
| 部署方式 | 桌面：electron-builder 打包 dmg/nsis/AppImage；后端：Docker + Caddy |

## 2. 业务域列表

> 本项目的"业务域"按用户可感知的功能面划分，而非后端微服务。共 9 个现役域。

| 域标识 | 中文名称 | 说明 | 核心逻辑模式 | 主入口特征 | 主目录 / 文件模式 | 是否聚合域 |
|--------|---------|------|-------------|-----------|--------------------|-----------|
| `ai-agent` | AI Agent 与对话 | 内嵌 opencode agent 运行时、多 provider 配置、聊天/会话/技能/工具审批 | 事件驱动（SSE 流式） | AI 主标签页 / 输入栏 | `src/components/ai/**`, `src/components/chat/**`, `src/components/layout/MainAIChatShell.tsx`, `src/stores/useOpencodeAgent.ts`, `electron/main/agent-v2/**` | 否 |
| `editor-markdown` | 编辑器与 Markdown | 三模式编辑、格式化、分屏、标签页、自动保存、vault 工作区 | 状态机（视图模式） | 编辑器主区 | `src/editor/**`, `src/services/markdown/**`, `src/stores/useFileStore.ts`, `src/stores/useSplitStore.ts` | 否 |
| `wiki-graph` | 双向链接与知识图谱 | WikiLink 解析/预览/反链/标签/大纲、全局与局部图谱、wiki 自动合成（后端） | 图计算 + Canvas 渲染 | 右栏 Links/Tags / graph 标签页 | `src/components/effects/KnowledgeGraph.tsx`, `src/components/effects/LocalGraph.tsx`, `src/stores/useNoteIndexStore.ts`, `electron/main/wiki/**` | 否 |
| `search` | 搜索与命令面板 | 命令面板、全局内容搜索、Cmd+K 命令菜单 | 索引查询 | 快捷键触发浮层 | `src/components/search/**`, `src/components/ui/command-menu*.tsx`, `src/stores/useCommandMenu.ts` | 否 |
| `pdf-annotation` | PDF 阅读与批注 | PDF 渲染、目录、全文搜索、高亮/下划线/笔记、批注落 Markdown、发送到 AI | 状态机（阅读/批注） | PDF 标签页 | `src/components/pdf/**`, `src/services/pdf/**`, `src/stores/usePDFStore.ts`, `src/stores/usePDFAnnotationStore.ts` | 否 |
| `sync-cloud` | 同步与云 | WebDAV 同步、自部署账号/工作区、Lumina Cloud 许可证、Rust 中继与协作、移动网关 | 状态机（同步阶段） | 设置 → 同步 tab | `src/services/webdav/**`, `src/services/cloudSync/**`, `src/services/luminaCloud/**`, `server/**`, `cloud/**` | 是（含多个子域） |
| `image-gen` | 图片与图像生成 | 图片查看器、图片管理器、孤儿图片识别、粘贴插图、AI 生图 | 资源索引 + 状态机 | image 标签页 / 聊天图片模式 | `src/components/images/**`, `src/services/assets/**`, `src/services/imageGen/**`, `electron/main/agent-v2/image-providers/**` | 否 |
| `plugins-extensions` | 插件与扩展 | 插件加载/权限/UI 注入/主题/编辑器扩展、VSCode AI 扩展桥 | 运行时沙箱（约定式） | 扩展中心标签页 | `src/services/plugins/**`, `src/components/plugins/**`, `packages/plugin-api/**`, `electron/main/handlers/plugins.ts`, `electron/main/vscode-extensions/**` | 否 |
| `settings-theme` | 设置与主题 | 设置面板、15 套主题与自定义主题、暗色模式、i18n、更新、代理、错误上报 | 配置中心 | 设置模态框 | `src/components/settings/**`, `src/config/themes.ts`, `src/stores/useUIStore.ts`, `src/stores/useUpdateStore.ts`, `src/services/errors/**` | 否 |

### 聚合大域拆分记录

`sync-cloud` 为聚合大域，包含 5 个相对独立的子域（因均围绕"数据同步/远程访问"叙事，本次逆向合并为一份 PRD，子域在 PRD 内分节）：

| 子域 | 说明 | 实现状态 |
|------|------|---------|
| WebDAV 同步 | 桌面↔WebDAV 文件双向同步 | **空实现**（Electron 迁移后编排未迁移） |
| Cloud Sync | 自部署账号/工作区 | 部分实现（客户端有，服务端有，同步落回 WebDAV 空实现） |
| Lumina Cloud 许可证 | 离线许可证校验 + AI 网关 provider | **UI 被孤立、公钥占位** |
| Rust 中继与协作 | 自部署后端：账号/组织/项目/任务/批注/通知/WebDAV/Yjs 协作/公开站点 | 后端完整实现 |
| 移动网关 | QR+token 配对、LAN 直连 | **IPC 命令缺失** |

### 推荐域执行顺序（按业务核心度排列）

1. `ai-agent` — 产品核心，最大域，依赖 opencode 运行时
2. `editor-markdown` — 产品核心，所有内容入口
3. `wiki-graph` — 产品差异化能力
4. `sync-cloud` — 数据持久化与商业化叙事
5. `plugins-extensions` — 扩展性
6. `pdf-annotation` — 采集能力
7. `image-gen` — 资源管理
8. `search` — 效率工具
9. `settings-theme` — 支撑域

## 3. 模块结构

| 构建模块 | 职责 | 关注点 |
|---------|------|--------|
| `src/`（renderer） | React 渲染进程，UI 与业务编排 | Zustand 状态、组件、编辑器、服务层 |
| `electron/main/` | Electron 主进程，本地宿主能力与 opencode 运行时 | IPC handler、文件系统、AI server、插件加载 |
| `electron/preload/` | contextBridge 安全桥（含 Tauri 兼容 shim） | `host-invoke` 命令分发、事件总线 |
| `server/`（Rust） | 自部署中继/协作/WebDAV 后端 | axum 路由、sqlx、JWT、Yjs CRDT |
| `packages/` | 共享包（类型与 UI SDK） | `plugin-api`、`plugin-ui`、`shared`（云契约） |
| `mobile/` | iOS（SwiftUI）/ Android（Kotlin+Compose）伴生应用 | 配对与 LAN 同步 |
| `cloud/` | 商业化文档（PRD/CONTRACT/TASKS） | 契约唯一源 |
| `resources/` | 内置插件、技能、agent 资源 | 打包 `extraResources` |

### 代码扫描范围

```
src/                 → 渲染进程（React + TS）
electron/            → Electron 主进程 + preload
server/              → Rust 自部署后端
packages/            → 共享包
mobile/              → 移动端原生应用
cloud/               → 商业化契约文档
```

### 代码路径约定

| 代码层级 | 路径模式 |
|---------|---------|
| 渲染入口 | `src/main.tsx`, `src/App.tsx` |
| 页面/视图组件 | `src/components/{domain}/**`, `src/editor/**` |
| 布局与主壳 | `src/components/layout/**` |
| 自定义 Hook | `src/hooks/**`, `src/components/layout/hooks/**` |
| 服务层 | `src/services/{domain}/**` |
| 状态管理 | `src/stores/use*.ts` |
| 类型定义 | `src/types/**`, 各模块内联类型 |
| 主进程 IPC handler | `electron/main/handlers/**`, `electron/main/agent-v2/ipc-dispatch.ts` |
| 主进程装配 | `electron/main/index.ts`, `electron/main/ipc.ts` |
| 后端路由 | `server/src/routes.rs`, `server/src/main.rs` |
| 后端数据模型 | `server/src/models.rs`, `server/src/db.rs` |

### 域映射约定

| 域标识 | 主目录模式 | 入口类型 | 共享文件判定 | 备注 |
|-------|-----------|---------|-------------|------|
| `ai-agent` | `src/components/ai/**`, `src/components/chat/**`, `src/stores/useOpencodeAgent.ts`, `electron/main/agent-v2/**` | 组件/事件流 | `useAIStore`（config）、`useErrorStore` | 与 opencode 运行时强耦合 |
| `editor-markdown` | `src/editor/**`, `src/services/markdown/**` | 组件 | `useFileStore` 被多域共享 | |
| `wiki-graph` | `src/components/effects/**`, `src/components/wiki/**`, `src/stores/useNoteIndexStore.ts` | 组件 | `useNoteIndexStore` 与 search 共享 | |
| `search` | `src/components/search/**`, `src/components/ui/command-menu*.tsx` | 组件/浮层 | `useNoteIndexStore`、`useCommandStore` | |
| `pdf-annotation` | `src/components/pdf/**`, `src/services/pdf/**` | 组件 | `useFileStore` 标签页 | |
| `sync-cloud` | `src/services/{webdav,cloudSync,luminaCloud}/**`, `server/**` | 服务/组件 | `useFileStore.syncMobileWorkspace` | 聚合域 |
| `image-gen` | `src/components/images/**`, `src/services/assets/**` | 组件 | `useFileStore` | |
| `plugins-extensions` | `src/services/plugins/**`, `packages/plugin-api/**` | 运行时 | `usePluginStore` | |
| `settings-theme` | `src/components/settings/**`, `src/config/themes.ts` | 组件 | `useUIStore` 被全域共享 | |

### 域建模模式

| 属性 | 值 |
|------|---|
| 当前模式 | `direct`（按功能面直接划分，无聚合拆分） |
| 当前映射版本 | `v1` |
| 最近确认时间 | 2026-05-30（用户确认：以「图片与图像生成」替换已删除的闪卡域） |
| 旧产物是否需重建 | 否（首次生成） |

## 4. 数据源

| 数据源 | 用途 | 配置键前缀 |
|--------|------|-----------|
| 本地文件系统（vault） | 笔记 Markdown、PDF、图片、导出、技能、插件、主题 | 无（用户选择的 vault 路径） |
| `userData` 目录 | provider 设置、图片 provider 设置、插件（user/global）、opencode 配置 | `lumina-provider-settings.json` 等 |
| OS Keychain | API Key、云 token、许可证 | `lumina:provider:apikey:*`, `lumina:cloud:*` |
| SQLite（仅后端） | 账号/组织/项目/任务/批注/通知/站点 | `server/` |
| localStorage | Zustand persist（UI/文件/命令/插件/更新等） | `lumina-*` |

## 5. 编码规范

### 序列化

- JSON（`JSON.stringify/parse`）；YAML frontmatter 用 `yaml` 库（`src/services/markdown/frontmatter.ts`）。

### 日志规范

**Logger 获取方式**

- 渲染进程：`console.*`；错误统一经 `src/services/errors/reporter.ts` 结构化上报。
- 主进程：`console.*` 经 `log-forward.ts` 转发到渲染进程 `main-console` 事件。

**日志格式**

| 属性 | 值 |
|------|-----|
| 格式类型 | 纯文本（错误另落 ndjson） |
| 链路追踪 ID | 后端 `x-request-id`；前端无 |

**日志级别使用规则**

| 级别 | 使用场景 |
|------|---------|
| error | 不可预期异常、外部服务不可用 |
| warn | 可预期业务异常、降级 |
| info | 关键操作、状态变更 |
| debug | 开发调试（生产关闭） |

**脱敏规则**

| 敏感字段类型 | 掩码方式 |
|-------------|---------|
| API Key / Token / 密码 | 完全不输出（仅存 keychain） |
| 许可证 | 仅存 keychain，不落日志 |

> **已知缺口**：`src/services/errors/persistence.ts:96-116` 将原始 `error.cause`（可能含 response body）写入磁盘 ndjson，未脱敏。

### 全局业务不变量

| 不变量 | 约束 | 适用范围 | 违反后果 |
|--------|------|---------|---------|
| 本地优先 | 笔记数据默认留在本地，是否发送给模型由用户决定 | 全域 | 隐私承诺失效 |
| 密钥不落明文 | API Key / Token / 许可证仅存 OS keychain，不写 JSON/localStorage | 全域 | 凭据泄露 |
| vault 边界 | 所有 vault 文件操作必须限制在当前 vault 根内 | 插件/文件域 | 路径穿越 |
| 无品牌色 | 界面无品牌主色，颜色仅承载语义状态 | UI 全域 | 设计系统违背 |
| 单信号选中 | 选中态只用一个信号（bg + 字重） | UI 全域 | 设计系统违背 |

## 6. 规范文件引用

| 文件 | 内容 |
|------|------|
| `DESIGN.md` | 设计系统权威源（颜色/排版/组件/动效规则） |
| `PRODUCT.md` | 产品定位、用户、品牌人格、反例 |
| `AGENTS.md`（根） | 仓库级 AI agent 协作约定（若存在） |
| `cloud/CONTRACT.md` | 云 API 线级契约 |
| `docs/plugin-ecosystem.md` | 插件开发者指南 |
| `docs/mobile-wifi-protocol.md` | 移动网关协议 |

## 7. 参考文档

> 路径相对于业务代码仓库根目录。

| 文档 | 路径 | 用途 |
|------|------|------|
| 用户流程 | `docs/user-flow.md` / `.zh-CN.md` | 用户旅程 |
| 自部署指南 | `docs/self-host.md` / `.zh-CN.md` | 中继部署 |
| 云同步开发 | `docs/cloud-sync-dev.md` | 同步开发 |
| 设计系统 | `docs/design-system.md` | UI 规范 |
| 插件生态 | `docs/plugin-ecosystem.md` | 插件开发 |
| 外观插件指南 | `docs/appearance-plugin-guide.md` | 主题插件 |
| 云商业化 PRD | `cloud/PRD.md` | 商业化范围 |
| 云契约 | `cloud/CONTRACT.md` | API 契约 |
| 云任务清单 | `cloud/TASKS.md` | 商业化进度 |
| 学习记录 | `学习记录.md` | 项目开发笔记 |

## 8. 特殊模式

### 双运行时并存（迁移遗留）

- 现役 AI 运行时为内嵌 opencode server（`electron/main/agent-v2/`）；旧直连 LLM 运行时（`src/services/llm/index.ts`）已改为抛错桩，但仍有调用方（选区工具栏、语音笔记），属死路径。

### Tauri → Electron 兼容 shim

- `electron/preload/index.ts` 暴露 `__TAURI_INTERNALS__` 等 shim，渲染层大量代码仍以 `invoke('命令名')` 调用，主进程 `ipc.ts` 做命令名路由。部分旧命令名（如 `read_text_file`）在新 handler 中已改名，导致 `themePlugin.ts` 等调用失败。

### 约定式插件沙箱

- 插件入口以 `new Function("api","plugin", ...)` 在渲染进程内执行，权限为约定式（`api.*` 层校验），插件可绕过直接访问 DOM/fetch。

## 9. 环境配置

| 环境 | profile / 标识 | 配置文件 | 用途 |
|------|---------------|---------|------|
| 开发 | dev | `.env.example`, `electron.vite.config.ts` | electron-vite dev |
| 云开关 | `VITE_ROMANTSY_ENABLE_CLOUD` | 构建期环境变量 | 控制 Lumina Cloud provider 可见性 |
| 可恢复更新 | `VITE_RESUMABLE_UPDATER_ENABLED` | 构建期环境变量 | 控制可恢复下载 |
| 后端 | env | `server` 环境变量（`LUMINA_JWT_SECRET` 等） | 自部署服务 |

### 标准命令集

| 命令类型 | 命令 | 说明 | 前置条件 |
|---------|------|------|---------|
| 安装依赖 | `npm install` | 安装前端/主进程依赖 | Node.js 22+ |
| 类型检查 | `npm run typecheck` | `tsc --noEmit` ×2 | — |
| 编译构建 | `npm run build` | typecheck + electron-vite build | — |
| 本地启动 | `npm run dev` | electron-vite dev | — |
| 全量测试 | `npm run test:run` | vitest --run | — |
| 监听测试 | `npm test` | vitest watch | — |
| 打包 | `npm run dist:mac` / `dist:win` / `dist:linux` | electron-builder | — |
| 后端运行 | `npm run server:dev` | `cd server && cargo run` | Rust 工具链 |
| 后端测试 | `npm run server:test` | `cd server && cargo test` | — |
| 后端构建 | `cd server && cargo build --release` | 输出可执行文件 | — |

## 10. 代码分析入口

| 入口类型 | 扫描方式 | 完整目录 / 文件模式 | 文件名模式 / 关键特征 |
|---------|---------|----------------------|----------------------|
| 应用装配入口 | React 根挂载 | `src/main.tsx`, `src/App.tsx` | `createRoot`, `App` |
| 主进程装配入口 | Electron app 生命周期 | `electron/main/index.ts` | `app.whenReady`, `createWindow` |
| IPC 命令路由 | 命令字符串分发 | `electron/main/ipc.ts`, `electron/main/handlers/**`, `electron/main/agent-v2/ipc-dispatch.ts` | `host-invoke`, `isAgentCommand` |
| 标签页/视图入口 | Zustand 标签类型 | `src/stores/useFileStore.ts` | `TabType`, `openFile`, `openAIMainTab` |
| 状态管理入口 | Zustand store 定义 | `src/stores/use*.ts` | `create<...>()(persist(...))` |
| 服务层入口 | 领域服务模块 | `src/services/**` | `*.ts` |
| 编辑器入口 | CodeMirror 集成 | `src/editor/**` | `EditorState`, `EditorView` |
| 图谱入口 | Canvas 渲染 | `src/components/effects/{KnowledgeGraph,LocalGraph}.tsx` | `CanvasRenderingContext2D`, `PhysicsEngine` |
| 后端路由 | axum Router | `server/src/main.rs`, `server/src/routes.rs` | `.route(`, `.route_service(` |
| 后端数据模型 | sqlx 表定义 | `server/src/db.rs`, `server/src/models.rs` | `CREATE TABLE`, `#[derive(...)]` |
| 插件契约 | 类型声明 | `packages/plugin-api/index.d.ts` | `LuminaPluginApi` |
| 云契约 | 类型声明 | `packages/shared/src/cloud.ts` | `AuthSession`, `WorkspaceSummary` |
| 构建依赖 | package manifest | `package.json`, `server/Cargo.toml` | `dependencies` |
| 错误边界 | 错误上报 | `src/services/errors/**` | `ErrorEnvelope`, `reporter` |

## 11. 测试框架约定

| 属性 | 值 |
|------|-----|
| 测试框架 | Vitest 4（前端/主进程）、cargo test（后端） |
| 断言库 | Vitest `expect` + `@testing-library/jest-dom` |
| Mock 库 | Vitest `vi.mock` |
| 测试命名 | `*.test.ts` / `*.test.tsx`；repro 用 `*.repro.test.ts`；e2e 用 `*.e2e.test.ts` |
| 覆盖率 | `@vitest/coverage-v8`（无强制阈值） |

## 12. 非功能性需求预算（NFR）

| 维度 | 指标 | 目标值 | 当前实测值 | 度量方式 |
|------|------|--------|-----------|---------|
| 响应时间 | 编辑器输入延迟 | ≤ 16ms/帧 | — | DevProfiler |
| 响应时间 | 首 token 延迟 | 受 provider 影响 | — | TypingIndicator 计时 |
| 内存 | 大 vault 索引 | 单文件 ≤ 2MB、总 ≤ 50k 文件 | — | `useNoteIndexStore` 常量 |
| 数据安全 | 密钥保护 | OS keychain | — | `secureStore` / safeStorage |
| 可观测 | 错误持久化 | ndjson 10MiB 轮转 | — | `persistence.ts` |
| 可用性 | 离线可用 | 无网络时本地功能全可用 | — | 本地优先设计 |

---

## 附：逆向过程中的重要现状发现（供各文档引用）

| 编号 | 发现 | 证据 |
|------|------|------|
| F-01 | 闪卡复习功能已整体删除，仅剩类型/i18n/E2E 残骸 | `src/types/flashcard.ts`（保留）；commit `d8367d12` |
| F-02 | 旧直连 LLM 运行时为死路径但仍有调用方 | `src/services/llm/index.ts:93-124`；`SelectionToolbar.tsx:246` |
| F-03 | WebDAV 同步在 Electron 下为空实现 | `electron/main/handlers/webdav.ts:246-270` |
| F-04 | 移动网关 IPC 命令在 Electron 主进程不存在 | `electron/main/ipc.ts:171-215` |
| F-05 | Lumina Cloud 许可证 UI 被孤立（Account tab 不渲染）、公钥为占位符 | `SettingsModal.tsx:19,30-36,76-77`；`PUBLIC_KEY.ts:12` |
| F-06 | i18n 实际 4 种语言（非 README 宣称的 11 种） | `src/i18n/index.ts:6,14-19` |
| F-07 | 自定义 slash command 与 effort/mode 选择 UI 不可达 | `ChatInput.tsx`（死代码）；`useAIStore.ts:1111-1112` |
| F-08 | `ReadingView.tsx` 为死代码，三模式实际均走 CodeMirror | `src/editor/ReadingView.tsx`（仅测试引用） |
| F-09 | wiki 自动合成后端默认关闭且无 UI | `electron/main/wiki/settings-store.ts:26` |
| F-10 | 用户自定义主题用旧 Tauri 命令名，Electron 下失败 | `src/config/themePlugin.ts:95,103,112` |
| F-11 | 插件以 `new Function` 全权执行，权限仅约定式 | `src/services/plugins/runtime.ts:588-616` |
| F-12 | 三套错误通道并存，`useErrorStore` 无 UI 消费方 | `src/stores/useErrorStore.ts`（无渲染引用） |
