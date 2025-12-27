# Change Log Index

变更记录索引，指向各 phase 的 `change_*` 文件。

---

## phase-backend-fix-20251226 (2025-12-26)
- `change_001` - 修复后台添加单词权限问题、后台交互优化、音频改用真人发音、编辑时支持生成音频 ([链接](../phases/phase-backend-fix-20251226/change_001.md))
  - **task005** (2025-12-27) - 后台交互优化：音频重生成按钮独立，一键生成并自动保存
  - **Fix** (2025-12-27) - Svelte rune 错误修复 + 登录认证持久化问题
  - **Feature** (2025-12-27) - 自定义音频上传功能：支持上传自定义音频文件，解析后上传到 R2
  - **Feature** (2025-12-27) - 删除操作交互优化：乐观更新 + 撤销队列 + Toast 通知
  - **Refactor** (2025-12-27) - TTS 改用真人发音（frdic.com）：替换 MiniMax T2A，使用有道词典真人发音 API
