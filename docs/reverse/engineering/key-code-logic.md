# Romantsy-Note 核心逻辑

> 生成日期：2026-05-30
> 基线 commit：`92e125c7`（`main`）
> 范围：各域最关键的实现逻辑与算法

---

## 1. AI Agent 会话状态机

**位置**：`src/stores/useOpencodeAgent.ts`

**状态枚举**（`:57-63`）：
```
"idle" | "running" | "waiting_approval" | "completed" | "error" | "aborted"
```

**核心流转**：

| 触发 | 处理 | 证据 |
|------|------|------|
| `startTask` | 状态→running，`promptAsync` 带 `retryWithBackoff` | `:1304-1451` |
| `permission.asked` | 状态→waiting_approval，生成审批卡 | `:736-777` |
| `replyPermission(once/reject)` | 回 running | `:483-528` |
| `session.idle` | 状态→completed | `:835-1021` |
| `session.error` | 状态→error | 同上 |
| `abort()` | `session.abort`，状态→aborted | `:1453-1470` |
| `server.instance.disposed` | 错误 + 回 idle | `:814-833` |

**流式增量**：
- `message.part.delta` 前置处理（SDK 类型未含）（`:795-813`）。
- `applyPartDelta` 应用增量；delta 早于 message 时建 stub（`:664-713`）。
- `completedAt` 为 undefined 表示仍在流式（`:78-83`）。

**重连退避**：500ms × 2ⁿ 上限 5s（`:1142`）。

**错误重试**：`retryWithBackoff` 最多 3 次，延迟 [250,750]ms；可重试=网络/5xx/408/429（`services/errors/retry.ts:20-101`）。

---

## 2. Provider 桥接逻辑

**位置**：`electron/main/agent-v2/provider-bridge.ts`

**职责**：把 `ProviderSettingsStore` 翻译为 opencode 启动环境变量。

**关键映射**（`:109-125`）：

| Lumina provider | opencode provider id |
|-----------------|---------------------|
| anthropic | anthropic |
| openai | openai |
| google | google |
| deepseek | deepseek |
| moonshot | moonshotai |
| glm | zhipuai |
| mimo | xiaomi |
| groq | groq |
| openrouter | openrouter |
| ollama | ollama |
| openai-compatible | `lumina-compat` |

**特殊规则**：
- Ollama 免 Key（`:549`）。
- openai-compatible 免 Key 但强制 baseUrl（`:573-586`）。
- 本地/未知模型用保守 token 上限（`:562-571`）。
- 输出注入 `OPENCODE_CONFIG_CONTENT` + `OPENCODE_AUTH_CONTENT`（`:372-517`）。

**系统提示词分类逻辑**（`:68-91`）：要求模型把回合归类为 Direct conversation / Vault-grounded / Vault mutation / External research，并声明"Ambient app state is not consent"。

---

## 3. 笔记索引构建

**位置**：`src/stores/useNoteIndexStore.ts`

**常量**（`:90-103`）：单文件 2MB、总 50k、并发 16、每 200 文件让出。

**流程**：
1. `requestIdleCallback` 延后启动（`:165-167`）。
2. `buildIndex` 遍历 vault，`AbortController` 可取消（`:148-318`）。
3. 反链：按 `[[linkName` 逐行找首个出现行作为上下文（`:224-251`）。
4. 标签：`#tag` 正则提取（`:16-25`）。

**链接解析**：`resolveWikiLinkPath` 按文件名 stem 大小写不敏感，返回首个（`lib/wikiLinks.ts:24-45`）。

**死代码**：`searchContent`（标题加权 100 + 命中数排序）无调用（`:331-406`）。

---

## 4. 知识图谱物理引擎

**位置**：`src/components/effects/KnowledgeGraph.tsx` / `LocalGraph.tsx`

**渲染**：纯 Canvas 2D + 自研 `PhysicsEngine`（无 d3）。

**降频**：节点数 > 600 时每 3 帧步进一次（`KnowledgeGraph.tsx:568-572`）。

**上限**：全局 1200、局部 80（`knowledgeGraphData.ts:38`；`localGraphData.ts:33`）。

**建边**：`link`（双链）+ `hierarchy`（文件夹层级）；未解析链接静默丢弃（`knowledgeGraphData.ts:117-119`）。

**图谱内编辑**：创建连接在源笔记追加 `[[label]]`（basename）（`KnowledgeGraph.tsx:194-199`）。

**性能缺口**：常驻 `requestAnimationFrame`，无静止停帧（`KnowledgeGraph.tsx:831-838`；`LocalGraph.tsx:204-305`）。

---

## 5. PDF 批注序列化

**位置**：`src/services/pdf/annotations.ts`

**持久化**：与 PDF 同目录 `<name>.annotations.md`（`:35-38`）。

**内容结构**（`:206-271`）：引用块 + 笔记 + 跳转链接 + 隐藏元数据。

**回跳链接**：`lumina://pdf?file=...&page=...&id=...`（`:249`）。

**类型**：`highlight | underline | note`；颜色 5 种（`types/annotation.ts:6,9,60`）。

**加载去重**：`loadAnnotations` 同路径去重（`usePDFAnnotationStore.ts:83-120`）。

