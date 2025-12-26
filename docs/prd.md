
PRD：Tech Vocabulary Index（程序员技术词汇发音索引）

版本：v0.1
状态：MVP
目标用户：不同语言背景程序员
核心价值：避免技术词汇发音错误
原则：KISS / 去复杂度 / 外包非核心能力

---

一、背景与问题定义

大量程序员在以下场景中存在高频发音错误：

* 技术交流（面试 / 会议 / 分享）
* 视频学习 / 技术播客
* 英文技术文档阅读后的口头表达

问题并不在于“不会英语”，而在于：

1. 技术词汇并非普通英语（coroutine / cache / daemon / enum）
2. 技术文档是主要词源，但缺乏发音提示
3. 社区长期形成错误读法并被传播

现有词典产品：

* 面向通用英语
* 不区分技术语境
* 不覆盖大量技术命名实体

本产品不尝试解决“英语学习”，只解决一个问题：

**这个技术词，该怎么念。**

---

二、产品定位

* 常见发音容易错误的词汇
* 它属于哪一类技术命名
* 快速听到正确发音

---

三、目标与非目标

目标（MVP）：

* 覆盖 Kotlin / JS / TS / Swift 等技术词汇
* 支持搜索、分类筛选
* 点击即听权威发音
* 支持管理员高效维护词库

---

四、核心功能列表

4.1 前台功能（Flutter：Web / Android / iOS）

1. 词汇列表

   * 支持分页或无限滚动
   * 创建时间降序

2. 搜索

   * 模糊匹配 word / normalized
   * 实时搜索

3. 筛选

   * 按语言（Kotlin / JS / TS / Swift / Common）
   * 按分类（keyword / api / library / concept / tool）

列表 Item 显示字段：

* word
* IPA 英音
* IPA 美音

---

4.2 后台管理功能（Web）

1. 词汇管理（CRUD）

   * 新增 / 编辑 / 删除词条
   * 修改分类 / 语言 / 标签

2. 批量导入（核心功能）

   * 支持 CSV / JSON / 文本粘贴
   * 一行一个词或结构化导入
   * 导入时获取标准音标，英音 美音 并保存音频

3. 数据校验

   * 去重（normalized）
   * 非法字符过滤
   * 分类合法性校验

4. AI 辅助处理

   * 自动补全 category / tags
   * 管理员确认后写入

权限说明：

* 仅管理员可访问后台
* 不开放普通用户提交

---

五、数据模型设计

5.1 Word 数据模型（唯一核心表）

字段说明：

* id: string（UUID）
* word: string
  原始词形，例如 coroutine
* normalized: string
  统一格式，用于搜索与去重
* language: enum
  kotlin / javascript / typescript / swift / java / python / go / rust / c / cpp / csharp / php / ruby / scala / dart / r / shell / sql / html / css
* category: enum
  keyword / api / library / framework / concept / tool / common
* tags: string[]
  async / concurrency / ui 等
* createdAt: timestamp

---

六、发音方案设计

实现方式：

在添加或者导入时获取标准的英/美音标和对应发音，修改命名上传到对象存储，数据库保存对应URL

* 前端通过  API 请求
* 对接：

  * Cambridge Dictionary
  * Oxford Dictionary

---

七、技术选型

前端（用户侧）：

* 目标平台
* Web
  * SvelteKit + Vite + Tailwindcss
* Flutter
  * Android
  * iOS

后台管理：

* Web
  * SvelteKit + Vite + Tailwindcss
  * 需要支持大屏和小屏（手机端），方便在手机进入后台管理上传数据
* 表单 + 表格为主

后端：

* REST API / GraphQL API
* 部署平台（免费 tier）：
  * Vercel Serverless Functions（推荐，与前端同平台）
  * Cloudflare Workers
  
* GraphQL
  * Supabase：https://supabase.com/docs/guides/graphql

数据库： Supabase PostgreSQL
对象存储（音频文件）： Cloudflare R2

搜索：

* Supabase 内置全文搜索 + GIN index
* 词汇量小，数据库足够

AI：

* 仅用于结构化辅助
* 非运行时依赖

---

八、交互说明（简述）

前台：

* 打开即是词列表
* 搜索即过滤
* 点击词 对应的英音IPA/美音IPA即可发音。

后台：

* 表格即编辑
* 导入 → 预览 → 确认入库

交互原则：

* 零教学
* 零引导
* 面向“知道自己在干什么”的用户

---

九、风险与边界

* 分类只做一级，不做树

---

十、后续扩展（不纳入 MVP）

* 高频词榜单  
* Forvo 真人发音
* AI 自动发现新技术词

---

十一、成功标准（MVP）

* 管理员可在 10 分钟内导入 1000 个词
* 用户可在 3 秒内找到目标词
* 发音点击成功率 > 95%
* 数据模型半年内无需破坏性修改
