# task_002 [x] 优化后台管理交互 - 快速输入和播放功能

## Description
优化后台管理页面的交互体验：
1. 去除弹窗交互，新增/编辑直接在表格行内进行
2. 表格新增播放按钮列，快速听发音
3. 保持批量导入功能

## Output / Verification
- [x] 修改 `web/src/routes/admin/+page.svelte`:
  - [x] 顶部新增一行用于快速添加单词（输入框 + Enter 保存）
  - [x] 表格每行支持行内编辑（点击编辑按钮变输入框）
  - [x] 新增播放按钮列（有 audio_url 才显示）
  - [x] 删除按钮保持
  - [x] 去除新增/编辑 Modal
- [ ] 验证步骤：
  1. `cd web && pnpm dev`
  2. 访问 `http://localhost:5173/admin`
  3. 顶部输入单词按 Enter 快速保存
  4. 点击播放按钮听发音
  5. 点击编辑按钮在行内修改单词

## Impact
- `web/src/routes/admin/+page.svelte` - 交互优化

## Related
- plan_001 - 后台管理权限修复计划
