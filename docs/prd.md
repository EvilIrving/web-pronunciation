
PRD：Tech Vocabulary Index（程序员技术词汇发音索引）

版本：v0.3
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

问题并不在于"不会英语"，而在于：

1. 技术词汇并非普通英语（coroutine / cache / daemon / enum）
2. 技术文档是主要词源，但缺乏发音提示
3. 社区长期形成错误读法并被传播

现有词典产品：

* 面向通用英语
* 不区分技术语境
* 不覆盖大量技术命名实体

本产品不尝试解决"英语学习"，只解决一个问题：

**这个技术词，该怎么念。**

---

二、产品定位

* 常见发音容易错误的技术词汇
* 快速听到正确发音
* 简洁的词汇管理

---

三、目标与非目标

目标（MVP）：

* 覆盖各类技术词汇（不按语言/分类区分）
* 支持搜索
* 点击即听权威发音
* 支持管理员高效维护词库

---

四、核心功能列表

4.1 前台功能（Web）

1. 词汇列表

   * 支持分页或无限滚动
   * 创建时间降序

2. 搜索

   * 模糊匹配 word / normalized
   * 实时搜索

列表 Item 显示字段：

* word
* IPA 音标（通用音，不区分英美音）

---

4.2 后台管理功能（Web）

1. 词汇管理（CRUD）

   * 新增 / 编辑 / 删除词条

2. 批量导入（核心功能）

   * 支持 CSV / JSON / 文本粘贴
   * 一行一个词或结构化导入
   * 导入时通过 AI 获取标准音标和发音，上传到对象存储

3. 数据校验

   * 去重（normalized）
   * 非法字符过滤

4. AI 辅助处理

   * 自动获取 IPA 音标和发音
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
* ipa: string
  IPA 音标（通用音标，不区分英美音）
* audio_url: string
  发音音频文件的 R2 URL
* created_at: timestamp

---

六、发音方案设计

实现方式：

在添加或者导入时通过 AI 获取标准音标和发音，音频上传到对象存储，数据库保存对应 URL

* 前端通过 URL 请求音频播放
* AI 服务：

  * 音标获取：Moonshot AI（KIMI 模型）
    * 模型：kimi-k2-turbo-preview 或 moonshot-v1-8k
    * 用于从词汇生成标准 IPA 音标
  * 音频生成：MiniMax T2A API
    * 模型：speech-2.6-hd
    * 支持参数：
      * voice_id: 选择发音人
      * speed: 语速
      * vol: 音量
      * pitch: 音调
      * emotion: 情感（可选）
    * pronunciation_dict: 可用于自定义读音映射
* 对象存储：Cloudflare R2
  * MiniMax API 返回 hex 编码音频，上传前需解码为二进制 mp3 文件
  * R2 存储的是标准音频文件（非 hex），前端可直接通过 URL 播放
  * 数据库保存 R2 URL

音标格式：

* 使用 IPA（国际音标）
* 暂时不区分英音/美音，提供通用发音选项

---

七、技术选型

前端（用户侧）：

* 目标平台
* Web
  * SvelteKit 2.x + Svelte 5 + Vite 7 + Tailwind CSS 4

后台管理：

* Web
  * SvelteKit 2.x + Svelte 5 + Tailwind CSS 4
  * 响应式设计，支持桌面端和移动端
  * 表单 + 表格为主

后端：

* SvelteKit API Routes（Server-side）
* 部署平台：Vercel（adapter-vercel）

数据库： Supabase PostgreSQL
对象存储（音频文件）： Cloudflare R2

搜索：

* Supabase 内置全文搜索 + GIN index
* 词汇量小，数据库足够

AI 服务：

* Moonshot AI（KIMI）：音标生成
* MiniMax T2A：音频生成
* 统一通过 OpenAI SDK 调用（兼容接口）
* 仅用于批量导入时的音标和音频生成
* 非运行时依赖（前端只播放音频）

---

七.1 项目代码结构

```
web-pronunciation/
├── docs/                         # 项目文档
│   ├── prd.md                    # 产品需求文档
│   ├── audio_api.md              # 音频 API 参考
│   ├── kimi_text.md              # Kimi API 参考
│   └── minimax_text_api.md       # MiniMax API 参考
├── supabase/                     # 数据库配置
│   ├── types/database.ts         # 数据库类型定义
│   ├── config.toml               # Supabase 配置
│   ├── create_words_table.sql    # 建表脚本
│   └── seed.sql                  # 种子数据
├── web/                          # Web 应用主目录
│   ├── src/
│   │   ├── lib/                  # 共享库
│   │   │   ├── llm/client.ts     # 统一 LLM 客户端
│   │   │   ├── dictionary.ts     # 发音服务 API
│   │   │   ├── supabase.ts       # Supabase 客户端
│   │   │   └── types.ts          # 类型定义
│   │   ├── routes/               # SvelteKit 路由
│   │   │   ├── +page.svelte      # 前台首页
│   │   │   ├── +layout.svelte    # 全局布局
│   │   │   ├── admin/+page.svelte # 后台管理
│   │   │   └── api/              # API 路由
│   │   │       ├── ipa/+server.ts   # IPA 音标生成
│   │   │       ├── tts/+server.ts   # TTS 音频生成
│   │   │       └── words/+server.ts # 单词 CRUD
│   │   ├── app.html              # HTML 模板
│   │   └── app.d.ts              # 类型声明
│   ├── static/                   # 静态资源
│   ├── package.json              # 依赖配置
│   ├── svelte.config.js          # SvelteKit 配置
│   ├── vite.config.ts            # Vite 配置
│   └── tsconfig.json             # TypeScript 配置
├── AGENTS.md                     # AI Agent 工作流
└── README.md                     # 项目说明
```

