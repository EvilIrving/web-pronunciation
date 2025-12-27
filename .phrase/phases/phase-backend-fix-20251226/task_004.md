# task_004 [ ] 实现用户认证功能

## Description
实现 Supabase 用户认证功能，包括登录、注册、退出，保护 admin 页面只允许登录用户访问。

## Output / Verification
- [ ] 创建 `web/src/lib/auth.ts`:
  - [ ] `signIn(email, password)` - 邮箱密码登录
  - [ ] `signUp(email, password)` - 注册新用户
  - [ ] `signOut()` - 退出登录
  - [ ] `getSession()` - 获取当前会话
  - [ ] `onAuthStateChange(callback)` - 监听认证状态变化
- [ ] 创建 `web/src/routes/login/+page.svelte` - 登录页面
- [ ] 创建 `web/src/routes/logout/+server.ts` - 退出 API
- [ ] 修改 `web/src/routes/admin/+page.svelte`:
  - [ ] 添加登录状态检查
  - [ ] 未登录用户重定向到登录页
  - [ ] 显示登录用户信息
- [ ] 验证步骤：
  1. `cd web && pnpm dev`
  2. 访问 `http://localhost:5173/admin`
  3. 确认重定向到登录页
  4. 登录后访问 admin 页面
  5. 测试退出功能

## Impact
- `web/src/lib/auth.ts` - 新增认证模块
- `web/src/routes/login/+page.svelte` - 新增登录页面
- `web/src/routes/logout/+server.ts` - 新增退出 API
- `web/src/routes/admin/+page.svelte` - 添加认证保护

## Related
- plan_001 - 后台管理权限修复计划
- task_003 - GraphQL 查询封装模块
