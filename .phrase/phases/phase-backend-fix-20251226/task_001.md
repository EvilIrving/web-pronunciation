# task_001 [x] 修复后台添加单词报错问题

## Description
创建 SSR API 路由处理单词 CRUD 操作，使用 Service Role Key 绕过 RLS 权限限制。

## Output / Verification
- [x] 创建 `web/src/routes/api/words/+server.ts` API 路由
- [x] 实现 GET（获取单词列表）、POST（创建单词）、PUT（更新单词）、DELETE（删除单词）
- [x] 修改 `web/src/routes/admin/+page.svelte` 调用 SSR API
- [ ] 验证步骤：
  1. `cd web && pnpm dev`
  2. 访问 `http://localhost:5173/admin`
  3. 点击"新增词汇"
  4. 填写单词信息并保存
  5. 确认单词成功保存并显示在列表中

## Impact
- `web/src/routes/api/words/+server.ts` - 新增 API 路由
- `web/src/routes/admin/+page.svelte` - 修改前端调用方式
- `web/src/lib/supabase.ts` - 保留（客户端读取仍可用）

## Related
- issue001 - 后台管理添加单词报错
- plan_001 - 后台管理权限修复计划
- change_001 - 修复后台添加单词权限问题
