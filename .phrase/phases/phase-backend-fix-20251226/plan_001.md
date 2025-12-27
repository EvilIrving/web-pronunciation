# plan_001 - 后台管理权限修复计划

## Purpose
修复后台管理添加单词报错问题，通过 SSR API 路由使用 Service Role Key 绕过 RLS 限制；并添加用户认证和前端 GraphQL 查询封装。

## Scope
- 创建 SSR API 路由处理单词 CRUD
- 修改前端 admin 页面调用 SSR API
- 添加用户认证（Supabase Auth）
- 封装前端 GraphQL/Supabase 查询模块
- 保护 admin 页面（登录后访问）
- 用户界面添加单词列表查询

## Milestones
1. [x] 问题分析与 root cause 确认
2. [x] 创建 API 路由 `web/src/routes/api/words/+server.ts`
3. [x] 实现 GET（列表）、POST（创建）、PUT（更新）、DELETE（删除）
4. [x] 修改前端 admin 页面调用 SSR API
5. [ ] 添加用户认证（Supabase Auth）
6. [ ] 创建 GraphQL 查询封装模块
7. [ ] 保护 admin 页面
8. [ ] 用户界面添加单词列表查询
9. [ ] 验证完整功能