---

七.2 核心模块说明

1. **LLM 客户端** (`src/lib/llm/client.ts`)
   - 统一封装 Moonshot AI (Kimi) 和 MiniMax 模型调用
   - 使用 OpenAI SDK 兼容接口
   - 支持动态切换模型
   - 导出 `generateIPA()` 和 `generateText()` 方法

2. **API 路由**
   - `POST /api/ipa` - 生成 IPA 音标（支持选择模型）
   - `GET /api/ipa` - 获取支持的模型列表
   - `POST /api/tts` - 生成音频并上传到 R2
   - `GET/POST/PUT/DELETE /api/words` - 单词 CRUD

3. **后台管理** (`src/routes/admin/+page.svelte`)
   - 词汇列表管理（搜索、编辑、删除）
   - 快速添加单词（自动获取音标+音频）
   - 批量导入（每行一个单词）
   - 行内编辑与音频播放
   - LLM 模型选择器

4. **数据库触发器**
   - `generate_normalized()` - 自动生成 normalized 字段
   - `update_updated_at_column()` - 自动更新时间戳
   - RLS 策略：公开读取，认证用户可写入

---

七.3 依赖清单

核心依赖：
- `@sveltejs/kit` ^2.49.1 - SvelteKit 框架
- `svelte` ^5.45.6 - Svelte 5（使用 runes 响应式）
- `tailwindcss` ^4.1.17 - Tailwind CSS 4
- `@supabase/supabase-js` ^2.89.0 - Supabase 客户端
- `@aws-sdk/client-s3` ^3.958.0 - R2 存储（S3 兼容）
- `openai` ^6.15.0 - LLM 调用

---

八、交互说明（简述）

前台：

* 打开即是词列表
* 搜索即过滤
* 点击词对应的 IPA 音标或播放按钮即可发音

后台：

* 表格即编辑
* 导入 → AI 处理（音标+音频）→ 预览 → 确认入库

交互原则：

* 零教学
* 零引导
* 面向"知道自己在干什么"的用户

---

九、风险与边界

* AI 音标和音频生成可能有成本，需要批量处理时注意配额
* R2 存储需要配置正确的访问策略

---

十、后续扩展（不纳入 MVP）

* 高频词榜单
* 英音/美音发音选项切换
* Forvo 真人发音
* AI 自动发现新技术词
* 自定义发音映射（pronunciation_dict）

---

十一、成功标准（MVP）

* 管理员可在 10 分钟内导入 1000 个词
* 用户可在 3 秒内找到目标词
* 发音点击成功率 > 95%
* 数据模型半年内无需破坏性修改

---

十二、API 参考

12.1 MiniMax T2A 音频生成

```bash
curl --request POST \
  --url https://api.minimaxi.com/v1/t2a_v2 \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "speech-2.6-hd",
    "text": "coroutine",
    "stream": false,
    "voice_setting": {
      "voice_id": "male-qn-qingse",
      "speed": 1,
      "vol": 1,
      "pitch": 0,
      "emotion": "neutral"
    },
    "audio_setting": {
      "sample_rate": 32000,
      "bitrate": 128000,
      "format": "mp3",
      "channel": 1
    },
    "subtitle_enable": false
  }'
```

响应：

```json
{
  "data": {
    "audio": "<hex编码的audio>",
    "status": 2
  },
  "extra_info": {
    "audio_length": 9900,
    "audio_sample_rate": 32000,
    "audio_size": 160323,
    "bitrate": 128000,
    "word_count": 1,
    "usage_characters": 10,
    "audio_format": "mp3",
    "audio_channel": 1
  },
  "trace_id": "01b8bf9bb7433cc75c18eee6cfa8fe21",
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

12.2 Moonshot AI（KIMI）音标生成

```bash
curl https://api.moonshot.cn/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d '{
        "model": "kimi-k2-turbo-preview",
        "messages": [
            {"role": "system", "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手。你擅长提供技术词汇的 IPA 国际音标。对于给定的技术词汇，只返回 IPA 音标，不要有其他解释。"},
            {"role": "user", "content": "coroutine"}
        ],
        "temperature": 0.3
   }'
```

响应：

```json
{
    "id": "cmpl-04ea926191a14749b7f2c7a48a68abc6",
    "object": "chat.completion",
    "created": 1698999496,
    "model": "kimi-k2-turbo-preview",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "kəˈruː.teɪʃ"
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 19,
        "completion_tokens": 21,
        "total_tokens": 40
    }
}
```
