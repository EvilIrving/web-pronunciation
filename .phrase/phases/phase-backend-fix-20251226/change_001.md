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

### Feature - 自定义音频上传功能
- **Add**: 创建 `web/src/routes/api/upload-audio/+server.ts` - 音频文件上传 API
  - 支持 MP3、WAV、WebM、OGG 格式
  - 最大文件限制 10MB
  - 支持两种上传方式：文件上传 和 URL 上传
  - 自动解析并上传到 R2 对象存储
  - 返回公开访问 URL
- **Modify**: `web/src/routes/admin/+page.svelte`:
  - 新增 `uploadingAudioId` 状态 - 按行跟踪上传状态
  - 新增 `fileInputRef` 和 `pendingUploadWord` - 文件选择管理
  - 新增 `showUploadModal`、`uploadMode`、`uploadUrl` 等状态 - 上传弹窗管理
  - 新增 `openUploadModal()` 函数 - 打开上传弹窗
  - 新增 `closeUploadModal()` 函数 - 关闭上传弹窗
  - 新增 `uploadAudioByUrl()` 函数 - 通过 URL 上传音频
  - 新增 `triggerUploadFile()` 函数 - 触发文件选择
  - 新增 `handleFileSelect()` 函数 - 处理文件上传逻辑
  - 新增音频上传 Modal - 支持 URL 和文件两种模式切换
  - 操作列 "📤" 按钮改为打开上传弹窗
- **Behavior**:
  - AI 生成音频错误时，点击 📤 按钮打开上传弹窗
  - 可选择「链接」模式粘贴音频 URL（如 https://api.frdic.com/...）
  - 可选择「文件」模式上传本地音频文件
  - 上传后自动更新数据库中的音频 URL
  - 上传过程中显示加载状态
  - 支持格式验证和文件大小限制
