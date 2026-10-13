# Romantsy-Note 集成契约

> 生成日期：2026-05-30
> 基线 commit：`92e125c7`（`main`）
> 范围：外部服务集成 + 跨进程/跨模块契约

---

## 1. 集成清单

| 集成 | 类型 | 方向 | 协议 | 证据 |
|------|------|------|------|------|
| LLM Providers（11） | 外部服务 | 出站 | HTTPS（AI SDK） | `agent-v2/providers/registry.ts:59-242` |
| 图像 Providers（3） | 外部服务 | 出站 | HTTPS | `agent-v2/image-providers/registry.ts:15-36` |
| 内嵌 opencode server | 进程内服务 | 本地 | HTTP + SSE | `agent-v2/server.ts`；`services/opencode/client.ts` |
| 自部署后端 | 内部服务 | 出站 | HTTP + WS | `server/src/main.rs:90-169` |
| WebDAV 服务器 | 外部服务 | 出站 | WebDAV | `handlers/webdav.ts` |
| lumina-cloud | 外部服务 | 出站 | HTTPS | `services/luminaCloud/client.ts` |
| GitHub Releases | 外部服务 | 出站 | HTTPS | `handlers/updater.ts` |
| VSCode Marketplace/OpenVSX | 外部服务 | 出站 | HTTPS | `vscode-extensions/sources.ts` |
| OS Keychain | 系统 | 本地 | safeStorage | `handlers/store.ts`；`handlers/luminaCloudLicense.ts` |

---

## 2. LLM Provider 契约

### 2.1 Provider 元数据

| provider id | label | requiresApiKey | defaultBaseUrl | SDK |
|-------------|-------|----------------|----------------|-----|
| `anthropic` | Anthropic | 是 | api.anthropic.com | `@ai-sdk/anthropic` |
| `openai` | OpenAI | 是 | api.openai.com/v1 | `@ai-sdk/openai` |
| `google` | Google Gemini | 是 | generativelanguage…/v1beta | `@ai-sdk/google` |
| `deepseek` | DeepSeek | 是 | api.deepseek.com | `@ai-sdk/deepseek` |
| `moonshot` | Moonshot (Kimi) | 是 | api.moonshot.cn/v1 | openai-compatible |
| `glm` | Zhipu (GLM) | 是 | open.bigmodel.cn/api/paas/v4 | openai-compatible |
| `mimo` | Xiaomi MiMo | 是 | api.xiaomimimo.com/v1 | openai-compatible |
| `groq` | Groq | 是 | api.groq.com/openai/v1 | `@ai-sdk/groq` |
| `openrouter` | OpenRouter | 是 | openrouter.ai/api/v1 | `@openrouter/ai-sdk-provider` |
| `ollama` | Ollama | **否** | localhost:11434/api | `ollama-ai-provider-v2` |
| `openai-compatible` | OpenAI Compatible | 是（但强制 baseUrl） | 用户自填 | `@ai-sdk/openai-compatible` |

### 2.2 凭据契约

| 项 | 约定 | 证据 |
|----|------|------|
| API Key 存储 | OS keychain，键 `lumina:provider:apikey:<id>` | `providers/settings-store.ts:92-98` |
| 非敏感配置 | `<userData>/lumina-provider-settings.json` | `settings-store.ts:134-137` |
| 翻译到 opencode | env `OPENCODE_CONFIG_CONTENT` + `OPENCODE_AUTH_CONTENT` | `provider-bridge.ts:372-517` |
| provider id 映射 | moonshot→moonshotai, glm→zhipuai, mimo→xiaomi, openai-compatible→`lumina-compat` | `provider-bridge.ts:109-125` |

> **安全约定**：API Key 只写不可读，UI 不回显；禁止在日志/文档中出现真实值。

### 2.3 模型目录

- 前端目录 `src/services/llm/providers/models.ts`（`PROVIDER_MODELS`）。
- 后端兜底快照 `provider-bridge.ts:173-248`。
- **缺口**：两处独立维护，易漂移。

---

## 3. 内嵌 opencode server 契约

