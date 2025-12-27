# task_003 [x] 音频改用 MiniMax T2A 生成

## Description
修复音频来源问题：
- 当前使用 `api.dictionaryapi.dev` 获取音频（不正确）
- 改为使用 MiniMax T2A API 生成音频，并上传到 R2 存储
- IPA 音标改用 Moonshot AI（KIMI）生成

## Output / Verification
- [x] 创建 `web/src/routes/api/tts/+server.ts` - MiniMax T2A 音频生成 API
- [x] 创建 `web/src/routes/api/ipa/+server.ts` - Moonshot AI IPA 生成 API
- [x] 修改 `web/src/lib/dictionary.ts` - 调用服务端 API 获取发音信息
- [ ] 验证步骤：
  1. `cd web && pnpm dev`
  2. 访问 `http://localhost:5173/admin`
  3. 快速添加单词（如 "coroutine"）
  4. 检查数据库中 `audio_url` 字段是否为 R2 URL（而非 dictionaryapi.dev URL）
  5. 点击播放按钮，确认音频可正常播放

## Impact
- `web/src/routes/api/tts/+server.ts` - 新增音频生成 API
- `web/src/routes/api/ipa/+server.ts` - 新增音标生成 API
- `web/src/lib/dictionary.ts` - 修改为调用服务端 API
- `web/src/routes/admin/+page.svelte` - 间接影响（通过 dictionary.ts）

## Related
- prd.md - 发音方案设计
- plan_001 - 后台管理权限修复计划
