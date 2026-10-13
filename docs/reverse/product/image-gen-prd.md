# 图片与图像生成 域逆向 PRD

> 生成日期：2026-05-30
> 目标域：`image-gen`
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

本域管理 vault 内的图片资产：查看、批量管理（网格/列表、筛选、孤儿识别）、安全重命名/移动、编辑器粘贴插图，以及 AI 图像生成（直连 provider 或 agent 工具）。

### 1.2 目标用户

| 角色 | 说明 | 核心操作 |
|------|------|---------|
| 写作用户 | 笔记里放图 | 粘贴插图、查看图片 |
| 资产整理用户 | 清理无用图 | 管理器、孤儿识别、重命名 |
| AI 用户 | 生成配图 | 图像模式生图 |

### 1.3 页面清单

| 入口 | 位置 | 说明 |
|------|------|------|
| 图片查看器 | image 标签页 | `ImageViewer.tsx` |
| 图片管理器 | image-manager 标签页 | `ImageManagerView.tsx` |
| 图像模型设置 | AI 设置 → Image Models | `ImageModelsSettings.tsx` |

---

## 2. 功能需求

### 2.1 图片查看器（FR-01｜func_code: `func_view_image`）

**功能描述**：打开单张图片，支持缩放（10%-800%）、重置、适应、重载、在文件管理器显示、显示尺寸与体积。

**业务规则**：
1. 缩放范围 10%-800%（`ImageViewer.tsx:63-237`）。
2. "适应屏幕"仅重置为 1，名不副实（`ImageViewer.tsx:120`）。
3. 加载/错误文案**硬编码英文**（`ImageViewer.tsx:200-219`）。

**验收标准**：
- [ ] 打开图片正常显示。
- [ ] 缩放/重置/重载生效。

### 2.2 图片管理器（FR-02｜func_code: `func_manage_images`）

**功能描述**：网格/列表视图，搜索、状态筛选、文件夹筛选、排序、多选、详情、定位到文件树、复制路径；识别孤儿图片；安全重命名/移动。

**业务规则**：
1. 视图模式 `grid | list`（`useImageManagerStore.ts:4`）。
2. 状态筛选枚举 `all|referenced|orphan|multi|recent|large`，但 UI **仅提供 all/orphan**（`ImageManagerView.tsx:64-69`）。
3. 排序 `name|modified|size|references`，但 size 被排除且被 effect 强制重置为 modified（`ImageManagerView.tsx:71-75,220-222`）。
4. 徽章**仅 Orphan 会显示**（`ImageManagerView.tsx:94-98`）。
5. 重命名/移动先预览受影响笔记，再执行，失败回滚（`imageOperations.ts:82-176`）。
6. **无删除图片能力**（`imageOperations.ts:178-218`）。
7. 常量：`LARGE_IMAGE_THRESHOLD_BYTES=5MB`、`RECENT_IMAGE_WINDOW_MS=7d`（`imageManager.ts:20-21`）。

**交互行为**：

| 维度 | 描述 | 代码位置 |
|------|------|---------|
| 未打开 vault | `emptyVaultTitle/Description` | `ImageManagerView.tsx:617-622` |
| 扫描中 | `scanningTitle/Description` | `ImageManagerView.tsx:623-629` |
| 无图片 | `noImagesTitle/Description` | `ImageManagerView.tsx:630-635` |
| 无匹配 | `noMatchTitle/Description` | `ImageManagerView.tsx:636-641` |
| 未选中 | `selectImageTitle/Description` | `ImageManagerView.tsx:697-704` |
| 孤儿告警 | `orphanOnlyWarning` | `ImageManagerView.tsx:611-615` |
| 索引失败 | 仅 `reportOperationError`，无可见 UI | `ImageManagerView.tsx:275-286` |

**验收标准**：
- [ ] 管理器列出 vault 内图片并标记孤儿。
- [ ] 重命名后笔记引用同步更新，失败回滚。
- [ ] 按状态/文件夹筛选生效（**多数枚举不可达，部分达标**）。

### 2.3 粘贴插图（FR-03｜func_code: `func_paste_image`）

**功能描述**：编辑器粘贴图片自动落盘到笔记同级 `assets/`，并插入 Markdown 引用。

**业务规则**：
1. 解析 MIME、目标路径、命名（`editorImages.ts:93-121`）。
2. 插入 `![](...)`（`CodeMirrorEditor.tsx:5590-5639`）。

**验收标准**：
- [ ] 粘贴图片后落盘并插入引用。

### 2.4 AI 图像生成（FR-04｜func_code: `func_generate_image`）

**功能描述**：聊天图片模式下生成图片；有主模型走 agent `generate_image` 工具，无主模型走直连 provider。

**业务规则**：
1. 3 个图像 provider：`openai-image | google-image | bytedance-image`（`image-providers/registry.ts:15-18`）。
2. API Key 存 keychain，UI 只写不读（`useImageProvidersStore.ts:8-12`）。
3. 直连路径支持 `aspectRatio`/`referenceImages`，但调用处仅传 prompt/provider/vault（`MainAIChatShell.tsx:1194-1198`）。
4. provider 优先级 `PROVIDER_PRIORITY` 与 registry 重复维护（`direct.ts:60-64`）。
5. 测试连接在已有 key 未输入新 key 时用空 key 报错（`ImageModelsSettings.tsx:298-304`）。

