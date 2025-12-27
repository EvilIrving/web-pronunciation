# task_003 [ ] 创建 GraphQL 查询封装模块

## Description
封装前端 GraphQL/Supabase 查询功能，提供统一的 API 接口供用户界面和 admin 页面使用。

## Output / Verification
- [ ] 创建 `web/src/lib/graphql/queries.ts`:
  - [ ] `getWords()` - 获取单词列表（支持过滤、排序、分页）
  - [ ] `getWord(id)` - 获取单个单词详情
  - [ ] `createWord(data)` - 创建单词
  - [ ] `updateWord(id, data)` - 更新单词
  - [ ] `deleteWord(id)` - 删除单词
- [ ] 创建 `web/src/lib/graphql/index.ts` - 统一导出
- [ ] 验证步骤：
  1. `cd web && pnpm dev`
  2. 访问 `http://localhost:5173/`
  3. 确认首页显示单词列表
  4. 测试筛选、排序功能

## Impact
- `web/src/lib/graphql/queries.ts` - 新增 GraphQL 查询模块
- `web/src/lib/graphql/index.ts` - 新增导出入口
- `web/src/routes/+page.svelte` - 使用新模块获取数据

## Related
- plan_001 - 后台管理权限修复计划
- task_004 - 实现用户认证功能
