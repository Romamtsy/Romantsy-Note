# Romantsy-Note rebrand and roadmap notes

## Rebrand scope

This fork is branded publicly as **Romantsy-Note**. The first-pass rebrand covers:

- app/package metadata
- Electron product name
- visible title bar and welcome-screen copy
- renderer icon assets
- README/product-facing copy

Some internal names intentionally remain unchanged for compatibility:

- `.lumina` vault metadata folders
- `window.lumina` preload bridge
- `lumina-*` localStorage keys
- `@lumina/shared` package imports
- existing IPC command names such as `lumina_cloud_*`

Those names are implementation contracts. Renaming them should be handled as a migration project with backward-compatible reads and tests.

## Current feature map

- Local Markdown vaults: open folders, read/write notes, manage file trees.
- Rich editing: CodeMirror editor, reading/preview flows, Markdown rendering.
- Knowledge links: `[[WikiLink]]`, local graph, hover previews.
- AI workspace: embedded opencode server, model provider settings, session/event streaming.
- Agent skills: built-in skills and vault-level custom skills.
- Plugin ecosystem: bundled/user/workspace plugins, UI/theme extension points.
- Media/document support: PDF viewing/annotations, images, diagrams, Mermaid, LaTeX.
- Sync options: WebDAV and cloud/self-hosting related modules.
- Developer tooling: Vitest unit/repro tests, Electron build, native runtime staging.

## Recommended product changes

### Short-term changes

- Add a first-run guided setup that explains vault selection, model setup, and test prompts.
- Add a provider status card in the AI panel: configured, missing key, server starting, failed.
- Add a built-in demo vault generator so new users can test WikiLink, Mermaid, AI, and search quickly.
- Improve Windows setup docs for Bun, Python/node-gyp, and opencode bundle generation.
- Add a diagnostics screen that checks Electron bridge, opencode server, provider config, and vault write permissions.

### Medium-term changes

- Build a real RAG index dashboard: indexed file count, failed files, last index time, and manual reindex.
- Add graph filters for tags, folders, orphan notes, and recent edits.
- Add conflict resolution for WebDAV/cloud sync with side-by-side diff.
- Add plugin safe mode in settings for disabling appearance/runtime plugins after a crash.
- Add export templates for PDF/HTML/static website publishing.

### Codebase cleanup opportunities

- Separate visible brand constants from internal compatibility keys.
- Centralize app branding in one `branding.ts` module instead of scattering strings.
- Add migration tests before renaming `.lumina` or `window.lumina`.
- Replace hardcoded repository URLs with configurable build-time metadata.
- Fix Windows ESM path issues in scripts such as the opencode smoke test.
- Add end-to-end startup tests for `npm run dev` and packaged Windows builds.

## Features to consider removing or hiding

- Hide paid cloud/license UI until a working Romantsy backend exists.
- Hide update-checker GitHub release links until the new repository is created.
- Hide unfinished packaged opencode native dependency flows until `dist` is verified.
- Move experimental VS Code extension integrations behind a developer flag.

