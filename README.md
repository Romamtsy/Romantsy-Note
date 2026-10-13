# Romantsy-Note

一个本地优先的 AI 笔记桌面应用（毕业设计）。

笔记以纯 Markdown 文件保存在本地，应用在本地完成编辑、双链、图谱与 AI 辅助写作，数据默认不离开设备。

## 功能

- **Markdown 编辑器**：源码 / 实时预览 / 阅读三种模式，支持 LaTeX、Mermaid、代码高亮。
- **双向链接与知识图谱**：`[[WikiLinks]]` 双向链接、反链、标签、全局与局部图谱。
- **AI 助手**：支持多家模型服务商（OpenAI、Anthropic、DeepSeek、Gemini、Ollama 等），可读写本地笔记。
- **PDF 阅读与批注**：内置 PDF 阅读器，支持高亮、下划线、笔记，批注可导出为 Markdown。
- **图片管理**：图片查看、批量管理、粘贴插图、AI 生图。
- **插件与主题**：插件扩展能力与多套主题。

## 技术栈

- 桌面框架：Electron
- 前端：React 18 + TypeScript + Tailwind CSS
- 编辑器：CodeMirror 6
- 状态管理：Zustand
- 本地后端（可选）：Rust + axum + SQLite

## 快速开始

环境要求：Node.js 22+

```bash
npm install
npm run dev        # 开发模式
npm run build      # 构建
npm run dist:mac   # 打包（另有 dist:win / dist:linux）
```

## 目录结构

```
src/       前端渲染进程（React）
electron/  Electron 主进程
server/    自部署后端（Rust，可选）
docs/      项目文档
```

## 文档

- 用户指南：`docs/user-flow.zh-CN.md`
- 设计规范：`docs/design-system.md`
- 逆向工程文档：`docs/reverse/`

## 许可证

[Apache License 2.0](./LICENSE)
