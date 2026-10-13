# Romantsy-Note 业务功能清单

> 生成日期：2026-05-30
> 项目类型：fullstack（桌面端为主，前端视角 + 后端服务）
> 基线 commit：`92e125c7`（`main`）
> 扫描范围：`src/`（渲染进程）+ `electron/`（主进程）+ `server/`（Rust 后端）
> **口径**：以"实现现状"为准。标注 ✅ 已实现 / ⚠️ 部分实现或有缺口 / ❌ 空实现或不可达。

## 概要

| 统计项 | 数量 |
|--------|------|
| 业务域 | 9 个 |
| 功能模块 | 44 个 |
| 用户功能点 | 180+ 个 |
| 主进程 IPC 命令组 | 14 组 |
| 后端 HTTP/WS 路由 | 40+ 条 |
| 已废弃域 | 1 个（闪卡复习，已删除，见附录） |

## 域索引

| 序号 | 域标识 | 中文名称 | 功能模块数 | 实现状态 |
|-----|--------|---------|-----------|---------|
| 1 | `ai-agent` | AI Agent 与对话 | 8 | ✅ 主体已实现，部分 UI 不可达 |
| 2 | `editor-markdown` | 编辑器与 Markdown | 6 | ✅ 主体已实现 |
| 3 | `wiki-graph` | 双向链接与知识图谱 | 5 | ✅ 前端已实现，后端 wiki 未启用 |
| 4 | `search` | 搜索与命令面板 | 3 | ⚠️ 搜索实现可用但无排序、索引搜索死代码 |
| 5 | `pdf-annotation` | PDF 阅读与批注 | 4 | ✅ 主体已实现，部分控件缺失 |
| 6 | `sync-cloud` | 同步与云 | 5 | ❌ WebDAV/移动网关空实现；后端完整 |
| 7 | `image-gen` | 图片与图像生成 | 4 | ✅ 主体已实现，枚举死值多 |
| 8 | `plugins-extensions` | 插件与扩展 | 4 | ✅ 已实现，沙箱弱 |
| 9 | `settings-theme` | 设置与主题 | 5 | ✅ 主体已实现，Account tab 空壳 |

---

## 1. AI Agent 与对话（`ai-agent`）

> 主入口：Ribbon 机器人按钮 → AI 主标签页；输入栏内联于 `MainAIChatShell.tsx`。

### 1.1 AI 对话主体

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开 AI 主标签页 | 操作 | 点击 Ribbon 机器人按钮 | `Ribbon.tsx:380`, `useFileStore.ts:1434` | P0 | ✅ |
| 2 | 发送消息（Agent 任务） | 操作 | 输入框回车/发送按钮 | `MainAIChatShell.tsx:1078`, `useOpencodeAgent.ts:1304` | P0 | ✅ |
| 3 | 流式接收回复 | 展示 | SSE 事件驱动 | `useOpencodeAgent.ts:795-1021` | P0 | ✅ |
| 4 | 停止生成 | 操作 | 点击停止按钮 | `MainAIChatShell.tsx:2401`, `useOpencodeAgent.ts:1453` | P0 | ✅ |
| 5 | 新建会话 | 操作 | 工具栏 `+` | `ChatToolbar.tsx:101`, `useOpencodeAgent.ts:1485` | P0 | ✅ |
| 6 | 切换会话 | 操作 | 打开历史侧栏选择 | `ChatHistorySidebar.tsx`, `useSessionManagement.ts:17` | P0 | ✅ |
| 7 | 删除会话 | 操作 | 历史侧栏删除 | `ChatHistorySidebar.tsx:81` | P1 | ⚠️ 无二次确认 |
| 8 | 消息队列（发送中追加） | 操作 | 生成中继续输入 | `MainAIChatShell.tsx:441-533` | P1 | ✅ |
| 9 | 重试状态倒计时 | 展示 | 服务端 retry 事件 | `useOpencodeAgent.ts:890`, `MainAIChatShell.tsx:2011` | P1 | ✅ |
| 10 | Provider 状态卡 | 展示 | 空会话欢迎区 | `MainAIChatShell.tsx:267-312` | P1 | ⚠️ 硬编码中文 |

### 1.2 模型与 Provider 配置

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 选择模型 | 操作 | 输入栏模型选择器 | `ModelEffortPicker.tsx:128` | P0 | ✅ |
| 2 | 配置 provider API Key | 操作 | AI 设置弹窗 | `AISettingsModal.tsx:180`, `useAIStore.ts:288` | P0 | ✅ |
| 3 | 配置 baseURL（兼容端点） | 操作 | AI 设置弹窗 | `AISettingsModal.tsx`, `provider-bridge.ts:573` | P1 | ✅ |
| 4 | 测试 provider 连接 | 操作 | AI 设置弹窗 | `electron/main/agent-v2/providers/test-connection.ts` | P1 | ✅ |
| 5 | 11 个聊天 provider | 展示 | AI 设置列表 | `providers/registry.ts:59-242` | P0 | ✅ |
| 6 | Lumina Cloud provider | 操作 | 有 license 时可见 | `services/llm/providers/luminaCloud.ts:49` | P2 | ⚠️ UI 孤立、公钥占位 |
| 7 | effort / thinking 选择 | 操作 | — | `useAIStore.ts:1111` | P2 | ❌ 类型存在但 UI 不可达 |

