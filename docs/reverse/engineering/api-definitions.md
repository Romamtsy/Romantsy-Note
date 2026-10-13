# Romantsy-Note API 定义

> 生成日期：2026-05-30
> 基线 commit：`92e125c7`（`main`）
> 范围：主进程 IPC 命令 + 自部署后端 HTTP/WS 路由 + 内嵌 opencode API

> 说明：本项目为桌面应用，前端不消费传统 REST API。此处"API"指 **主进程 IPC 命令契约**（渲染↔主进程）与 **自部署后端 HTTP/WS 路由**。

---

## 1. 主进程 IPC 命令契约

### 1.1 传输层

| Channel | 方向 | 用途 | 证据 |
|---------|------|------|------|
| `host-invoke` / `tauri-invoke` | R→M (handle) | 统一命令分发 | `ipc.ts:252-253` |
| `tauri-emit` | R→M (on) | 事件广播 | `ipc.ts:256-261` |
| `__tauri_event__` | M→R (send) | 事件总线 | `ipc.ts:164` |
| `__preload_ready` | R→M | preload 握手 | `ipc.ts:263-266` |
| `window:minimize/maximize/close` | R→M | 窗口控制 | `ipc.ts:268-281` |
| `opencode:get-server-info` | R→M | 获取 server 凭据 | `agent-v2/ipc.ts:11,41` |
| `opencode:server-changed` | M→R | server 重启通知 | `agent-v2/ipc.ts:12,58` |
| `main-console` | M→R | 日志转发 | `preload/index.ts:117` |

### 1.2 文件系统命令（`handlers/fs.ts:410-621`）

| 命令 | 说明 |
|------|------|
| `read_file` / `save_file` / `write_text_file` | 文本读写 |
| `read_binary_file_base64` / `write_binary_file` | 二进制读写 |
| `list_directory` / `list_dir_shallow` / `list_workspace` | 目录列举 |
| `fs_walk_paths` / `fs_set_allowed_roots` | 路径遍历/根限制 |
| `create_file` / `create_dir` / `ensure_dir` | 创建 |
| `delete_file` / `rename_file` / `move_file` / `move_folder` | 删除/移动 |
| `path_exists` / `show_in_explorer` | 存在性/定位 |
| `append_debug_log` / `estimate_dir_size` | 调试/体积 |
| `plugin:fs\|*` | 插件兼容命令 |

### 1.3 平台命令（`handlers/platform.ts:15-141`）

| 命令前缀 | 说明 |
|---------|------|
| `plugin:path\|*` | 路径工具 |
| `plugin:os\|*` | 系统信息 |
| `plugin:shell\|open` | 打开外链/文件 |
| `plugin:process\|*` | 进程信息 |
| `plugin:clipboard-manager\|*` | 剪贴板 |
| `plugin:window\|set_size` | 窗口尺寸 |
| `plugin:dialog\|open\|save\|message\|ask\|confirm` | 对话框 |
| `open_new_window` / `get_version` | 新窗口/版本 |

### 1.4 存储命令（`handlers/store.ts:38-108`）

| 命令 | 说明 |
|------|------|
| `secure_store_get/set/delete` | 安全存储（keychain） |
| `plugin:store\|*` | 插件兼容 |

### 1.5 WebDAV 命令（`handlers/webdav.ts:125-260`）

`webdav_set_config/get_config/test_connection/set_config_password/list_remote/list_all_remote/download/upload/create_dir/delete/scan_local/compute_sync_plan/execute_sync/quick_sync`

> **空实现**：`compute_sync_plan` 恒空、`execute_sync`/`quick_sync` 恒 `success:true,0/0/0`（`handlers/webdav.ts:246-270`）。

### 1.6 更新命令（`handlers/updater.ts:159-228`）

`update_start_resumable_install/cancel_resumable_install/clear_resumable_cache/get_resumable_status/quit_and_install` + 旧 `plugin:updater|check`

### 1.7 插件命令（`handlers/plugins.ts:212-264`）

`plugin_list/plugin_read_entry/plugin_get_workspace_dir/plugin_scaffold_example/plugin_scaffold_theme/plugin_scaffold_ui_overhaul`

### 1.8 VSCode 扩展命令（`handlers/vscodeExtensions.ts:107-207`）

`vscode_extensions_check_latest/install_latest/install_local_vsix/install_compat_profiles/activate_installed/rollback/open_active/get_runtime_state`

### 1.9 云许可命令（`handlers/luminaCloudLicense.ts:53-111`）

`lumina_cloud_save_license/load_license/remove_license`

### 1.10 Agent 命令（`agent-v2/ipc-dispatch.ts:68-503`）

命令前缀 `agent_/vault_/wiki_/image_/skill_`。关键：

| 命令 | 说明 | 状态 |
|------|------|------|
| `agent_set_*` | provider 设置 | ✅ |
| `image_generate_direct` | 直连生图 | ✅ |
| `image_*_settings` | 图像 provider 设置 | ✅ |
| `skill_write` / `skill_delete` | 技能 CRUD | ✅ |
| `vault_initialize` | 初始化 wiki | ✅ |
| `vault_run_lint` | wiki lint | ❌ 占位 |
| `wiki_get_settings/set_settings/reset_settings/rebuild/synthesize_note/stop` | wiki 合成 | ⚠️ 无 UI 调用 |

