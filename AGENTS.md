“文档驱动开发（Doc-Driven Development）”：先锁定文档 →  拆 `taskNNN` → 实现与验证 → 回写文档。

---

## 0. 原则（按优先级）

- 仓库既有规范 > 本文；冲突时按 `README`/`STYLEGUIDE` 等执行，并在 `issue_*`/`change_*` 记录取舍。
- 文档为事实来源：需求、交互、接口只能来自 `docs/prd.md` 和 `.phrase/` 文档。
- 单次仅处理一个原子任务；所有改动可追溯到 `taskNNN` 与其依据（`spec`/`issue`/`adr`）。
- 每个 `taskNNN` 必须说明验证方式（测试或手动步骤）。
- 实现完成必须回写：`task_*`、`change_*`，必要时更新 `spec_*`/`issue_*`/`adr_*`。

---

## 1. 仓库结构与文档

- 代码根：`web/`（SvelteKit 应用）
  - `web/src/lib/` - 共享库（LLM 客户端、Supabase、类型定义）
  - `web/src/routes/` - 页面与 API 路由
  - `web/src/routes/api/` - 服务端 API
- 数据库：`supabase/`（SQL schema、类型定义）
- 文档根：
  - `docs/` - 产品文档（PRD、API 参考）
  - `.phrase/` - 阶段性工作文档
    - `.phrase/phases/phase-<purpose>-<YYYYMMDD>/`
    - `.phrase/docs/` - 全局索引

---

## 2. Phase 工作流

1. **Phase Gate**（仅当用户明确开启新阶段）：在新 `phase-*` 目录创建最小集 `spec_*`, `plan_*`, `task_*`, 视需求补 `tech-refer_*`/`adr_*`，`issue_*` 可后置。
2. **In-Phase Loop**（默认）：  
   - 新需求 → 更新当前 `plan_*` → 拆 `taskNNN`。  
   - 实现 → 在 `task_*` 中新增/更新并执行对应任务。  
   - Bug → 在 `.phrase/docs/ISSUES.md` 登记 `issueNNN`，在 phase 写详情，再拆 `taskNNN`。  
   - 不可逆决策 → 先写 `adr_*` 或在 `tech-refer_*` 增 “Decision”。
3. **Task 闭环**：完成后需  
   1) 将 `task_*` 条目标记 `[x]`  
   2) 在 phase `change_*` 记录条目，并于 `.phrase/docs/CHANGE.md` 加索引  
   3) 若影响交互，更新对应 `spec_*`  
   4) 若解决问题，更新 `ISSUES.md` 和 issue 详情（含验证结论）

当目标与当前 phase purpose 明显不同、需要独立里程碑或架构大重构时，可建议开启新 phase，但需用户确认。

### Phase 生命周期

- 开启阶段：在 `.phrase/phases/phase-<purpose>-<date>/` 下创建 `spec/plan/task/...`。
- 阶段完结：用户确认后，将整个目录重命名为 `DONE-phase-<purpose>-<date>/`，同时把主要文档也按规则改为 `DONE-PLAN-*`、`DONE-TASK-*` 等，确保一眼可见结项状态。

---

## 3. Task / Issue 规范

- `taskNNN` 为三位递增 ID（`task001` 起），不可重排或复用；拆分/合并需创建新 ID 并在原任务注明流向。
- 任何对 `task_*` 的增删改/勾选都要在当前 phase `change_*` 记录一次，可批量合并但必须可追溯。
- 原子任务标准：一次工作会话可完成、产出可观察、可独立验证，既不过细也不过粗。
- Issue：
  - 全局索引：`.phrase/docs/ISSUES.md` 用 `issueNNN [ ]/[x]` 并链接 phase 详情。
  - 详情文件 `issue_<purpose>_<YYYYMMDD>.md` 需含环境、复现、调查、根因、修复、验证、关联的 `taskNNN`/提交。
  - 用户可感知问题需在标记 `[x]` 前获得确认，并记录 `Resolved At/By/Commit`。