### 1.3 会话导出

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 进入导出选择模式 | 操作 | 工具栏下载按钮 | `ChatToolbar.tsx:82` | P1 | ✅ |
| 2 | 勾选/全选消息 | 操作 | 选择列表 | `MainAIChatShell.tsx:1772` | P1 | ✅ |
| 3 | 导出为 Markdown | 操作 | 确认导出 | `exportUtils.ts:180`, `MainAIChatShell.tsx:809` | P1 | ✅ |
| 4 | 导出为 PDF/HTML | 操作 | — | — | P2 | ❌ 不存在 |

### 1.4 文件提及与技能

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | @ 提及文件 | 操作 | 输入 `@` | `MainAIChatShell.tsx:2219` | P0 | ✅ |
| 2 | 选择 skill | 操作 | 输入 `/` | `useSkillSearch.ts:16` | P1 | ✅ |
| 3 | 技能管理 | 操作 | 扩展中心 Skills tab | `ExtensionsCenterModal.tsx:44` | P1 | ✅ |
| 4 | 自定义 slash command | 操作 | — | `ChatInput.tsx`（死代码） | P2 | ❌ 不可达 |

### 1.5 工具审批与偏好

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 工具权限审批卡 | 操作 | opencode `permission.asked` | `MainAIChatShell.tsx:1866`, `useOpencodeAgent.ts:1472` | P0 | ✅ |
| 2 | 自动批准开关 | 操作 | AI 设置 | `AISettingsModal.tsx:813`, `useAgentPrefs.ts:31` | P1 | ✅ |
| 3 | 上下文压缩开关 | 操作 | AI 设置 | `AISettingsModal.tsx:813` | P2 | ✅ |
| 4 | Agent Profile 多配置 | 操作 | 设置 → 移动选项 | `useAgentProfileStore.ts:29` | P2 | ✅ |

### 1.6 内联 AI（编辑器内）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 编辑器 slash AI 生成 | 操作 | 编辑器 `/` 菜单 | `SlashMenu.tsx:133`, `slashCommand.ts:693` | P1 | ⚠️ 默认关闭 |
| 2 | 选区 AI（总结/翻译/润色/待办） | 操作 | 选区工具条 | `SelectionToolbar.tsx:467` | P1 | ❌ 调用死路径 |
| 3 | 语音笔记 | 操作 | 语音输入 | `useVoiceNote.ts:187` | P2 | ❌ 调用死路径 |

### 1.7 图片生成模式（聊天内）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 图片模式 pill | 操作 | 欢迎区切换 | `MainAIChatShell.tsx:2461` | P1 | ✅ |
| 2 | 直连生图 | 操作 | 无主模型时生成 | `MainAIChatShell.tsx:1161`, `imageGen/direct.ts:43` | P1 | ✅ |
| 3 | Agent 生图（generate_image 工具） | 操作 | 有主模型时 | `plugin/index.ts:74` | P1 | ✅ |

### 1.8 Agent 运行时（主进程）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 内嵌 opencode server 启动 | 系统 | app ready | `agent-v2/server.ts:1`, `index.ts:142` | P0 | ✅ |
| 2 | provider 设置桥接 | 系统 | 设置变更防抖 | `provider-bridge.ts:372` | P0 | ✅ |
| 3 | 内置技能 image-gen / wiki-sync | 系统 | 构建期拷贝 | `builtin-skills/*/SKILL.md` | P1 | ✅ |
| 4 | 技能 CRUD（写入 vault） | 操作 | 技能管理 | `ipc-dispatch.ts:376` | P1 | ✅ |
| 5 | opencode 路径隔离（XDG） | 系统 | 启动前 | `opencode-xdg.ts:57` | P1 | ✅ |

---

## 2. 编辑器与 Markdown（`editor-markdown`）

### 2.1 编辑模式与格式化

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 三模式切换（live/reading/source） | 操作 | 模式按钮循环 | `Editor.tsx:743`, `CodeMirrorEditor.tsx:4841` | P0 | ✅ |
| 2 | Markdown 格式工具栏 | 操作 | 工具栏按钮 | `Editor.tsx:646-739` | P0 | ✅ |
| 3 | 选区工具条 / 右键菜单 | 操作 | 选中文本 | `SelectionToolbar.tsx`, `SelectionContextMenu.tsx` | P1 | ✅ |
| 4 | 块编辑器 | 操作 | 设置开关 | `blockEditor.ts`, `GeneralSection.tsx:244` | P2 | ⚠️ 默认关 |
| 5 | 斜杠命令菜单 | 操作 | 编辑器输入 `/` | `CodeMirrorEditor.tsx:5179` | P2 | ⚠️ 默认关、未完工 |
| 6 | 内联图片渲染 | 展示 | `![]()` / `![[..]]` | `CodeMirrorEditor.tsx:4382` | P1 | ✅ |
| 7 | LaTeX / KaTeX | 展示 | `$...$` / `$$...$$` | `CodeMirrorEditor.tsx:1211` | P1 | ✅ |
| 8 | Mermaid 图表 | 展示 | ` ```mermaid ` | `CodeMirrorEditor.tsx:1402` | P1 | ✅ |
| 9 | 代码高亮 | 展示 | ` ```lang ` | `CodeMirrorEditor.tsx:2231` | P1 | ✅ |
| 10 | 表格渲染 | 展示 | Markdown 表格 | `tableInlineMarkdownPlugin.ts` | P1 | ✅ |
| 11 | 拖拽文件树插入双链 | 操作 | 拖拽 `lumina-drop` | `CodeMirrorEditor.tsx:6158` | P1 | ✅ |

