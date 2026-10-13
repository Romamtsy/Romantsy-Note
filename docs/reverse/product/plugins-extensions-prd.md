# 插件与扩展 域逆向 PRD

> 生成日期：2026-05-30
> 目标域：`plugins-extensions`
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

开发者预览版插件生态：从 workspace / user / built-in 目录加载插件，提供运行时权限模型与丰富的 UI 注入 API（Ribbon/设置区块/命令/主题/样式/编辑器扩展/渲染钩子）。另有 VSCode AI 扩展桥，用于在应用内运行 Codex / Claude Code 扩展。

关键安全事实：插件入口以 `new Function("api","plugin", ...)` 在渲染进程内执行，权限为**约定式**（仅 `api.*` 层校验），插件可绕过直接访问 DOM/fetch。

### 1.2 目标用户

| 角色 | 说明 | 核心操作 |
|------|------|---------|
| 插件开发者 | 扩展功能/外观 | 开发插件、热重载、脚手架 |
| 普通用户 | 安装/启停插件 | 扩展中心、外观安全模式 |
| AI 扩展用户 | 用 Codex/Claude Code | 安装/激活扩展 |

### 1.3 页面清单

| 入口 | 位置 | 说明 |
|------|------|------|
| 扩展中心 | extensions-center 标签页 | `ExtensionsCenterModal.tsx` |
| 插件设置区块 | 设置内注入 | `InstalledPluginsModal.tsx`（旧） |
| VSCode AI 扩展 | 设置 → 系统 | `VscodeAiExtensionsSection.tsx` |
| 插件视图 | 标签页 | `PluginViewPane.tsx` |

---

## 2. 功能需求

### 2.1 插件加载与生命周期（FR-01｜func_code: `func_load_plugin`）

**功能描述**：启动/刷新时从 4 级目录加载插件，校验清单，执行 setup，注册 UI/能力。

**业务规则**：
1. 发现顺序：`<vault>/.lumina/plugins` → `<userData>/plugins` → `<userData>/global-plugins` → bundled `resources/plugins`，同 id 先到先得（`handlers/plugins.ts:103-179`）。
2. 校验：id 正则、semver、entry 相对路径防 `..`（`plugins.ts:311-392`）。
3. 无效清单保留并带 `validation_error`（`plugins.ts:150-160`）。
4. API 版本常量 `HOST_API_VERSION="1"`（`runtime.ts:68`），兼容性判定 `getCompatibilityIssue`（`runtime.ts:296-304`）。
5. 入口 `new Function` 执行，要求导出 setup 函数（`runtime.ts:588-616`）。
6. 卸载清理 dispose/unsubscribers/UI/tab/command/layout/theme/style/render/editor（`runtime.ts:1419-1456`）。
7. 签名 `source:version:entry_path` 用于增量热重载（`runtime.ts:1479-1481`）。

**验收标准**：
- [ ] 有效插件被加载并执行 setup。
- [ ] 无效清单显示 validation_error 且不加载。

### 2.2 权限模型（FR-02｜func_code: `func_plugin_permission`）

**功能描述**：插件声明权限，敏感 API 调用前校验。

**业务规则**：
1. 权限清单枚举 `PluginPermission`（`types/plugins.ts:1-35`）。
2. 通配符匹配 `*`、`namespace:*`（`runtime.ts:259-265`）。
3. 别名归一化（workspace:read→vault:read 等）（`runtime.ts:267-277`）。
4. 每个敏感 API 前 `requirePermission`，缺失抛错（`runtime.ts:624-628`）。
5. 路径越权防护：所有 vault/workspace 操作限制在当前 workspace 内（`runtime.ts:630-645`）。
6. **权限为约定式**，插件可绕过（缺口）。

**验收标准**：
- [ ] 未声明权限调用敏感 API 抛错。
- [ ] 越界路径访问被拒绝。

### 2.3 UI 注入与扩展点（FR-03｜func_code: `func_plugin_ui`）

**功能描述**：插件注册 Ribbon 项、设置区块、状态栏、上下文菜单、命令面板分组、Slash 命令、全局热键、样式、主题、编辑器扩展、渲染钩子、HTML 视图。

**业务规则**：
1. 各注册 API 见 `runtime.ts:670-1415`。
2. `injectStyle` 支持 `{css, scopeId, global, layer}`，样式层 `base < theme < component < override`（`styleRuntime.ts:1-3`）。
3. `registerSlashCommand` 写入 `useCommandStore`，检测与内置冲突（`runtime.ts:670-705`）——但消费方 `ChatInput.tsx` 为死代码。
4. 插件 HTML 视图交互通过 `data-plugin-action`/`data-plugin-form`（`PluginViewPane.tsx:10-82`）。
5. `ui.notify` 仅派发 DOM 事件，未见 toast 消费方（缺口）。

**验收标准**：
- [ ] 插件注册的 Ribbon 项出现在界面。
- [ ] 插件注入样式生效且可隔离。
- [ ] 插件自定义主题可应用。

### 2.4 扩展中心与 VSCode 扩展桥（FR-04｜func_code: `func_extensions_center`）

**功能描述**：扩展中心统一管理 Plugins 与 Skills；VSCode AI 扩展桥安装/激活 Codex/Claude Code 扩展。

**业务规则**：
1. 扩展中心含 Plugins/Skills 两个 tab（`ExtensionsCenterModal.tsx:44-165`）。
2. 外观安全模式：一键停用外观插件 + 卸载全部插件样式（`PluginSection.tsx:153-193`）。
3. VSCode 桥支持 marketplace / open-vsx / github-release 三源（`vscodeExtensions.ts:276-279`）。
4. 兼容性 profile 内置 4 个（Codex/Claude Code × stable/preview），宿主引擎 `1.98.0`（`profiles.ts:75-246,73`）。
5. 激活守卫：平台不匹配/能力缺失/smoke 未过/未验证需 allowUnverified（`vscodeExtensions.ts:218-267`）。
6. **webview 使用 `allow-same-origin`+`allow-scripts`+`unsafe-eval`**，沙箱弱（缺口）。

