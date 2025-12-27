# task_004 [x] 编辑时支持生成音频

## Description
修复编辑单词时无法生成/重新生成音频的问题：
- 当前 `saveEdit()` 只保存表单数据，不自动获取音频
- 需要在编辑界面添加"生成音频"按钮

## Implementation
- 修改 `web/src/routes/admin/+page.svelte`:
  1. 添加 `editGeneratingAudio` 状态
  2. 在编辑表单添加"生成音频"按钮
  3. 实现 `generateAudioForEdit()` 函数

## Output / Verification
- [ ] 编辑单词时显示"生成音频"按钮
- [ ] 点击按钮后调用 TTS API 生成音频
- [ ] 生成的音频 URL 自动填入表单

## Impact
- `web/src/routes/admin/+page.svelte` - 添加生成音频功能