### 2.2 文件与标签页

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开文件 | 操作 | 文件树/搜索 | `useFileStore.ts:156` | P0 | ✅ |
| 2 | 标签页管理（11 种类型） | 操作 | TabBar | `useFileStore.ts:31`, `TabBar.tsx` | P0 | ✅ |
| 3 | 自动保存（1s 防抖） | 系统 | 停止输入 | `Editor.tsx:599`, `useFileStore.ts:201` | P0 | ✅ |
| 4 | 手动保存 | 操作 | Ctrl/Cmd+S | `App.tsx:846` | P0 | ✅ |
| 5 | 保存状态可视化 | 展示 | 自动 | `Editor.tsx:761` | P1 | ✅ |
| 6 | 导航历史前进/后退 | 操作 | Alt+←/→ | `Editor.tsx:540` | P1 | ✅ |
| 7 | 导出笔记为 PDF | 操作 | 工具栏下载 | `Editor.tsx:793`, `services/pdf/exportPdf.ts` | P1 | ✅ |

### 2.3 分屏

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开分屏（主/次面板） | 操作 | 布局操作 | `SplitEditor.tsx:97` | P1 | ✅ |
| 2 | 水平/垂直切换 | 操作 | 布局操作 | `useSplitStore.ts:13` | P2 | ✅ |
| 3 | PDF 作为次面板 | 操作 | PDF 引用分栏 | `SplitEditor.tsx:122` | P1 | ✅ |

### 2.4 Vault 工作区

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 选择 vault 文件夹 | 操作 | 首次启动/欢迎页 | `WelcomeScreen.tsx:57`, `useFileStore.ts:494` | P0 | ✅ |
| 2 | 大 vault 体积预警 | 展示 | 选择时 | `useFileStore.ts:496` | P1 | ✅ |
| 3 | 创建 .lumina 结构 | 系统 | 选择 vault | `useFileStore.ts:539` | P0 | ✅ |
| 4 | 文件树懒加载 | 展示 | 展开目录 | `useFileStore.ts:615` | P0 | ✅ |
| 5 | 最近 vault（上限 8） | 操作 | 欢迎页 | `useRecentVaultStore.ts:17` | P1 | ✅ |
| 6 | 工作区过大保护 | 系统 | 索引时 | `useFileStore.ts:581` | P1 | ✅ |

### 2.5 Markdown 服务

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | Markdown 渲染管线 | 系统 | 预览/阅读 | `services/markdown/markdown.ts` | P0 | ✅ |
| 2 | frontmatter 解析/更新 | 系统 | 文件读写 | `frontmatter.ts:21` | P1 | ⚠️ 无编辑器 UI |
| 3 | 标题/大纲解析 | 系统 | 右栏大纲 | `headings.ts:50` | P1 | ✅ |
| 4 | slug 生成 | 系统 | 锚点 | `slug.ts:7` | P2 | ✅ |
| 5 | Callout 渲染 | 展示 | `> [!note]` | `markdown.ts:18` | P2 | ✅ |

### 2.6 阅读视图（遗留）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 独立 ReadingView | 展示 | — | `ReadingView.tsx` | P2 | ❌ 死代码（仅测试引用） |

---

## 3. 双向链接与知识图谱（`wiki-graph`）

### 3.1 WikiLink

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | WikiLink 渲染为可点击 | 展示 | `[[Note]]` | `markdown.ts:415`, `CodeMirrorEditor.tsx:4125` | P0 | ✅ |
| 2 | 别名 `[[Note\|alias]]` | 展示 | Markdown | `markdown.ts:415` | P1 | ✅ |
| 3 | 悬停预览卡 | 操作 | 悬停链接 | `WikiLinkHoverCard.tsx:16`, `useWikiLinkHover.ts:14` | P1 | ✅ |
| 4 | Ctrl/Cmd+点击跳转 | 操作 | 点击链接 | `CodeMirrorEditor.tsx:5713` | P0 | ✅ |
| 5 | `[[` 自动补全 | 操作 | 输入 `[[` | — | P2 | ❌ 未实现 |

