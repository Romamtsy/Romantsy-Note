# 研发文档索引

> Romantsy-Note 逆向研发文档（Wave 0 全局 + 核心研发文档）
> 基线：`main` @ `92e125c7` · 生成日期：2026-05-30
> 口径：以"实现现状"为准 + 标注缺口

## 概览

| 统计项 | 数量 |
|--------|------|
| 全局架构文档 | 5 份 |
| 研发专题文档 | 2 份 |
| 覆盖模块 | 渲染进程 / 主进程 / Rust 后端 / 共享包 / 移动端 |

## 全局文档

| 文档 | 说明 |
|------|------|
| [system-architecture.md](./system-architecture.md) | 系统架构：进程拓扑、分层、数据流、部署、架构级风险 |
| [module-dependency.md](./module-dependency.md) | 模块依赖：渲染/主进程/后端/包依赖图与循环依赖 |
| [component-architecture.md](./component-architecture.md) | 组件架构：分层、基础 UI、各域组件、设计约束 |
| [route-state-management.md](./route-state-management.md) | 路由与状态：标签页/视图状态机、Zustand store 清单 |
| [integration-contracts.md](./integration-contracts.md) | 集成契约：外部服务、opencode、后端、云、更新、VSCode 桥 |

## 研发专题

| 文档 | 说明 |
|------|------|
| [api-definitions.md](./api-definitions.md) | API 定义：IPC 命令契约 + 后端 HTTP/WS 路由 + opencode API |
| [key-code-logic.md](./key-code-logic.md) | 核心逻辑：状态机、Provider 桥、索引、图谱、批注、插件权限、错误路由、更新、同步、许可证 |

## 文档类型说明

- **G02/G03/G05/G06/G10**：对应逆向文档注册表的全局研发文档。
- **D05/D07**：对应 API 定义与核心逻辑（本项目为合并全域版本）。
- **实现状态**：文档中对未实现/空实现/死代码均标注证据路径。

## 关联文档

- 项目上下文：[../project-context.md](../project-context.md)
- 执行状态：[../execution-state.md](../execution-state.md)
- 产品文档：[../product/README.md](../product/README.md)