| 项 | 约定 | 证据 |
|----|------|------|
| 启动 | 主进程内 `Server.listen()` | `agent-v2/server.ts:1-80` |
| 健康检查 | `GET /global/health` | `server.ts` |
| 渲染客户端 | `createOpencodeClient`（懒加载缓存，注入 basic-auth + `x-opencode-directory`） | `services/opencode/client.ts:7-117` |
| 凭据暴露 | preload `window.lumina.opencode.getServerInfo()` | `preload/index.ts:90-104` |
| 重启通知 | `opencode:server-changed` → 渲染重置 client | `agent-v2/ipc.ts:45-61` |
| 技能查询 | `GET /skill` | `services/opencode/skills.ts:66-80` |
| 任务发送 | `promptAsync`，body `agent:"build"` | `useOpencodeAgent.ts:1396-1400` |
| 流式 | SSE，事件 `session.*` / `message.*` | `useOpencodeAgent.ts:835-1021` |
| 权限 | `permission.asked` → `replyPermission(once/reject)` | `useOpencodeAgent.ts:736-777,483-528` |
| 路径隔离 | XDG 重定向 + `OPENCODE_DISABLE_EXTERNAL_SKILLS=1` | `opencode-xdg.ts:57-68` |

---

## 4. 自部署后端契约

### 4.1 HTTP 路由（`server/src/main.rs:90-169`）

| 方法 & 路径 | 说明 | 鉴权 |
|------------|------|------|
| `GET /health` | 健康检查 | 无 |
| `GET /metrics` | 指标快照 | 无 |
| `POST /auth/register` `/auth/login` `/auth/refresh` | 鉴权 | 无 |
| `GET/POST /workspaces` | 工作区 | Bearer |
| `GET/POST /orgs`；`GET/PUT /orgs/:id`；成员管理 | 组织 | Bearer |
| `GET/POST /orgs/:id/projects` | 项目 | Bearer |
| `POST /projects/:id/docs/resolve` | 文档注册表 | Bearer |
| `GET/POST /projects/:id/tasks`；`PUT/DELETE /tasks/:id` | 任务 | Bearer |
| `GET/POST /orgs/:id/annotations`；`POST /annotations/:id/replies`；`PUT /annotations/:id/resolve` | 批注 | Bearer |
| `GET /notifications`；`PUT /notifications/read` `/read-all`；`GET /notifications/unread-count` | 通知 | Bearer |
| `GET /ws/notifications` | 通知 WS | token query |
| `GET /collab/:doc_id` | Yjs 协作 WS | token query |
| `GET /relay?client=mobile\|desktop` | 设备中继 WS | Bearer/Basic |
| `ANY /dav/:workspace_id` `/dav/:workspace_id/*path` | WebDAV | Bearer/Basic |
| `GET /sites/:user_id` `/*path` | 公开站点 | 无 |
| `ANY /dav-sites` `/dav-sites/*path` | 站点发布 | Bearer |
| `GET/POST /publish/status`；`DELETE /publish` | 发布 | Bearer |

### 4.2 鉴权契约

| 项 | 约定 | 证据 |
|----|------|------|
| 密码 | Argon2 | `auth.rs:17-32` |
| 令牌 | JWT HS256，`{sub,exp}`，TTL 7 天 | `auth.rs:9,34-58` |
| HTTP 鉴权 | `Authorization: Bearer` | `routes.rs:181-187` |
| WebDAV/relay | Bearer 或 Basic（email:password） | `dav.rs:16`；`relay.rs:175-206` |
| WebDAV 未授权 | `WWW-Authenticate: Basic realm="Lumina"` | `dav.rs:58-62` |
| 限流 | governor 按 IP；`X-Forwarded-For` 仅在 `trusted_proxy_hops>0` | `rate_limit.rs:18-70` |
| 请求 ID | `x-request-id` | `main.rs:27,167-169` |

### 4.3 WS 协议

| 通道 | 协议 | 证据 |
|------|------|------|
| 协作 | 二进制首字节 `MSG_SYNC=0` / `MSG_AWARENESS=1` | `collab.rs:18-20` |
| 中继 | JSON 文本 `paired`/`error` | `relay.rs:68-84,126-129` |
| 通知 | 每用户最多 5 连接，心跳 30s/45s | `notify_ws.rs:92-178` |

### 4.4 客户端 ↔ 后端契约类型