**验收标准**：
- [ ] 扩展中心显示插件与技能列表。
- [ ] 安装并激活 VSCode AI 扩展。
- [ ] 外观安全模式恢复基础主题。

---

## 3. 状态机

### 3.1 插件运行时状态

`PluginRuntimeStatus`：`enabled | loaded | error | incompatible | reason | error_detail`（`types/plugins.ts:71-82`）。

### 3.2 插件分类

`PluginCategory = functional | appearance | system`（`usePluginStore.ts:51-65`）。

### 3.3 VSCode 兼容性

`CompatibilityStatus`：`stable | preview | unknown-extension | unknown-version | incompatible-vscode-engine | invalid-package`（`profiles.ts:56-62`）。

---

## 4. 交互规范

### 4.1 加载与骨架屏策略

| 区块 | 加载方式 | 代码位置 |
|------|---------|---------|
| 插件列表 | loading 旋转 | `PluginSection.tsx:131-151` |
| VSCode 扩展 | loading 旋转 + 结果条 | `VscodeAiExtensionsSection.tsx:49-83` |

### 4.2 空状态设计

| 区块 | 空状态文案 | 代码位置 |
|------|----------|---------|
| 插件列表 | `noPluginsFound` / `noPluginsMatch` | `PluginSection.tsx:196-202` |
| VSCode webview | 无 webview 提示 | `VscodeAiExtensionsSection.tsx:424-436` |

### 4.3 错误状态设计

| 场景 | 展示方式 | 代码位置 |
|------|---------|---------|
| 插件运行错误 | 红条 + error_detail | `PluginSection.tsx:416-430` |
| 清单错误 | validation_error | `plugins.ts:150-160` |
| VSCode 激活守卫 | 平台/能力/验证提示 | `VscodeAiExtensionsSection.tsx:294-345` |

### 4.4 操作反馈规范

| 场景 | 反馈 | 代码位置 |
|------|------|---------|
| 安全模式 | 受影响数量 | `PluginSection.tsx:163-170` |
| 插件热重载 | 运行时重载 | `runtime.ts:1479` |
| 安装 VSCode 扩展 | action 结果条 | `VscodeAiExtensionsSection.tsx:191-207` |

---

## 5. 非功能需求

### 5.1 性能要求

- 增量热重载（签名比对）。
- 样式冲突检测（`styleRuntime.ts:34-176`）。

### 5.2 安全要求

- 权限声明 + API 层校验 + 路径越权防护。
- **缺口**：`new Function` 全权执行；VSCode webview 弱沙箱 + `unsafe-eval`。

---

## 6. 风险与依赖

### 6.1 前置依赖

| 依赖项 | 类型 | 说明 |
|--------|------|------|
| `@lumina/plugin-api` | 内部包 | 插件类型契约 |
| `@lumina/plugin-ui` | 内部包 | 主题预设与 CSS 变量工具 |
| VSCode Marketplace/OpenVSX | 外部服务 | 扩展下载 |

### 6.2 已知风险与约束

| 风险/约束 | 影响 | 现有处理 / 建议 |
|---------|------|--------------|
| 插件沙箱弱 | 恶意插件可越权 | 迁移到 worker/隔离上下文 |
| VSCode webview 弱沙箱 | 安全 | 收紧 CSP |
| 两套插件管理 UI 并存 | 维护混乱 | 删除旧 `InstalledPluginsModal` |
| 权限/类型双份维护 | 漂移 | 统一到 plugin-api |
| Slash 命令消费方死代码 | 功能不可达 | 修复或下线 |

---

## 7. 附录：发现的问题

| 级别 | 类型 | 影响范围 | 发现路径（文件:行） | 问题描述 |
|------|------|---------|-------------------|---------|
| P2 | 安全 | 插件运行时 | `runtime.ts:588-616` | `new Function` 全权执行，权限仅约定式，可绕过 |
| P2 | 安全 | VSCode webview | `VscodeAiExtensionsSection.tsx:429`；`profiles.ts:143` | `allow-same-origin`+`unsafe-eval`，沙箱弱 |
| P2 | 死代码 | 插件管理 | `InstalledPluginsModal.tsx` | 旧弹窗无生产引用，文档仍指向 |
| P2 | 未挂载 | 插件样式开发 | `PluginStyleDevSection.tsx` | 文档承诺但组件无引用 |
| P2 | 功能不可达 | Slash 命令 | `runtime.ts:670-705`；`ChatInput.tsx` | 插件注册的 slash 命令无消费方 |
| P2 | i18n | 插件设置 | `PluginSection.tsx:158-161,256` | 安全模式中文硬编码 |
| P3 | 类型不一致 | 插件契约 | `packages/plugin-api/index.d.ts:170-174` vs `runtime.ts:921-925` | `registerTabType.actions` SDK 缺失 |
| P3 | 契约文档缺失 | 上下文菜单 | `docs/plugin-ecosystem.md:129` vs `runtime.ts:830-835` | run 实际收到 `{x,y,targetTag}` 未文档化 |
| P3 | 重复维护 | 默认禁用插件 | `usePluginStore.ts:67-71` vs `runtime.ts:73-78` | 两处各维护一份 |
| P3 | 条款未持久化 | VSCode Marketplace | `VscodeAiExtensionsSection.tsx:40-41` | 勾选状态每次重置 |