**缺口**：编辑批注为 TODO（`AnnotationLayer.tsx:42-45`）；主视图不应用深链（`useFileStore.ts:1549`）。

---

## 6. 图片资产引用重写

**位置**：`src/services/assets/imageManager.ts` / `imageOperations.ts`

**索引**：构建 `ImageAssetRecord`，统计引用（`imageManager.ts:30-62`）。

**派生标记**：`orphan / multiReferenced / recent / large`（`:261-264`）。

**常量**：`LARGE_IMAGE_THRESHOLD_BYTES=5MB`、`RECENT_IMAGE_WINDOW_MS=7d`（`:20-21`）。

**安全重命名/移动**：
1. 先预览受影响笔记与被改写引用（`imageOperations.ts:82-176`）。
2. 执行；失败回滚。

**缺口**：无删除图片（`:178-218`）。

---

## 7. 插件运行时权限

**位置**：`src/services/plugins/runtime.ts`

**执行模型**：入口 `new Function("api","plugin", ...)`，要求导出 setup（`:588-616`）。

**权限校验**：
1. 通配符匹配 `*`、`namespace:*`（`:259-265`）。
2. 别名归一化（`:267-277`）。
3. 每个敏感 API 前 `requirePermission`（`:624-628`）。
4. 路径越权防护 `resolveWorkspacePath` 限制在 workspace 内（`:630-645`）。

**样式层**：`base < theme < component < override`（`styleRuntime.ts:1-3`）。

**卸载清理**：dispose/unsubscribers/UI/tab/command/layout/theme/style/render/editor（`:1419-1456`）。

**缺口**：权限为约定式，插件可绕过直接访问 DOM/fetch。

---

## 8. 错误分级路由

**位置**：`src/services/errors/**`

**级别**：`blocker | transient | background`（`types.ts:11-17`）。

**路由**：
- blocker → sticky banner（`useErrorBanner.ts:25-38`）。
- transient → sonner toast（`toastBridge.ts:16-22`）。
- background → 日志缓冲。

**持久化**：`<vault>/.lumina/logs/errors.ndjson`，10MiB 轮转 `.1`（`persistence.ts:32,38-94`）。

**文案映射**：按 kind + cause 分类（`format.ts:35-108`）。

**缺口**：`useErrorStore` 无 UI 消费；`cause` 未脱敏落盘。

---

## 9. 更新流程

**位置**：`src/stores/useUpdateStore.ts` / `electron/main/handlers/updater.ts`

**阶段**：`idle → downloading → verifying → installing → ready`（错误/取消分支）。

**重试**：检查 3 次（1s→8s）；下载 3 次（1.5s→12s，120s 超时）。

**macOS**：无 Developer ID，走自研 `MacUnsignedUpdater`。

**可恢复下载**：`VITE_RESUMABLE_UPDATER_ENABLED` 控制。

---

## 10. WebDAV 同步编排（现状）

**位置**：`electron/main/handlers/webdav.ts`

**现状**：`webdav_compute_sync_plan` 恒返回空计划；`execute_sync`/`quick_sync` 恒 `success:true, 0/0/0`（`:246-270`）。真正的同步编排（Tauri 时代 Rust orchestrator）**未迁移**。

**类型定义完整**：`SyncStage`（8 值）、`SyncAction`（6 值）仍在 `services/webdav/types.ts:67-110`。

---

## 11. 许可证离线校验

**位置**：`src/services/luminaCloud/verify.ts`

**流程**：base64url 解码 → Ed25519 签名校验 → JSON 解析；**永不抛异常**（`:23-50`）。

**Canonical JSON**：自定义序列化（`canonical-json.ts:19-56`）。

**存储**：mac/Win `safeStorage`；Linux 回退 `0600` 明文文件，前缀 `LCE1`/`LCP1`（`handlers/luminaCloudLicense.ts:39-77`）。

**缺口**：公钥占位（`PUBLIC_KEY.ts:12`）；`refreshFromKeychain` 未调用。

---

## 12. 会话导出逻辑

**位置**：`src/features/conversation-export/exportUtils.ts`

**Agent 清洗**：`AGENT_USER_SKIP_PATTERNS`（含中文提示）+ `TOOL_LINE_PATTERN`（`🔧/✅/❌`）（`:29-39`）。

**Markdown 生成**：`# 标题` + 模式标签 + `## 用户/## AI` 段落（`:180-198`）。

**文件名清洗**：非法字符替换、空白转 `-`、空回退 `conversation`（`:200-211`）。

**缺口**：仅 Markdown；`chat` 分支死代码。

---

## 13. 已删除功能：SM-2 闪卡算法（历史存档）

**历史位置**：`src/services/flashcard/sm2.ts`（已删除）。

**算法**：
- 常量 `DEFAULT_EASE=2.5`、`MIN_EASE=1.3`。
- `rating < 2` 失败：ease−0.2（下限 1.3）、interval=1、repetitions=0。
- 成功：repetitions 0→1 天；1→6 天；否则 `round(interval*ease)`。
- ease 调整 `0.1 - (3-rating)*(0.08 + (3-rating)*0.02)`；`rating===3` 额外 `interval*=1.3`。

**残留**：类型 `src/types/flashcard.ts`、i18n `en.ts:1912-1963`、E2E `e2e/flashcard-review-repro.ts`（断链）。
