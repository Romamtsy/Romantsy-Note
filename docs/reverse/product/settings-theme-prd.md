# 设置与主题 域逆向 PRD

> 生成日期：2026-05-30
> 目标域：`settings-theme`
> 项目类型：fullstack（桌面端为主，前端视角）
> 代码版本：基于 `main` @ `92e125c7`
> 口径：以"实现现状"为准，对未实现/死代码明确标注缺口

## 目录

1. 概述
2. 功能需求
3. 状态机
4. 交互规范
5. 非功能需求
6. 风险与依赖
7. 附录：发现的问题

---

## 1. 概述

### 1.1 业务背景

支撑域：集中管理应用配置（通用/AI/同步/网络/系统）、15 套主题与自定义主题、暗色模式、i18n、自动更新、代理、错误上报。设计系统权威源为 `DESIGN.md`。

### 1.2 目标用户

| 角色 | 说明 | 核心操作 |
|------|------|---------|
| 所有用户 | 个性化与配置 | 主题、语言、字号 |
| 进阶用户 | 网络/更新 | 代理、检查更新 |

### 1.3 页面清单

| 入口 | 位置 | 说明 |
|------|------|------|
| 设置模态框 | Ribbon/菜单 | `SettingsModal.tsx`（720px，左导航右内容） |
| 更新弹窗 | 设置/自动 | `UpdateModal.tsx` |
| 更新检查器 | 弹窗内 | `UpdateChecker.tsx` |

---

## 2. 功能需求

### 2.1 设置面板（FR-01｜func_code: `func_settings`）

**功能描述**：模态框 5 个可见 tab：general / ai / sync / network / system。

**业务规则**：
1. `TAB_ORDER` 不含 `account`，且 `renderContent` 对 account 返回 null（`SettingsModal.tsx:19,30-36,76-77`）。
2. 通用：主题/语言/编辑模式/块编辑/字号（`GeneralSection.tsx:20-322`）。
3. 系统：版本、更新、索引诊断、VSCode 扩展、关于（`SystemSection.tsx:11-77`）。
4. 代理配置**双写**（`useUIStore` 持久化 + IPC）（`ProxySection.tsx:14-44`）。

**交互行为**：

| 维度 | 描述 | 代码位置 |
|------|------|---------|
| 弹窗生命周期 | 打开状态被排除持久化，rehydrate 强制 false | `useUIStore.ts:264-289` |

**验收标准**：
- [ ] 打开设置显示 5 个 tab。
- [ ] 切换 tab 显示对应内容。

### 2.2 主题（FR-02｜func_code: `func_theme`）

**功能描述**：15 套内置主题 + 用户主题（vault `.lumina/themes/*.json`）+ 新建/编辑/删除；暗色模式切换。

**业务规则**：
1. 15 套：基础 11（default/ocean/forest/lavender/rose/amber/mint/indigo/coffee/nord/mono）+ 高级 4（cyberpunk/dracula/solarized/gruvbox）（`themes.ts:160-610`）。
2. `ThemeColors` 41 个 token（含 Markdown/语义/Diff）（`themes.ts:6-52`）。
3. `applyTheme` 把 token 写到 `:root` CSS 变量（`themes.ts:613-709`）。
4. 暗色切换 toggle `document.documentElement.classList('dark')` 并重应用主题（`useUIStore.ts:142-158`）。
5. 用户主题 CRUD 用**旧 Tauri 命令名**，Electron 下失败（`themePlugin.ts:95,103,112`）。
6. 外观崩溃恢复：启动时若存在 crash flag，清插件样式恢复基础主题（`App.tsx:425-444`）。
7. `applyTheme` 每次全量 setProperty 60+ 变量，无 diff（缺口）。

**验收标准**：
- [ ] 选择主题后全局配色变化。
- [ ] 暗色模式切换正常。
- [ ] 自定义主题创建/编辑/删除（**旧命令名，未达标**）。
- [ ] 外观插件崩溃后自动恢复。

### 2.3 i18n（FR-03｜func_code: `func_i18n`）

**功能描述**：切换语言，系统语言检测。

**业务规则**：
1. **实际 4 种语言**：zh-CN / zh-TW / en / ja（`i18n/index.ts:6,14-19`）。
2. 切换时同步重翻译默认 Slash 命令（`useLocaleStore.ts:48-78`）。
3. 系统语言检测（`i18n/index.ts:32-40`）。
4. **多处硬编码**（插件设置/索引诊断/VSCode 扩展/图谱）。

**验收标准**：
- [ ] 切换语言后界面文案变化。
- [ ] 系统语言自动检测。

### 2.4 更新（FR-04｜func_code: `func_update`）

**功能描述**：检查更新、下载（进度）、跳过版本、安装重启；macOS 用自研无签名更新器。

**业务规则**：
1. 检查重试 3 次（1s→8s）；下载重试 3 次（1.5s→12s，120s 超时）（`useUpdateStore.ts:16-19`；`UpdateChecker.tsx:25-29`）。
2. 启动延迟 5s 自动检查（`App.tsx:373-377`）。
3. 检查冷却 24h（`useUpdateStore.ts:333`），UI 未暴露。
4. 可恢复下载由 `VITE_RESUMABLE_UPDATER_ENABLED` 控制（`useUpdateStore.ts:615-621`）。
5. 发布源 GitHub Releases（`electron-builder.yml:8-12`）。

**验收标准**：
- [ ] 检查更新显示可用/最新。
- [ ] 下载显示进度，安装重启。

### 2.5 错误上报与系统（FR-05｜func_code: `func_error_system`）