**验收标准**：
- [ ] 无主模型时直连生图返回 Markdown。
- [ ] 有主模型时通过工具生图。
- [ ] 配置并测试图像 provider。

---

## 3. 状态机

### 3.1 缩略图状态

`idle | loading | error`（`ImageThumbnail.tsx:81`）。

### 3.2 设置测试状态

`TestStatus = idle | testing | success | error`（`ImageModelsSettings.tsx:24`）。

### 3.3 直连生图结果

`DirectImageResult` 判别联合 `ok:true | false`（`direct.ts:27-41`）。

---

## 4. 交互规范

### 4.1 加载与骨架屏策略

| 区块 | 加载方式 | 代码位置 |
|------|---------|---------|
| 管理器扫描 | `scanningTitle/Description` | `ImageManagerView.tsx:623` |
| 缩略图 | `loading` 状态 | `ImageThumbnail.tsx:81` |
| 生图 | `generating` | `MainAIChatShell.tsx:1166` |

### 4.2 空状态设计

| 区块 | 空状态文案 | 代码位置 |
|------|----------|---------|
| 未打开 vault | `emptyVaultTitle` | `ImageManagerView.tsx:617` |
| 无图片 | `noImagesTitle` | `ImageManagerView.tsx:630` |
| 无匹配 | `noMatchTitle` | `ImageManagerView.tsx:636` |
| 未选中 | `selectImageTitle` | `ImageManagerView.tsx:697` |
| 生图无 vault | `ai.imageDirect.noVault` | `MainAIChatShell.tsx:1130` |

### 4.3 错误状态设计

| 场景 | 展示方式 | 代码位置 |
|------|---------|---------|
| 缩略图失败 | 硬编码 `"Preview unavailable"` | `ImageThumbnail.tsx:129` |
| 查看器失败 | 硬编码 `"Failed to load image"` + Retry | `ImageViewer.tsx:200-219` |
| 索引构建失败 | 静默（无 UI） | `ImageManagerView.tsx:275-286` |
| 生图失败 | `failureTitle/failureGeneric` | `MainAIChatShell.tsx:1166-1234` |

### 4.4 操作反馈规范

| 场景 | 反馈 | 代码位置 |
|------|------|---------|
| 重命名/移动 | 预览 → 执行 → 失败回滚 | `imageOperations.ts:82-176` |
| 生图成功 | Toast | `MainAIChatShell.tsx` |
| 测试连接 | success/error 文案 | `ImageModelsSettings.tsx:472-487` |

---

## 5. 非功能需求

### 5.1 性能要求

- 缩略图缓存（`ImageThumbnail.tsx`）。
- 图片库索引构建（`imageManager.ts`）。
- 大图阈值 5MB、近期窗口 7 天。

### 5.2 安全要求

- 重命名/移动前预览 + 失败回滚，避免引用损坏。

---

## 6. 风险与依赖

### 6.1 前置依赖

| 依赖项 | 类型 | 说明 |
|--------|------|------|
| 本地文件系统 | 系统 | 图片资产 |
| 图像 provider API | 外部服务 | AI 生图 |

### 6.2 已知风险与约束

| 风险/约束 | 影响 | 现有处理 / 建议 |
|---------|------|--------------|
| 状态筛选/排序/徽章枚举大量死值 | 功能名不副实 | 补实现或清理 |
| 无删除图片 | 孤儿无法清理 | 增加删除 |
| 硬编码英文 | i18n 不完整 | 接入 i18n |
| provider 优先级双份维护 | 漂移 | 统一 |

---

## 7. 附录：发现的问题

| 级别 | 类型 | 影响范围 | 发现路径（文件:行） | 问题描述 |
|------|------|---------|-------------------|---------|
| P1 | 死枚举 | 管理器筛选 | `useImageManagerStore.ts:5`；`ImageManagerView.tsx:64-69` | referenced/multi/recent/large 有类型/i18n 但 UI 不提供 |
| P1 | 死逻辑 | 管理器排序 | `ImageManagerView.tsx:71-75,220-222` | size 排序被排除且被强制重置 |
| P1 | 死徽章 | 管理器 | `ImageManagerView.tsx:94-98` | 仅 Orphan 徽章会显示 |
| P2 | 功能缺失 | 管理器 | `imageOperations.ts:178-218` | 无删除图片能力 |
| P2 | 名不副实 | 查看器 | `ImageViewer.tsx:120` | "适应屏幕"仅重置为 1 |
| P2 | i18n | 查看器/缩略图 | `ImageViewer.tsx:200-217`；`ImageThumbnail.tsx:129` | 硬编码英文 |
| P2 | 静默失败 | 管理器 | `ImageManagerView.tsx:275-286` | 索引构建失败无可见错误 |
| P2 | 参数未用 | 直连生图 | `MainAIChatShell.tsx:1194-1198`；`direct.ts:17-24` | aspectRatio/referenceImages 未传 |
| P3 | 重复维护 | provider | `direct.ts:60-64` vs `registry.ts:38-69` | 优先级硬编码重复 |
| P3 | 测试受限 | 设置 | `ImageModelsSettings.tsx:298-304` | 已存 key 无法直接测试 |
