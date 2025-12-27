# issue_001_admin_add_word_error

## Summary
后台管理添加单词时报错，无法成功保存新词汇。

## Environment
- Supabase Project: https://zncactastrdqxoxbpdzi.supabase.co
- 前端框架: SvelteKit + Vite + TailwindCSS

## Repro Steps
1. 进入 `/admin` 后台管理页面
2. 点击"新增词汇"按钮
3. 填写单词信息（word, language, category）
4. 点击"保存"按钮
5. 观察错误提示

## Expected vs Actual
- **Expected**: 单词成功保存到数据库，列表刷新显示新词汇
- **Actual**: 保存失败，弹出错误提示（具体错误信息待确认）

## Investigation
### Root Cause
根据 `supabase/create_words_table.sql` 中的 RLS 策略：
```sql
-- 管理员写入策略（仅认证用户可增删改）
CREATE POLICY "words_authenticated_write" ON words
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

前端 `admin/+page.svelte` 使用 `PUBLIC_SUPABASE_ANON_KEY` 初始化 Supabase 客户端：
```typescript
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

**问题**: anon key 对应的是匿名用户，`auth.role()` 返回 `anon`，不满足 `authenticated` 条件，导致 INSERT 操作被拒绝。

### Related Files
- `web/src/routes/admin/+page.svelte` - 后台管理页面
- `web/src/lib/supabase.ts` - Supabase 客户端初始化
- `supabase/create_words_table.sql` - 数据库 Schema 和 RLS 策略

## Fix
### Solution
通过 SSR API 路由处理需要权限的操作：

1. 创建 SvelteKit API 路由：`web/src/routes/api/words/+server.ts`
2. 在 API 路由中使用 `SUPABASE_SERVICE_ROLE_KEY`（服务端，安全）
3. 修改前端 `admin/+page.svelte` 调用 SSR API 执行 CRUD 操作

### Trade-offs
- **Pros**: Service Role bypass RLS，适合服务端管理操作
- **Cons**: 需要额外的 API 层，增加了复杂度

## Verification
1. 启动开发服务器: `cd web && pnpm dev`
2. 访问 `/admin` 页面
3. 尝试添加新单词
4. 验证单词成功保存并显示在列表中

## User Confirmation
- [ ] 用户已确认问题
- [ ] 用户已确认修复方案

## Resolved
- **At**: 2025-12-26
- **By**: Agent
- **Commit**: TBD (待用户验证后补充)

## Related
- `task001` - 修复后台添加单词报错问题