**功能描述**：blocker 错误横幅、transient toast、错误持久化 ndjson、诊断导出。

**业务规则**：
1. 分级：blocker→sticky banner（`useErrorBanner.ts:25-38`）、transient→toast（`toastBridge.ts:16-22`）、background→日志。
2. 持久化 `<vault>/.lumina/logs/errors.ndjson`，10MiB 轮转 `.1`（`persistence.ts:32,38-94`）。
3. **`useErrorStore` 无 UI 消费方**（第三套通道）（缺口）。
4. **无系统托盘、无 globalShortcut**（仅窗口级快捷键）（缺口）。
5. **错误 `cause` 未脱敏落盘**（缺口）。

**验收标准**：
- [ ] blocker 错误显示红条。
- [ ] transient 错误显示 toast。
- [ ] 诊断导出生成文件。

---

## 3. 状态机

### 3.1 更新安装阶段

`UpdateInstallPhase`：`idle | downloading | verifying | installing | ready | error | cancelled`（`useUpdateStore.ts:34-41`）。

### 3.2 主题模式

`ThemeMode = all | light | dark`（`themeRuntime.ts:1`）。

### 3.3 错误级别

`ErrorSeverity = blocker | transient | background`（`errors/types.ts:11-17`）。

---

## 4. 交互规范

### 4.1 加载与骨架屏策略

| 区块 | 加载方式 | 代码位置 |
|------|---------|---------|
| 更新下载 | 进度条 | `UpdateChecker.tsx:241-408` |
| 索引诊断 | 进度条 | `IndexDiagnosticsSection.tsx:20` |
| 代理测试 | success/error 文案 | `ProxySection.tsx:52-56` |

### 4.2 空状态设计

| 区块 | 空状态 | 代码位置 |
|------|-------|---------|
| 用户主题目录缺失 | 静默跳过 | `themePlugin.ts:95-100` |

### 4.3 错误状态设计

| 场景 | 展示方式 | 代码位置 |
|------|---------|---------|
| blocker | sticky 红条 | `useErrorBanner.ts:25` |
| transient | sonner toast | `toastBridge.ts:16` |
| 更新失败 | 本地 checkError + reportOperationError（双重） | `UpdateChecker.tsx` |
| 位置不可写 | `locationNotWritable` | `UpdateChecker.tsx:69-72` |

### 4.4 数据展示格式规范

| 数据类型 | 格式规则 | 代码位置 |
|---------|---------|---------|
| 索引状态 | 中文硬编码（尚未完成/索引中/已完成/待构建） | `IndexDiagnosticsSection.tsx:22-82` |
| 更新阶段 | `descIdle/descUpToDate/...` | `UpdateChecker.tsx:247-256` |

---

## 5. 非功能需求

### 5.1 性能要求

- `applyTheme` 全量 setProperty（60+ 变量），无 diff。
- 更新检查/下载重试策略。

### 5.2 可观测

- 错误 ndjson 10MiB 轮转。
- **缺口**：cause 未脱敏。

---

## 6. 风险与依赖

### 6.1 前置依赖

| 依赖项 | 类型 | 说明 |
|--------|------|------|
| electron-updater | 开源库 | 自动更新 |
| GitHub Releases | 外部服务 | 发布源 |
| 本地文件系统 | 系统 | 主题/日志 |

### 6.2 已知风险与约束

| 风险/约束 | 影响 | 现有处理 / 建议 |
|---------|------|--------------|
| 自定义主题旧命令名 | 功能失败 | 迁移到新 IPC 封装 |
| Account tab 空壳 | 许可证无入口 | 恢复 |
| i18n 硬编码 | 多语言不完整 | 补 key |
| 代理双真源 | 状态不一致 | 单一真源 |
| 三套错误通道 | 维护混乱 | 收敛 |
| 无托盘/系统快捷键 | 后台能力受限 | 按需补 |

---

## 7. 附录：发现的问题

| 级别 | 类型 | 影响范围 | 发现路径（文件:行） | 问题描述 |
|------|------|---------|-------------------|---------|
| P1 | 功能失败 | 自定义主题 | `themePlugin.ts:95,103,112,173,184,214` | 使用旧 Tauri 命令名，Electron 下 CRUD 失败 |
| P1 | 功能不可达 | Account | `SettingsModal.tsx:19,30-36,76-77` | account tab 空壳不渲染 |
| P1 | 安全 | 错误日志 | `errors/persistence.ts:96-116` | `cause` 含原始 response body 未脱敏落盘 |
| P2 | i18n | 索引诊断/插件/VSCode | `IndexDiagnosticsSection.tsx:24`；`PluginSection.tsx:158`；`VscodeAiExtensionsSection.tsx:203-436` | 硬编码中英文 |
| P2 | 双真源 | 代理 | `ProxySection.tsx:14-44`；`useUIStore.ts` | 持久化 + IPC 两处真源 |
| P2 | 通道重叠 | 错误 | `useErrorStore.ts:38-93` | 无 UI 消费方，三套通道并存 |
| P2 | 双重提示 | 更新 | `UpdateChecker.tsx` | 更新失败同时走全局 error 与本地 checkError |
| P2 | 缺失 | 系统 | `electron/main/index.ts:7,114-123` | 无系统托盘、无 globalShortcut |
| P3 | 性能 | 主题 | `themes.ts:635-708` | 全量 setProperty 无 diff |
| P3 | 竞态 | 主题 | `useUIStore.ts:152-166,264-275` | 三处各自 applyTheme + reapply |
| P3 | 构建脆弱 | i18n | `useCommandStore.ts:56` | `require("./useLocaleStore")` 在 ESM 下脆弱 |
