import { createDir, join, writeTextFile } from "@/lib/host";

export const ROMANTSY_DEMO_VAULT_NAME = "Romantsy-Demo-Vault";

type DemoFile = {
  path: string[];
  content: string;
};

const demoFiles: DemoFile[] = [
  {
    path: ["00-欢迎使用 Romantsy.md"],
    content: `# 欢迎使用 Romantsy-Note

这是一个用于复现、演示和学习源码的 Demo Vault。它刻意覆盖了 Markdown、双链、标签、RAG 索引、AI Agent 任务和插件观察几个核心场景。

## 建议演示路径

1. 打开左侧文件树，确认 Demo Vault 能正常加载。
2. 打开 [[01-项目复现清单]]，逐项核对 Windows 环境。
3. 打开 [[02-RAG 测试素材]]，用全局搜索或 AI 面板提问。
4. 打开 [[03-Agent 任务样例]]，测试让 AI 修改或总结笔记。
5. 进入设置 -> 系统，观察索引诊断面板。

#demo #romantsy #onboarding
`,
  },
  {
    path: ["01-项目复现清单.md"],
    content: `# 项目复现清单

## 必备环境

- Node.js 20+ 或 22+
- Rust stable + MSVC Build Tools
- Bun，用于构建 thirdparty/opencode
- Python，供部分 native dependency 构建脚本使用

## 推荐命令

\`\`\`powershell
npm install
npm run opencode:bundle
npm.cmd run dev
\`\`\`

## 验收标准

- Electron 窗口可以打开。
- 标题和图标显示为 Romantsy-Note。
- AI 面板能看到 Provider 状态卡。
- 设置页能看到索引诊断和插件安全模式。

关联：[[00-欢迎使用 Romantsy]]、[[04-源码阅读路线]]

#setup #windows
`,
  },
  {
    path: ["02-RAG 测试素材.md"],
    content: `# RAG 测试素材

Romantsy-Note 的本地知识库能力可以拆成三层：

1. 文件层：扫描 Markdown 文件，读取标题、正文、标签和双链。
2. 索引层：维护文件数量、已索引数量、标签、反向链接和失败文件。
3. 问答层：AI 面板把当前笔记、引用文件和用户问题组合成上下文。

## 可测试问题

- “这个知识库的复现步骤有哪些？”
- “请根据 Demo Vault 总结项目学习路线。”
- “RAG 索引面板应该展示哪些指标？”

## 故意加入的标签

#rag #index #search #ai
`,
  },
  {
    path: ["03-Agent 任务样例.md"],
    content: `# Agent 任务样例

可以在 AI 面板里尝试这些任务：

- 总结当前 Demo Vault 的学习目标。
- 帮我把 [[01-项目复现清单]] 改写成面试讲解稿。
- 根据 [[04-源码阅读路线]] 生成一份 7 天学习计划。

## 观察点

- Provider 是否已配置。
- Agent 是否进入 running、waiting_approval 或 error 状态。
- 错误时是否能通过设置入口快速修复模型配置。

#agent #llm #workflow
`,
  },
  {
    path: ["04-源码阅读路线.md"],
    content: `# 源码阅读路线

## 第一阶段：跑起来

先理解 Electron + Vite 的启动链路：package.json -> electron-vite -> electron/main -> renderer。

## 第二阶段：读数据

重点看 useFileStore、useNoteIndexStore、host.ts 和 main process 的 IPC handler。

## 第三阶段：读 AI

重点看 AISettingsModal、useAIStore、useOpencodeAgent、provider runtime 和 opencode bridge。

## 第四阶段：改功能

从小功能开始，例如状态卡、诊断面板、Demo Vault、插件安全模式，再逐步进入 Agent 和 RAG。

关联：[[02-RAG 测试素材]]、[[03-Agent 任务样例]]

#learning #source-code
`,
  },
  {
    path: ["素材", "面试讲解稿.md"],
    content: `# 面试讲解稿

我基于开源项目 Romantsy-Note 做了二次开发和源码学习，重点改造了以下能力：

- 品牌与桌面 UI：替换项目名称、窗口标题、图标和欢迎页入口。
- 复现体验：补齐 Windows、Bun、Python、opencode bundle 文档。
- 诊断能力：增加 Provider 状态卡、索引诊断面板和插件安全模式入口。
- 演示体验：新增一键 Demo Vault，方便老师或面试官快速体验功能。

注意：原项目许可证和作者署名保留，我的贡献以二次开发、工程化复现和功能增强为主。

#interview #contribution
`,
  },
];

export async function createRomantsyDemoVault(parentPath: string): Promise<string> {
  const vaultPath = await join(parentPath, ROMANTSY_DEMO_VAULT_NAME);
  await createDir(vaultPath, { recursive: true });
  await createDir(await join(vaultPath, ".lumina"), { recursive: true });
  await createDir(await join(vaultPath, ".lumina", "skills"), {
    recursive: true,
  });
  await createDir(await join(vaultPath, ".lumina", "plugins"), {
    recursive: true,
  });

  for (const file of demoFiles) {
    if (file.path.length > 1) {
      const dir = await join(vaultPath, ...file.path.slice(0, -1));
      await createDir(dir, { recursive: true });
    }
    await writeTextFile(await join(vaultPath, ...file.path), file.content);
  }

  return vaultPath;
}
