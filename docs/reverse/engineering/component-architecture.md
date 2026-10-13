# Romantsy-Note 组件架构

> 生成日期：2026-05-30
> 基线 commit：`92e125c7`（`main`）
> 范围：渲染进程组件体系（`src/components/**`, `src/editor/**`）

---

## 1. 组件分层

| 层 | 目录 | 说明 |
|----|------|------|
| 应用壳 | `src/App.tsx` | 顶层布局装配 |
| 布局 | `src/components/layout/**` | Sidebar / RightPanel / Ribbon / TabBar / SettingsModal |
| 基础 UI | `src/components/ui/**` | Button / Row / Popover / Dialog / Field / Tooltip / command-menu |
| 域组件 | `src/components/{domain}/**` | 按业务域组织 |
| 编辑器 | `src/editor/**` | CodeMirror 集成与扩展 |
| 效果/图谱 | `src/components/effects/**` | 全局/局部图谱 |
| 功能模块 | `src/features/**` | conversation-export / vscode-ai-extensions |

---

## 2. 应用壳装配（`src/App.tsx`）

`App.tsx` 聚合以下主要区域：

| 区域 | 组件 | 代码位置 |
|------|------|---------|
| 左侧栏 | `Sidebar`（文件树 / 搜索 / 插件面板） | `App.tsx` |
| 右面板 | `RightPanel`（chat/outline/backlinks/tags/vscode-ai） | `RightPanel.tsx` |
| 顶部 Ribbon | `Ribbon` | `Ribbon.tsx` |
| 标签栏 | `TabBar` | `TabBar.tsx` |
| 编辑器主区 | `Editor` / `SplitEditor` / `PDFViewer` / `ImageViewer` / `ImageManagerView` | `App.tsx:1179-1210` |
| 浮层 | `CommandPalette` / `CommandMenu` / `KnowledgeGraph` | `App.tsx` |
| 插件宿主 | `PluginShellSlotHost` / `PluginViewPane` / `PluginContextMenuHost` / `PluginPanelDock` | `App.tsx:1111,1219-1240,1363-1366` |

初始化职责：插件运行时、更新检查、错误上报 wiring、启动外观崩溃恢复（`App.tsx:366-444`）。

---

## 3. 基础 UI 组件（`src/components/ui/`）

设计系统要求（`DESIGN.md`）在此落地：

| 组件 | 文件 | 关键约定 |
|------|------|---------|
| Button | `button.tsx` | `rounded-ui-md`(6px)，primary/ghost/destructive，hover 无 scale |
| Row | `row.tsx` | 列表项原语：icon + title + trailing；选中 = bg-accent + 字重 500 |
| Popover | `popover.tsx` | `shadow-elev-2`，锚点缩放，140ms 进 / 100ms 出 |
| Dialog | `dialog.tsx` | `shadow-elev-3`，Esc 关闭 |
| Field | `field.tsx` | 1px border，focus ring |
| Tooltip | `tooltip.tsx` | 350ms hover 延迟，自动附加 |
| command-menu | `command-menu.tsx`, `command-menu-provider.tsx` | Cmd+K 分组命令 |

动效 token：`--motion-fast`(100ms) / `--motion-open`(140ms) / `--motion-exit`(100ms) / `--motion-content`(200ms)。

---

## 4. 域组件结构

### 4.1 AI Agent（`components/ai`, `components/chat`, `components/layout`）

| 组件 | 职责 | 位置 |
|------|------|------|
| `MainAIChatShell` | 聊天主壳（97KB，输入/队列/导出/图片模式/调试） | `layout/MainAIChatShell.tsx` |
| `ChatToolbar` | 新建/导出/历史入口 | `layout/ChatToolbar.tsx` |
| `ChatHistorySidebar` | 会话历史 | `layout/ChatHistorySidebar.tsx` |
| `useSessionManagement` / `useSkillSearch` | 会话/技能 hook | `layout/hooks/` |
| `AgentMessageRenderer` | 消息/工具/思考渲染（82KB） | `chat/AgentMessageRenderer.tsx` |
| `StreamingMessage` / `TypingIndicator` | 流式渲染 | `chat/StreamingMessage.tsx` |
| `ModelEffortPicker` | 模型选择 | `chat/ModelEffortPicker.tsx` |
| `AISettingsModal` | AI 设置 | `ai/AISettingsModal.tsx` |
| `ImageModelsSettings` | 图像 provider 设置 | `ai/ImageModelsSettings.tsx` |
| `SkillManagerModal` | 技能管理（被重定向） | `ai/SkillManagerModal.tsx` |

