# 产品文档索引

> Romantsy-Note 逆向产品文档（Wave 0 + Wave 1 产品组）
> 基线：`main` @ `92e125c7` · 生成日期：2026-05-30
> 口径：以"实现现状"为准 + 标注缺口

## 概览

| 统计项 | 数量 |
|--------|------|
| 业务域 | 9 个（+1 个已废弃） |
| 全局文档 | 1 份（功能清单） |
| 逆向 PRD | 9 份 |
| 已废弃域存档 | 1 份（闪卡，含在功能清单附录） |

## 全局文档

| 文档 | 说明 |
|------|------|
| [business-feature-list.md](./business-feature-list.md) | 全域功能清单（三级结构 + 实现状态 + 缺口汇总） |

## 域级 PRD

| 域标识 | 文档 | 实现状态摘要 |
|--------|------|-------------|
| `ai-agent` | [ai-agent-prd.md](./ai-agent-prd.md) | 主体已实现；选区 AI/自定义命令死路径 |
| `editor-markdown` | [editor-markdown-prd.md](./editor-markdown-prd.md) | 主体已实现；ReadingView 死代码 |
| `wiki-graph` | [wiki-graph-prd.md](./wiki-graph-prd.md) | 前端已实现；后端 wiki 未启用 |
| `search` | [search-prd.md](./search-prd.md) | 可用但无排序；索引搜索死代码 |
| `pdf-annotation` | [pdf-annotation-prd.md](./pdf-annotation-prd.md) | 主体已实现；旋转/编辑批注缺失 |
| `sync-cloud` | [sync-cloud-prd.md](./sync-cloud-prd.md) | WebDAV/移动网关空实现；后端完整 |
| `image-gen` | [image-gen-prd.md](./image-gen-prd.md) | 主体已实现；筛选枚举死值多 |
| `plugins-extensions` | [plugins-extensions-prd.md](./plugins-extensions-prd.md) | 已实现；沙箱弱 |
| `settings-theme` | [settings-theme-prd.md](./settings-theme-prd.md) | 主体已实现；Account tab 空壳 |

## 文档类型说明

- **逆向 PRD**：从代码逆向提取的用户视角需求文档，含业务规则、交互行为、状态机、验收标准与缺口附录。
- **实现状态标记**：✅ 已实现 / ⚠️ 部分实现或有缺口 / ❌ 空实现或不可达。
- **附录「发现的问题」**：P0-P3 分级，含代码路径证据。

## 已废弃域

| 域 | 说明 |
|----|------|
| 闪卡复习 | 已在 commit `d8367d12` 整体删除，仅剩类型/i18n/E2E 残骸；详见功能清单附录 A |
