-- ============================================
-- Tech Vocabulary Index - Database Schema
-- Version: 0.1 (MVP)
-- ============================================

-- 创建语言枚举类型
CREATE TYPE programming_language AS ENUM (
  'kotlin',
  'javascript',
  'typescript',
  'swift',
  'java',
  'python',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'scala',
  'dart',
  'r',
  'shell',
  'sql',
  'html',
  'css',
  'common'  -- 通用技术词汇
);

-- 创建分类枚举类型
CREATE TYPE word_category AS ENUM (
  'keyword',    -- 语言关键字
  'api',        -- API 名称
  'library',    -- 库名
  'framework',  -- 框架名
  'concept',    -- 技术概念
  'tool',       -- 工具名
  'common'      -- 通用词汇
);

-- 创建词汇表
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 词汇信息
  word TEXT NOT NULL,                              -- 原始词形，如 "coroutine"
  normalized TEXT NOT NULL,                        -- 标准化形式，用于搜索去重，小写无空格
  
  -- 分类信息
  language programming_language NOT NULL DEFAULT 'common',
  category word_category NOT NULL DEFAULT 'common',
  tags TEXT[] DEFAULT '{}',                        -- 标签数组，如 ['async', 'concurrency']
  
  -- 发音信息
  ipa_uk TEXT,                                     -- 英式音标
  ipa_us TEXT,                                     -- 美式音标
  audio_uk_url TEXT,                               -- 英式发音音频 URL (Cloudflare R2)
  audio_us_url TEXT,                               -- 美式发音音频 URL (Cloudflare R2)
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 约束：normalized 必须唯一，防止重复词条
  CONSTRAINT words_normalized_unique UNIQUE (normalized)
);

-- 创建索引

-- 1. normalized 字段索引（用于去重和精确搜索）
CREATE INDEX idx_words_normalized ON words (normalized);

-- 2. 全文搜索索引（用于模糊搜索）
CREATE INDEX idx_words_word_gin ON words USING GIN (to_tsvector('english', word));

-- 3. 语言筛选索引
CREATE INDEX idx_words_language ON words (language);

-- 4. 分类筛选索引
CREATE INDEX idx_words_category ON words (category);

-- 5. 创建时间索引（用于排序）
CREATE INDEX idx_words_created_at ON words (created_at DESC);

-- 6. 标签 GIN 索引（用于标签搜索）
CREATE INDEX idx_words_tags ON words USING GIN (tags);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器
CREATE TRIGGER trigger_words_updated_at
  BEFORE UPDATE ON words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建 normalized 自动生成函数
CREATE OR REPLACE FUNCTION generate_normalized()
RETURNS TRIGGER AS $$
BEGIN
  -- 转小写，去除首尾空格
  NEW.normalized = LOWER(TRIM(NEW.word));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器（插入和更新时自动生成 normalized）
CREATE TRIGGER trigger_words_normalize
  BEFORE INSERT OR UPDATE OF word ON words
  FOR EACH ROW
  EXECUTE FUNCTION generate_normalized();

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- 公开读取策略（所有人可查看）
CREATE POLICY "words_public_read" ON words
  FOR SELECT
  USING (true);

-- 管理员写入策略（仅认证用户可增删改）
CREATE POLICY "words_authenticated_write" ON words
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 注释
-- ============================================

COMMENT ON TABLE words IS '技术词汇发音索引表';
COMMENT ON COLUMN words.word IS '原始词形，保留原始大小写';
COMMENT ON COLUMN words.normalized IS '标准化形式，小写，用于搜索和去重';
COMMENT ON COLUMN words.language IS '所属编程语言';
COMMENT ON COLUMN words.category IS '词汇分类';
COMMENT ON COLUMN words.tags IS '标签数组';
COMMENT ON COLUMN words.ipa_uk IS '英式国际音标';
COMMENT ON COLUMN words.ipa_us IS '美式国际音标';
COMMENT ON COLUMN words.audio_uk_url IS '英式发音音频URL';
COMMENT ON COLUMN words.audio_us_url IS '美式发音音频URL';