**死代码**：`chat/ChatInput.tsx`、`chat/CommandManagerModal.tsx`。

### 4.2 编辑器（`src/editor/`）

| 组件 | 职责 | 位置 |
|------|------|------|
| `Editor` | 编辑器容器、模式、工具栏、局部图谱 | `editor/Editor.tsx` |
| `CodeMirrorEditor` | CM6 主体（6361 行） | `editor/CodeMirrorEditor.tsx` |
| `ReadingView` | **死代码** | `editor/ReadingView.tsx` |
| `SlashMenu` | 斜杠 AI 菜单 | `editor/components/SlashMenu.tsx` |
| `blockEditor` / `slashCommand` | 扩展 | `editor/extensions/` |
| `tableInlineMarkdownPlugin` | 表格行内 MD | `editor/tableInlineMarkdownPlugin.ts` |

### 4.3 图谱（`components/effects`, `components/wiki`）

| 组件 | 职责 | 渲染 |
|------|------|------|
| `KnowledgeGraph` | 全局图谱（1510 行） | Canvas 2D + `PhysicsEngine` |
| `LocalGraph` | 局部图谱 | Canvas 2D |
| `WikiLinkHoverCard` | 链接悬停预览 | React |
| `knowledgeGraphData` / `localGraphData` | 数据构建 | 纯函数 |

### 4.4 PDF（`components/pdf/`）

`PDFViewer`（容器）→ `PDFCanvas`（渲染/选择）→ `PDFToolbar`（翻页/缩放/搜索插槽）+ `PDFOutline`（目录）+ `PDFSearch` + `AnnotationLayer` + `AnnotationPopover`。
**未使用**：`PDFThumbnails`。

### 4.5 图片（`components/images/`）

`ImageViewer` / `ImageThumbnail` / `ImageManagerView`（管理器）。

### 4.6 设置（`components/settings/`）

`GeneralSection` / `SystemSection` / `ProxySection` / `WebDAVSettings` / `MobileGatewaySection` / `MobileOptionsSection` / `IndexDiagnosticsSection` / `PluginSection` / `PluginStyleDevSection`（未挂载）/ `VscodeAiExtensionsSection` / `LicenseSettings`（孤立）/ `CloudUsagePanel`（孤立）/ `ThemeEditor` / `UpdateChecker`。

### 4.7 扩展（`components/extensions`, `components/plugins`, `components/vscode-ai`）

`ExtensionsCenterModal`（新入口）/ `InstalledPluginsModal`（旧，死）/ `PluginViewPane` / `VscodeAiExtensionSidebarPanel`。

---

## 5. 组件设计约束（来自 DESIGN.md）

| 约束 | 说明 |
|------|------|
| 单字体 | chrome 全部 Inter；JetBrains Mono 仅代码 |
| 13px 规则 | 桌面控件正文 13px |
| 单信号选中 | bg-accent + 字重 500，禁止叠加左色条/勾/加粗 |
| 无品牌色 | 主色为无彩色；颜色仅承载语义 |
| 无背景模糊 | popover 实心 |
| 无弹跳缓动 | spring `cubic-bezier(0.2,0.9,0.1,1)` 进，ease-out 出 |
| 画布安静 | 编辑区无渐变/装饰 |
| 减少动效 | `prefers-reduced-motion` 收敛为透明度 |

---

## 6. 组件级风险

| 风险 | 证据 | 影响 |
|------|------|------|
| 巨型组件 | `MainAIChatShell.tsx`(97KB)、`CodeMirrorEditor.tsx`(6361 行)、`AgentMessageRenderer.tsx`(82KB) | 可维护性 |
| 死组件 | `ReadingView`, `ChatInput`, `CommandManagerModal`, `PDFThumbnails`, `InstalledPluginsModal`, `PluginStyleDevSection` | 混淆 |
| 孤立组件 | `LicenseSettings`, `CloudUsagePanel` | 功能不可达 |
| 硬编码文案 | Provider 状态卡/图谱/插件/图片查看器 | i18n 不完整 |
| 设计系统违背 | 图谱创建连接中文 toast、局部图谱固定色 | 一致性 |
