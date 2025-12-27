# plan_001 - 后台管理权限修复计划

## Purpose
修复后台管理添加单词报错问题，通过 SSR API 路由使用 Service Role Key 绕过 RLS 限制。

## Scope
- 创建 SSR API 路由处理单词 CRUD
- 修改前端 admin 页面调用 SSR API
- 保持读取操作使用 anon key（公开读取无需认证）

## Milestones
1. [x] 问题分析与 root cause 确认
2. [ ] 创建 API 路由 `web/src/routes/api/words/+server.ts`
3. [ ] 实现 GET（列表）、POST（创建）、PUT（更新）、DELETE（删除）
4. [ ] 修改前端 admin 页面调用 SSR API
5. [ ] 验证修复效果

## Dependencies
- Supabase 项目配置正确（URL、Keys）
- 环境变量已配置 `SUPABASE_SERVICE_ROLE_KEY`

## Risks & Mitigations
- **风险**: Service Role Key 泄露  
  **缓解**: 仅在服务端 API 路由使用，不暴露给客户端
- **风险**: API 路由安全  
  **缓解**: 可后续添加简单的密钥验证或依赖 Supabase Auth

## Rollback
- 如果 API 路由出现问题，可以临时回退到原始的客户端直接调用方式（但会再次遇到权限问题）
