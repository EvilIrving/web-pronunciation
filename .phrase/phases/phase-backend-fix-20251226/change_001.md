# change_001

## 2024-12-26

### task001 - 修复后台添加单词报错问题
- **Add**: 创建 `web/src/routes/api/words/+server.ts` API 路由
- **Add**: 实现 GET（获取单词列表）、POST（创建单词）、PUT（更新单词）、DELETE（删除单词）
- **Modify**: 修改 `web/src/routes/admin/+page.svelte` 调用 SSR API

### task002 - 优化后台管理交互 - 快速输入和播放功能
- **Modify**: `web/src/routes/admin/+page.svelte`:
  - 顶部添加快速输入框（输入后按 Enter 保存，去除弹窗）
  - 表格支持行内编辑（点击编辑按钮变输入框）
  - 新增播放按钮列（有 audio_url 才显示）
  - 保留批量导入功能

### task003 - 音频改用 MiniMax T2A 生成
- **Modify**: `web/src/lib/dictionary.ts`:
  - 移除 `api.dictionaryapi.dev` 调用
  - 新增 `fetchIPA()` 调用 Moonshot AI API
  - 新增 `generateAudio()` 调用 MiniMax T2A API
- **Add**: 创建 `web/src/routes/api/tts/+server.ts` - MiniMax T2A 音频生成 API
- **Add**: 创建 `web/src/routes/api/ipa/+server.ts` - Moonshot AI IPA 生成 API

### task004 - 编辑时支持生成音频
- **Modify**: `web/src/routes/admin/+page.svelte`:
  - 新增 `editGeneratingAudio` 状态
  - 新增 `generateAudioForEdit()` 函数
  - 编辑模式添加"🎵"按钮生成音频

### task005 - 后台交互优化：音频重生成按钮独立
- **Modify**: `web/src/routes/admin/+page.svelte`:
  - 新增 `regeneratingAudioId` 状态（按行跟踪加载状态）
  - 新增 `regenerateAudio()` 函数 - 一键生成音频并自动保存更新列表
  - 操作列新增 "🔊" 按钮（浏览模式可见）- 点击直接生成音频，无需进入编辑
  - 移除编辑模式中的音频生成按钮 - 编辑仅支持修改单词和音标
  - 编辑表单移除 `audio_url` 字段
- **Behavior**:
  - 重新生成音频和删除为高频操作，可快速执行
  - 编辑为低频操作，需点击"编辑"按钮进入
  - 符合用户期望的交互优先级

## 2024-12-27

### Fix - Svelte rune 错误修复
- **Modify**: 重命名 `web/src/lib/auth.ts` → `web/src/lib/auth.svelte.ts`
  - `$state` rune 只能在 `.svelte` 或 `.svelte.ts` 文件中使用
- **Modify**: 更新 `web/src/routes/admin/+page.svelte` import
- **Modify**: 更新 `web/src/routes/login/+page.svelte` import
- **Delete**: 删除旧的 `web/src/lib/auth.ts`
- **Behavior**: 修复运行时错误 `rune_outside_svelte`

### Fix - 登录认证持久化问题
- **Add**: `web/src/routes/+layout.server.ts` - 服务端 session 加载
- **Add**: `web/src/lib/auth.svelte.ts` - localStorage 持久化用户状态
- **Modify**: `web/src/routes/admin/+page.svelte`:
  - 从 localStorage 恢复认证状态
  - 页面刷新后保持登录
  - 修复登录成功但页面跳转失败问题
- **Modify**: `web/src/routes/login/+page.svelte` - 添加 goto 跳转
- **Behavior**: 登录后自动跳转，刷新页面保持登录状态