- 云契约类型来自 `@lumina/shared`（`packages/shared/src/cloud.ts`）：`AuthSession`、`WorkspaceSummary`。
- 客户端实现：`src/services/cloudSync/client.ts`；后端 JSON 对应 `server/src/models.rs`。

---

## 5. lumina-cloud 契约

| 项 | 约定 | 证据 |
|----|------|------|
| 契约文档 | `cloud/CONTRACT.md`（byte-identical 要求） | `cloud/PRD.md:92` |
| 许可证格式 | v/lid/email/sku/features/issued_at/expires_at/order_id/device_limit | `luminaCloud/types.ts:7-26` |
| 签名算法 | Ed25519（`@noble/ed25519`） | `verify.ts:23-50` |
| Canonical JSON | 自定义序列化 | `canonical-json.ts:19-56` |
| 端点 | `https://api.romantsy-note.com`（文档） | `cloud/CONTRACT.md:10,64` |
| 撤销列表 | 24h TTL，fail-open | `revocations.ts:41-136` |
| 错误码 | 10 个 `CloudErrorCode` | `types.ts:68-78` |

> **契约漂移**：代码默认域名 `https://api.lumina-note.com`（`luminaCloud/client.ts:17`），与文档不一致。

---

## 6. WebDAV 契约

| 项 | 约定 | 证据 |
|----|------|------|
| 配置 | `server_url/username/password/remote_base_path/auto_sync/sync_interval_secs` | `webdav/types.ts:6-20` |
| 默认 | `remote_base_path:'/'`、`sync_interval_secs:300` | `types.ts:22-32` |
| 操作 | `PROPFIND/GET/HEAD/PUT/MKCOL/DELETE/OPTIONS` | `server/src/dav.rs:81-93` |
| 单文件上限 | 200MB | `dav.rs:21` |
| 路径安全 | `sanitize_path` + canonicalize | `sites.rs:34-39`；`dav.rs:400-411` |

---

## 7. 更新契约

| 项 | 约定 | 证据 |
|----|------|------|
| 发布源 | GitHub Releases `blueberrycongee/Romantsy-Note` | `electron-builder.yml:8-12` |
| 更新器 | electron-updater；mac 用 `MacUnsignedUpdater` | `handlers/updater.ts`；`macUnsignedUpdater.ts` |
| 检查重试 | 3 次（1s→8s） | `useUpdateStore.ts:16-19` |
| 下载重试 | 3 次（1.5s→12s，120s 超时） | `UpdateChecker.tsx:25-29` |
| 可恢复下载 | `VITE_RESUMABLE_UPDATER_ENABLED` | `useUpdateStore.ts:615-621` |

---

## 8. VSCode 扩展桥契约

| 项 | 约定 | 证据 |
|----|------|------|
| 目标扩展 | `openai.chatgpt`(Codex)、`anthropic.claude-code` | `profiles.ts:75-87` |
| 下载源 | marketplace / open-vsx / github-release | `vscodeExtensions.ts:276-279` |
| 宿主引擎 | VSCode `1.98.0` | `profiles.ts:73` |
| 兼容性 | `CompatibilityStatus` 6 值 | `profiles.ts:56-62` |
| 激活守卫 | 平台/能力/smoke/allowUnverified | `vscodeExtensions.ts:218-267` |
| 宿主脚本 | `scripts/codex-vscode-host/host.mjs` | `electron-builder.yml:32-34` |

---

## 9. 契约风险汇总

| 风险 | 证据 | 影响 |
|------|------|------|
| 云域名不一致 | `CONTRACT.md:10` vs `client.ts:17` | 请求失败 |
| 模型目录双份 | `models.ts` vs `provider-bridge.ts` | 漂移 |
| 许可证公钥占位 | `PUBLIC_KEY.ts:12` | 校验必失败 |
| WebDAV 空实现 | `handlers/webdav.ts:246` | 伪成功 |
| 移动网关协议无桌面实现 | `ipc.ts` 无 mobile 组 | 功能不可用 |
| 中继配对无 token 校验 | `relay.rs:175-206` | 安全 |
| 插件契约双份 | `plugin-api` vs `types/plugins.ts` | 类型漂移 |