### 3.2 反链 / 标签 / 大纲

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 反链面板（含上下文行） | 展示 | 右栏 Links | `RightPanel.tsx:25`, `useNoteIndexStore.ts:320` | P0 | ✅ |
| 2 | 标签汇总面板 | 展示 | 右栏 Tags | `RightPanel.tsx:116` | P1 | ✅ |
| 3 | 大纲面板跳转 | 操作 | 右栏 Outline | `RightPanel.tsx:205`, `headings.ts` | P1 | ✅ |
| 4 | 标签点击切换 | 操作 | 点击 `#tag` | `RightPanel.tsx:356` | P2 | ✅ |

### 3.3 知识图谱

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 全局知识图谱 | 展示 | graph 标签页 | `KnowledgeGraph.tsx` | P0 | ✅ |
| 2 | 局部图谱（当前笔记邻域） | 展示 | 编辑器右上角 | `LocalGraph.tsx`, `Editor.tsx:815` | P1 | ✅ |
| 3 | 缩放/平移/选择节点 | 操作 | 鼠标/滚轮 | `KnowledgeGraph.tsx:550` | P1 | ✅ |
| 4 | 图谱内创建连接 | 操作 | 右键菜单 | `KnowledgeGraph.tsx:371` | P1 | ✅ |
| 5 | 图谱内删除连接 | 操作 | 边详情 | `KnowledgeGraph.tsx:394` | P2 | ✅ |
| 6 | 图谱物理布局 | 系统 | 自动 | `PhysicsEngine` `KnowledgeGraph.tsx:550` | P1 | ✅ |
| 7 | 孤立视图 | 操作 | 右键 | `KnowledgeGraph.tsx` | P2 | ✅ |

### 3.4 笔记索引

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 构建笔记索引 | 系统 | vault 变化 | `useNoteIndexStore.ts:148` | P0 | ✅ |
| 2 | 索引诊断面板 | 展示 | 设置 → 系统 | `IndexDiagnosticsSection.tsx:6` | P2 | ⚠️ 中文硬编码 |
| 3 | 手动重建/取消索引 | 操作 | 诊断面板 | `IndexDiagnosticsSection.tsx:20` | P2 | ✅ |

### 3.5 Wiki 自动合成（后端）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | wiki 页面合成 | 系统 | 笔记变更触发 | `electron/main/wiki/synthesizer.ts` | P2 | ❌ 默认关闭、无 UI |
| 2 | wiki lint（断链/孤儿检测） | 系统 | — | `ipc-dispatch.ts:438` | P2 | ❌ 占位实现 |
| 3 | wiki 设置 | 操作 | — | `wiki/settings-store.ts:17` | P2 | ❌ 无渲染层调用 |

---

## 4. 搜索与命令面板（`search`）

### 4.1 命令面板

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开命令面板（command 模式） | 操作 | Ctrl/Cmd+P | `App.tsx:852`, `CommandPalette.tsx` | P0 | ✅ |
| 2 | 打开文件快速切换（file 模式） | 操作 | Ctrl/Cmd+O | `App.tsx:860` | P0 | ✅ |
| 3 | 命令模式/file 模式 Tab 切换 | 操作 | Tab 键 | `CommandPalette.tsx:334` | P1 | ✅ |
| 4 | 键盘导航（↑↓/Enter/Esc） | 操作 | 键盘 | `CommandPalette.tsx:316` | P0 | ✅ |
| 5 | 空查询分组展示 | 展示 | 空输入 | `CommandPalette.tsx:225` | P1 | ✅ |
| 6 | 命令用量统计与 NEW 徽标 | 展示 | 自动 | `CommandPalette.tsx:411`, `commandPaletteUsage.ts` | P2 | ✅ |

### 4.2 全局内容搜索

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开搜索侧栏 | 操作 | Ctrl/Cmd+Shift+F | `App.tsx:877`, `SearchSidebar.tsx` | P0 | ✅ |
| 2 | 内容搜索（250ms 防抖） | 操作 | 输入查询 | `SearchSidebar.tsx:151` | P0 | ✅ |
| 3 | 大小写/正则开关 | 操作 | 搜索选项 | `SearchSidebar.tsx:96` | P1 | ✅ |
| 4 | 命中高亮 | 展示 | 自动 | `SearchSidebar.tsx:305` | P1 | ✅ |
| 5 | 结果跳转定位 | 操作 | 点击结果 | `SearchSidebar.tsx:170`, `CodeMirrorEditor.tsx:5954` | P0 | ✅ |
| 6 | 搜索范围过滤 | 操作 | — | `en.ts:561-572`（文案存在） | P2 | ❌ 未实现 |
| 7 | 替换功能 | 操作 | — | `en.ts`（文案存在） | P2 | ❌ 未实现 |

### 4.3 Cmd+K 命令菜单

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 全局命令菜单 | 操作 | Ctrl/Cmd+K | `command-menu-provider.tsx:22` | P1 | ⚠️ 仅 4 条基线命令 |
| 2 | 分组展示（Actions/Nav/Sessions/Skills/Files） | 展示 | 自动 | `useCommandMenu.ts:10` | P2 | ⚠️ 多数分组恒空 |

