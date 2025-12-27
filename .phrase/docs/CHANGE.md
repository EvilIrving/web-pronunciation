# Change Log Index

变更记录索引，指向各 phase 的 `change_*` 文件。

---

## phase-eudic-crawler-20251227 (2025-12-27)
- `change_003` - 移动端布局优化 ([链接](../phases/phase-eudic-crawler-20251227/change_002.md))
  - **task004** (2025-12-27) - 优化首页移动端布局：字体调整为 `text-sm`，触摸目标增大，安全区域适配，响应式断点调整（640px 2 列）
- `change_002` - 字段重命名：ipa/audio_url → ipa_us/audio_url_us ([链接](../phases/phase-eudic-crawler-20251227/change_002.md))
  - **Refactor** (2025-12-27) - 字段命名统一：将 `ipa` 改为 `ipa_us`，`audio_url` 改为 `audio_url_us`，与英音字段 `ipa_uk`/`audio_url_uk` 保持一致的命名规范

## phase-backend-fix-20251226 (2025-12-26)
- `change_001` - 修复后台添加单词权限问题、后台交互优化、音频改用真人发音、编辑时支持生成音频 ([链接](../phases/phase-backend-fix-20251226/change_001.md))
  - **task005** (2025-12-27) - 后台交互优化：音频重生成按钮独立，一键生成并自动保存
  - **Fix** (2025-12-27) - Svelte rune 错误修复 + 登录认证持久化问题
  - **Feature** (2025-12-27) - 自定义音频上传功能：支持上传自定义音频文件，解析后上传到 R2
  - **Feature** (2025-12-27) - 删除操作交互优化：乐观更新 + 撤销队列 + Toast 通知
  - **Refactor** (2025-12-27) - TTS 改用真人发音（frdic.com），保留 AI 备用：替换 MiniMax T2A，默认使用有道词典真人发音 API，保留 MiniMax 实现可回退
  - **Refactor** (2025-12-27) - 列表操作改为乐观更新：添加/编辑/批量导入/音频操作后不再重新加载整个列表，保持与删除一致的优雅交互，同时修复获取所有数据（limit=10000）
  - **Docs** (2025-12-27) - PRD 文档更新：添加"八.1 用户体验优化"章节描述乐观更新策略；更新发音方案说明（首选有道真人发音，MiniMax 备用）；添加发音服务模块说明
  - **Tech** (2025-12-27) - 技术方案分析：Vercel 自定义域名部署步骤 + Flutter 客户端实现方案（只需调用公开 API，无需认证）