### 1.11 其它

`start_file_watcher`（`ipc.ts:180`）、`set_dirty_state`（`ipc.ts:240`）、`export_diagnostics`（`handlers/diagnostics.ts:37`）。

> **缺失**：无 `mobile_*` 命令组（移动网关功能不可用）。

---

## 2. 自部署后端 HTTP API

### 2.1 鉴权

| 方法 & 路径 | 请求 | 响应 | 证据 |
|------------|------|------|------|
| `POST /auth/register` | `{email, password}` | JWT + user | `routes.rs` |
| `POST /auth/login` | `{email, password}` | JWT + user | `routes.rs` |
| `POST /auth/refresh` | token | 新 JWT | `routes.rs` |

### 2.2 工作区 / 组织 / 项目 / 任务 / 批注 / 通知

| 方法 & 路径 | 说明 |
|------------|------|
| `GET/POST /workspaces` | 列表/创建 |
| `GET/POST /orgs`；`GET/PUT /orgs/:id`；`POST/DELETE /orgs/:id/members[/:user_id]` | 组织与成员（admin/member/guest） |
| `GET/POST /orgs/:id/projects` | 项目 |
| `POST /projects/:id/docs/resolve` | 文档注册表 |
| `GET/POST /projects/:id/tasks`；`PUT/DELETE /tasks/:id` | 任务（默认 status=todo, priority=medium） |
| `GET/POST /orgs/:id/annotations`；`POST /annotations/:id/replies`；`PUT /annotations/:id/resolve` | 批注 |
| `GET /notifications`；`PUT /notifications/read` `/read-all`；`GET /notifications/unread-count` | 通知 |

### 2.3 文件与发布

| 方法 & 路径 | 说明 |
|------------|------|
| `ANY /dav/:workspace_id[/**]` | WebDAV |
| `GET /sites/:user_id[/**]` | 公开站点（无鉴权） |
| `ANY /dav-sites[/**]` | 站点发布 |
| `GET/POST /publish/status`；`DELETE /publish` | 发布状态/取消 |

### 2.4 WebSocket

| 路径 | 协议 | 鉴权 |
|------|------|------|
| `GET /ws/notifications` | 通知推送 | token query |
| `GET /collab/:doc_id` | Yjs CRDT（首字节 0=SYNC/1=AWARENESS） | token query |
| `GET /relay?client=mobile\|desktop` | 设备中继（JSON `paired`/`error`） | Bearer/Basic |

### 2.5 运维

`GET /health`、`GET /metrics`。

---

## 3. 内嵌 opencode API（渲染消费）

| 端点/方法 | 说明 | 证据 |
|----------|------|------|
| `GET /global/health` | 健康检查 | `agent-v2/server.ts` |
| `GET /skill` | 技能列表 | `services/opencode/skills.ts:66` |
| `promptAsync` | 发送任务（`agent:"build"`） | `useOpencodeAgent.ts:1396` |
| `session.abort` | 中止 | `useOpencodeAgent.ts:1453` |
| `replyPermission` | 工具审批 | `useOpencodeAgent.ts:483` |
| SSE 事件 | `session.*` / `message.*` | `useOpencodeAgent.ts:835-1021` |

---

## 4. 外部 Provider API（出站）

### 4.1 LLM

见 `integration-contracts.md` §2。统一经 Vercel AI SDK，支持 `apiKey` / `baseURL` / `headers`。

### 4.2 图像生成

| provider | 说明 | 证据 |
|----------|------|------|
| `openai-image` | OpenAI 图像 | `image-providers/registry.ts:15-36` |
| `google-image` | Google 图像 | 同上 |
| `bytedance-image` | 字节图像 | 同上 |

### 4.3 lumina-cloud

| 端点 | 说明 | 证据 |
|------|------|------|
| `POST /license/verify` | 许可证校验 | `luminaCloud/client.ts` |
| `GET /usage` | 用量 | `CloudUsagePanel.tsx` |
| `GET /revocations` | 撤销列表 | `revocations.ts` |

---

## 5. API 契约风险

| 风险 | 证据 | 影响 |
|------|------|------|
| WebDAV 同步 API 空实现 | `handlers/webdav.ts:246` | 伪成功 |
| mobile_* API 缺失 | `ipc.ts:171-215` | 功能不可用 |
| 旧 Tauri 命令名残留 | `themePlugin.ts:95` | 主题 CRUD 失败 |
| 云域名不一致 | `CONTRACT.md:10` vs `client.ts:17` | 请求失败 |
| wiki lint API 占位 | `ipc-dispatch.ts:438` | 功能不可用 |
| 中继配对无 token 校验 | `relay.rs:175-206` | 安全 |
| 协作无文档 ACL | `collab.rs:205-221` | 安全 |