---

## 5. PDF 阅读与批注（`pdf-annotation`）

### 5.1 PDF 阅读

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开 PDF 标签页 | 操作 | 文件树 | `useFileStore.ts:37`, `App.tsx:1179` | P0 | ✅ |
| 2 | 翻页（按钮/页码输入） | 操作 | 工具栏 | `PDFToolbar.tsx:39` | P0 | ✅ |
| 3 | 键盘翻页 | 操作 | ←/→/PageUp/Down | `PDFCanvas.tsx:150` | P1 | ✅ |
| 4 | 缩放（预设 50-200%） | 操作 | 工具栏 | `PDFToolbar.tsx:116` | P0 | ✅ |
| 5 | Ctrl/Cmd+滚轮缩放 | 操作 | 滚轮 | `PDFCanvas.tsx:174` | P1 | ✅ |
| 6 | 目录（Outline） | 展示 | 左侧面板 | `PDFOutline.tsx:81` | P1 | ✅ |
| 7 | 全文搜索（上/下一处） | 操作 | 搜索框 | `PDFSearch.tsx:60` | P1 | ✅ |
| 8 | 旋转页面 | 操作 | — | `PDFToolbar.tsx:151` | P2 | ❌ 无 onClick |
| 9 | 适应宽度 | 操作 | — | `PDFToolbar.tsx:136` | P2 | ❌ prop 未传入 |
| 10 | 缩略图导航 | 展示 | — | `PDFThumbnails.tsx` | P2 | ❌ 未使用 |

### 5.2 批注

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 选中文本弹浮层 | 操作 | 鼠标选中 | `PDFCanvas.tsx:69` | P0 | ✅ |
| 2 | 添加高亮 | 操作 | 浮层 | `AnnotationPopover.tsx:58` | P0 | ✅ |
| 3 | 添加下划线 | 操作 | 浮层 | `AnnotationPopover.tsx` | P1 | ✅ |
| 4 | 添加笔记 | 操作 | 浮层展开输入 | `AnnotationPopover.tsx:138` | P1 | ✅ |
| 5 | 5 种颜色 | 操作 | 浮层 | `types/annotation.ts:60` | P1 | ✅ |
| 6 | 批注层叠加显示 | 展示 | 自动 | `AnnotationLayer.tsx:75` | P0 | ✅ |
| 7 | 删除批注（右键确认） | 操作 | 右键 | `AnnotationLayer.tsx:48` | P1 | ✅ |
| 8 | 编辑批注 | 操作 | — | `AnnotationLayer.tsx:42` | P2 | ❌ TODO 空实现 |
| 9 | 批注持久化 Markdown | 系统 | 自动 | `services/pdf/annotations.ts:206` | P0 | ✅ |
| 10 | 批注回跳链接 | 操作 | 点击链接 | `annotations.ts:249`, `SplitEditor.tsx:136` | P1 | ⚠️ 仅分栏生效 |
| 11 | 发送选中内容到 AI | 操作 | 浮层 Sparkles | `AnnotationPopover.tsx:93` | P1 | ✅ |

---

## 6. 同步与云（`sync-cloud`，聚合域）

### 6.1 WebDAV 同步

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 配置 WebDAV 服务器 | 操作 | 设置 → 同步 | `WebDAVSettings.tsx:181` | P0 | ⚠️ 密码跨重启丢失 |
| 2 | 测试连接 | 操作 | 设置按钮 | `handlers/webdav.ts` | P0 | ✅ |
| 3 | 预览同步计划 | 操作 | 设置按钮 | `handlers/webdav.ts:246` | P0 | ❌ 永远返回空计划 |
| 4 | 执行同步 | 操作 | 立即同步 | `handlers/webdav.ts:246` | P0 | ❌ 假成功（0/0/0） |
| 5 | 自动同步开关 | 操作 | 设置开关 | `WebDAVSettings.tsx:392` | P1 | ❌ 无调度器 |
| 6 | 冲突处理 | 系统 | 同步时 | `types.ts:67`（SyncAction） | P1 | ❌ 未实现 |

### 6.2 Cloud Sync（自部署账号）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 注册账号 | 操作 | 设置 → 同步 | `WebDAVSettings.tsx:235`, `cloudSync/client.ts:80` | P1 | ✅ |
| 2 | 登录账号 | 操作 | 设置 | `useCloudSyncStore.ts:126` | P1 | ✅ |
| 3 | 选择/新建工作区 | 操作 | 设置 | `WebDAVSettings.tsx` | P1 | ✅ |
| 4 | token 安全存储 | 系统 | 登录后 | `useCloudSyncStore.ts:191` | P1 | ✅ |
| 5 | 派生 WebDAV 配置 | 系统 | 选工作区 | `cloudSync/client.ts:21` | P1 | ✅ |