---

## 4. Build / Test / Dev

- 工作目录：`web/`
- 开发服务器：`pnpm dev`（Vite 热重载，默认端口 5173）
- 构建：`pnpm build`（输出到 `.svelte-kit/`）
- 预览：`pnpm preview`
- 类型检查：`pnpm check` 或 `pnpm check:watch`
- 依赖管理：使用 `pnpm`（workspace 配置）
- 环境变量：复制 `.env.example` 为 `.env` 并填写 API 密钥

---

## 5. 编码与验证

- 框架：SvelteKit 2.x + Svelte 5（使用 runes 响应式：`$state`、`$derived`、`$effect`）
- 样式：Tailwind CSS 4，响应式设计优先
- 风格：TypeScript 严格模式；2-space 缩进；类型 PascalCase，变量/函数 camelCase
- API 路由：使用 `+server.ts`，返回 `json()` 响应
- 数据库：通过 `/api/words` 路由操作（使用 Service Role Key 绕过 RLS）
- LLM 调用：统一使用 `$lib/llm/client.ts`，支持 Kimi/MiniMax 切换
- 遵循现有错误处理模式（try-catch + console.error + json 响应）
- 测试优先覆盖核心逻辑；UI 变更可提供手动验证步骤

---

## 6. 文档更新与 Changelog

- `change_*`：phase 内的真实变更记录；每个完成的 `taskNNN` 至少一条，包含日期、文件/路径、Add|Modify|Delete、受影响函数、行为/风险说明，按时间倒序。
- `.phrase/docs/CHANGE.md`：仅索引与摘要，指向对应 phase `change_*` 条目；可按工作会话批量更新。
- `spec_*`/`plan_*`/`tech-refer_*`/`adr_*`/`issue_*` 均需随变更回写（增量即可），保持单一事实来源。

---

## 7. 提交、PR 与安全

- 默认使用 Conventional Commits（`feat:`, `fix:`, `docs:`, `test:`, `chore:` 等），一份提交聚焦单个 `taskNNN`。
- PR 描述需列出关联的 `taskNNN`/`issueNNN`、动机、行为变化、验证方式、风险/回滚方案，并在 UI 变化时附截图/GIF。
- 禁止提交密钥、token、证书、真实用户数据；涉及权限/配置的任务，需在 `spec_*` 和 `tech-refer_*` 清楚描述失败反馈、API 边界与排查方式。

---

## 8. 模板速览

- `spec`: Summary / Goals & Non-goals / User Flows（操作→反馈→回退）/ Edge Cases / Acceptance Criteria
- `plan`: Milestones / Scope / Priorities / Risks & Dependencies /（可选）Rollback
- `tech-refer`: Options / Proposed Approach / Interfaces & APIs / Trade-offs / Risks & Mitigations
- `task`: `task001 [ ] 产出 + 验证方式 + 影响范围`
- `issue`: `issueNNN [ ] Summary + Environment + Repro + Expected vs Actual + Investigation + Fix + Verification + User Confirmation + Resolved At/By/Commit`
- `adr`: Context / Decision / Alternatives / Consequences / Rollback

---

## 9. 协作表达提示

- 解释方案时优先描述用户操作（快捷键/鼠标/命令）、可见反馈、撤销/失败路径、边界情况。
- 引用文档时用“文件名 + 小节”口语化说明，不逐字背诵。
- 提供可选方案时说明它们属于当前还是后续里程碑，帮助用户决策。

---

## 10. 环境变量参考

```env
# Supabase
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Moonshot AI (Kimi)
MOONSHOT_API_KEY=your_moonshot_api_key
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1

# MiniMax
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_BASE_URL=https://api.minimaxi.com/v1

# Cloudflare R2
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-r2-public-url

# LLM 默认模型
LLM_MODEL=kimi
```

---

## 11. 常用开发命令

```bash
# 进入 web 目录
cd web

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 类型检查
pnpm check

# 构建
pnpm build

# 预览构建结果
pnpm preview
```