### 6.3 Lumina Cloud 许可证

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 输入许可证 | 操作 | 设置 → Account | `LicenseSettings.tsx:19` | P1 | ❌ tab 被孤立 |
| 2 | 离线校验（Ed25519） | 系统 | 输入后 | `luminaCloud/verify.ts:23` | P1 | ❌ 公钥占位 |
| 3 | 许可证存 keychain | 系统 | 校验通过 | `handlers/luminaCloudLicense.ts:42` | P1 | ✅ |
| 4 | 配额展示 | 展示 | Account | `CloudUsagePanel.tsx:14` | P2 | ❌ 不可达 |
| 5 | 撤销列表缓存 | 系统 | 24h TTL | `luminaCloud/revocations.ts:41` | P2 | ⚠️ 未持久化 |

### 6.4 自部署中继与协作（Rust 后端）

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 健康检查 | 系统 | GET /health | `server/src/routes.rs` | P1 | ✅ |
| 2 | 指标快照 | 系统 | GET /metrics | `routes.rs` | P2 | ✅ |
| 3 | 注册/登录/刷新 | 操作 | POST /auth/* | `auth.rs:17` | P0 | ✅ |
| 4 | 工作区管理 | 操作 | /workspaces | `routes.rs` | P1 | ✅ |
| 5 | 组织/成员管理 | 操作 | /orgs/* | `routes.rs:190` | P1 | ✅ |
| 6 | 项目/任务/批注/通知 | 操作 | /projects /tasks /annotations /notifications | `routes.rs` | P1 | ✅ |
| 7 | WebDAV 文件存储 | 系统 | /dav/:workspace_id | `dav.rs:23` | P0 | ✅ |
| 8 | Yjs 实时协作 | 系统 | WS /collab/:doc_id | `collab.rs:18` | P1 | ✅ |
| 9 | 设备中继 | 系统 | WS /relay | `relay.rs:22` | P1 | ✅ |
| 10 | 公开站点发布 | 操作 | /sites/:user_id | `sites.rs:13` | P2 | ✅ |
| 11 | 限流 | 系统 | governor | `rate_limit.rs:18` | P1 | ✅ |

### 6.5 移动网关

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 启动/停止网关 | 操作 | 设置 → 同步 | `MobileGatewaySection.tsx:37` | P1 | ❌ IPC 不存在 |
| 2 | 显示端口/地址/token | 展示 | 设置 | `MobileGatewaySection.tsx:167` | P1 | ❌ |
| 3 | 生成配对 payload + QR | 操作 | 设置 | `MobileGatewaySection.tsx` | P1 | ❌ |
| 4 | 工作区同步 | 操作 | 设置 | `useFileStore.ts:2496` | P1 | ❌ IPC 不存在 |
| 5 | iOS/Android 扫码配对 | 操作 | 移动端 | `MobileGatewayStore.swift`, `MainActivity.kt` | P2 | ⚠️ 桌面侧缺失 |

---

## 7. 图片与图像生成（`image-gen`）

### 7.1 图片查看与管理

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 图片查看器 | 展示 | image 标签页 | `ImageViewer.tsx:63` | P1 | ✅ |
| 2 | 缩放/重置/重载 | 操作 | 查看器工具栏 | `ImageViewer.tsx:63-237` | P1 | ✅ |
| 3 | 图片管理器 | 展示 | image-manager 标签页 | `ImageManagerView.tsx:136` | P1 | ✅ |
| 4 | 网格/列表视图 | 操作 | 视图切换 | `useImageManagerStore.ts:4` | P1 | ✅ |
| 5 | 搜索/筛选/排序 | 操作 | 管理器工具栏 | `ImageManagerView.tsx:64-75` | P1 | ⚠️ 多数枚举死值 |
| 6 | 孤儿图片识别 | 展示 | 自动 | `ImageManagerView.tsx:611` | P1 | ✅ |
| 7 | 安全重命名/移动（含回滚） | 操作 | 管理器 | `imageOperations.ts:82` | P1 | ✅ |
| 8 | 删除图片 | 操作 | — | — | P2 | ❌ 不存在 |

### 7.2 粘贴插图

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 粘贴图片落盘 | 操作 | 编辑器粘贴 | `CodeMirrorEditor.tsx:5590` | P0 | ✅ |
| 2 | 插入 Markdown 图片引用 | 系统 | 粘贴后 | `editorImages.ts:93` | P0 | ✅ |

### 7.3 AI 图像生成

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 图像 provider 设置 | 操作 | AI 设置 → Image Models | `ImageModelsSettings.tsx:115` | P1 | ✅ |
| 2 | 测试图像 provider | 操作 | 设置按钮 | `image-providers/test-connection.ts` | P1 | ⚠️ 已存 key 无法测 |
| 3 | 3 个图像 provider | 展示 | 设置列表 | `image-providers/registry.ts:15` | P1 | ✅ |
| 4 | 直连生图 | 操作 | 聊天图片模式 | `imageGen/direct.ts:43` | P1 | ✅ |
| 5 | Agent 生图（带参考图/比例） | 操作 | generate_image 工具 | `plugin/index.ts:74` | P2 | ✅ |

---

## 8. 插件与扩展（`plugins-extensions`）

### 8.1 插件运行时

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 加载插件（4 级目录） | 系统 | 启动/刷新 | `handlers/plugins.ts:103` | P0 | ✅ |
| 2 | 插件清单校验 | 系统 | 加载时 | `plugins.ts:311` | P0 | ✅ |
| 3 | 权限模型（约定式） | 系统 | API 调用 | `runtime.ts:259,624` | P0 | ⚠️ 可绕过 |
| 4 | 路径越权防护 | 系统 | vault 操作 | `runtime.ts:630` | P0 | ✅ |
| 5 | 插件启停 | 操作 | 扩展中心 | `PluginSection.tsx:116` | P1 | ✅ |
| 6 | 外观安全模式 | 操作 | 扩展中心 | `PluginSection.tsx:153` | P1 | ✅ |
| 7 | 插件热重载 | 操作 | 扩展中心 | `runtime.ts:1479` | P2 | ✅ |
| 8 | 开发者脚手架 | 操作 | 扩展中心 DEV | `handlers/plugins.ts:212` | P2 | ✅ |

### 8.2 插件 UI 注入

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 注册 Ribbon 项 | 系统 | API | `runtime.ts:762` | P1 | ✅ |
| 2 | 注册设置区块 | 系统 | API | `runtime.ts` | P1 | ✅ |
| 3 | 注册状态栏项 | 系统 | API | `runtime.ts` | P2 | ✅ |
| 4 | 注册上下文菜单 | 系统 | API | `runtime.ts:830` | P2 | ✅ |
| 5 | 注册命令面板分组 | 系统 | API | `runtime.ts:853` | P2 | ✅ |
| 6 | 注册 Slash 命令 | 系统 | API | `runtime.ts:670` | P1 | ⚠️ 消费方死代码 |
| 7 | 注册全局热键 | 系统 | API | `runtime.ts:707` | P2 | ✅ |
| 8 | 注入样式 / 主题变量 | 系统 | API | `runtime.ts:1081,1101` | P1 | ✅ |
| 9 | 注册编辑器扩展 | 系统 | API | `runtime.ts:1274` | P2 | ✅ |
| 10 | 注册渲染钩子（Markdown/代码块） | 系统 | API | `runtime.ts:1372` | P2 | ✅ |
| 11 | 插件 HTML 视图 | 展示 | PluginViewPane | `PluginViewPane.tsx:10` | P1 | ✅ |

### 8.3 扩展中心

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开扩展中心 | 操作 | Ribbon Puzzle | `App.tsx:1213`, `ExtensionsCenterModal.tsx:44` | P1 | ✅ |
| 2 | Plugins / Skills tab | 操作 | 中心内 Tab | `ExtensionsCenterModal.tsx:44` | P1 | ✅ |
| 3 | 打开工作区插件目录 | 操作 | 中心按钮 | `PluginSection.tsx` | P2 | ✅ |

### 8.4 VSCode AI 扩展桥

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 检查/安装扩展 | 操作 | 设置 → 系统 | `VscodeAiExtensionsSection.tsx:35` | P2 | ✅ |
| 2 | 远程源选择（Marketplace/OpenVSX/GitHub） | 操作 | 设置 | `vscodeExtensions.ts:276` | P2 | ✅ |
| 3 | 兼容性 profile | 系统 | 安装时 | `profiles.ts:75` | P2 | ✅ |
| 4 | 激活/回滚扩展 | 操作 | 设置 | `vscodeExtensions.ts:218` | P2 | ✅ |
| 5 | host webview 弹窗 | 展示 | 设置 | `VscodeAiExtensionsSection.tsx:424` | P2 | ⚠️ 弱沙箱 |

---

## 9. 设置与主题（`settings-theme`）

### 9.1 设置面板

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 打开设置模态框 | 操作 | Ribbon/菜单 | `SettingsModal.tsx:83` | P0 | ✅ |
| 2 | 通用设置（主题/语言/编辑模式/字号） | 操作 | general tab | `GeneralSection.tsx:20` | P0 | ✅ |
| 3 | AI 设置 | 操作 | ai tab | `AISettingsModal.tsx` | P0 | ✅ |
| 4 | 同步设置 | 操作 | sync tab | `WebDAVSettings.tsx` | P0 | ✅ |
| 5 | 网络/代理设置 | 操作 | network tab | `ProxySection.tsx:8` | P1 | ⚠️ 双真源 |
| 6 | 系统设置 | 操作 | system tab | `SystemSection.tsx:11` | P1 | ✅ |
| 7 | Account（许可证）tab | 操作 | — | `SettingsModal.tsx:76` | P1 | ❌ 空壳不渲染 |

### 9.2 主题

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 选择内置主题（15 套） | 操作 | 通用设置 | `themes.ts:160-610`, `GeneralSection.tsx:73` | P0 | ✅ |
| 2 | 暗色模式切换 | 操作 | 主题按钮 | `useUIStore.ts:142` | P0 | ✅ |
| 3 | 自定义主题 CRUD | 操作 | 通用设置 | `themePlugin.ts:90` | P1 | ❌ 旧命令名失败 |
| 4 | 主题编辑器 | 操作 | 通用设置 | `ThemeEditor.tsx` | P1 | ✅ |
| 5 | 插件主题运行时 | 系统 | 插件 | `themeRuntime.ts:40` | P1 | ✅ |
| 6 | 外观崩溃恢复 | 系统 | 启动 | `App.tsx:425` | P1 | ✅ |

### 9.3 i18n

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 切换语言（4 种） | 操作 | 通用设置 | `i18n/index.ts:14`, `useLocaleStore.ts:48` | P0 | ✅ |
| 2 | 系统语言检测 | 系统 | 启动 | `i18n/index.ts:32` | P1 | ✅ |
| 3 | 11 种语言 | 展示 | — | — | P2 | ❌ 仅 README，应用 4 种 |

### 9.4 更新

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | 检查更新 | 操作 | 设置/自动 | `useUpdateStore.ts:327`, `UpdateChecker.tsx` | P1 | ✅ |
| 2 | 下载更新（进度） | 展示 | 更新弹窗 | `useUpdateStore.ts:34` | P1 | ✅ |
| 3 | 跳过版本 | 操作 | 更新弹窗 | `UpdateChecker.tsx` | P2 | ✅ |
| 4 | 安装并重启 | 操作 | 更新弹窗 | `handlers/updater.ts:228` | P1 | ✅ |
| 5 | macOS 无签名更新器 | 系统 | 更新时 | `macUnsignedUpdater.ts` | P2 | ✅ |

### 9.5 错误上报与系统

| 序号 | 功能点 | 类型 | 触发方式 | 代码位置 | 优先级 | 状态 |
|-----|--------|------|---------|---------|--------|------|
| 1 | blocker 错误横幅 | 展示 | 错误发生 | `useErrorBanner.ts:25`, `MainAIChatShell.tsx:457` | P1 | ✅ |
| 2 | transient 错误 toast | 展示 | 错误发生 | `toastBridge.ts:16` | P1 | ✅ |
| 3 | 错误持久化 ndjson | 系统 | 错误发生 | `errors/persistence.ts:32` | P2 | ⚠️ 未脱敏 |
| 4 | 诊断导出 | 操作 | 设置 | `handlers/diagnostics.ts:37` | P2 | ✅ |
| 5 | 系统托盘 | 系统 | — | — | P2 | ❌ 不存在 |
| 6 | 全局系统快捷键 | 系统 | — | — | P2 | ❌ 不存在（仅窗口级） |

---

## 附录 A：已废弃域——闪卡复习（历史）

> **状态：已整体删除**（commit `d8367d12` "transform Lumina-Note into LLM Wiki knowledge base"）。以下为基于 git 历史的逆向还原，仅作存档。

| 序号 | 功能点 | 类型 | 历史代码位置 | 状态 |
|-----|--------|------|-------------|------|
| 1 | 闪卡牌组列表 | 展示 | `src/components/flashcard/DeckList.tsx`（已删） | ❌ 已删除 |
| 2 | 手动创建卡片（front/back） | 操作 | 同上 | ❌ 已删除 |
| 3 | 复习会话（翻卡/评分） | 操作 | `FlashcardReview.tsx`（已删） | ❌ 已删除 |
| 4 | SM-2 间隔重复算法 | 系统 | `src/services/flashcard/sm2.ts`（已删） | ❌ 已删除 |
| 5 | 卡片存 frontmatter | 系统 | `db: "flashcards"` | ❌ 已删除 |
| 6 | 残骸：类型/i18n/E2E | — | `src/types/flashcard.ts`, `en.ts:1912-1963` | ⚠️ 残留 |

## 附录 B：跨域缺口汇总（供 PRD 风险章节引用）

| 编号 | 缺口 | 严重度 | 证据 |
|------|------|--------|------|
| G-01 | 旧直连 LLM 运行时为死路径但仍有调用方 | P0 | `services/llm/index.ts:93`；`SelectionToolbar.tsx:246` |
| G-02 | WebDAV 同步空实现（假成功） | P0 | `handlers/webdav.ts:246` |
| G-03 | 移动网关 IPC 命令不存在 | P0 | `ipc.ts:171`；`MobileGatewaySection.tsx:37` |
| G-04 | 许可证 UI 孤立 + 公钥占位 | P0 | `SettingsModal.tsx:76`；`PUBLIC_KEY.ts:12` |
| G-05 | 用户自定义主题旧命令名失败 | P1 | `themePlugin.ts:95` |
| G-06 | 闪卡残骸断链 | P1 | `e2e/flashcard-review-repro.ts:3` |
| G-07 | 插件沙箱弱（new Function） | P2 | `runtime.ts:588` |
| G-08 | i18n 实际 4 语言，多处硬编码 | P2 | `i18n/index.ts:14` |
| G-09 | 搜索无排序/范围过滤/替换 | P2 | `SearchSidebar.tsx:113` |
| G-10 | 三套错误通道重叠，useErrorStore 无消费 | P2 | `useErrorStore.ts` |
