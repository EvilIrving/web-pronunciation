-- ============================================
-- Tech Vocabulary Index - Database Schema
-- Version: 0.3 (MVP, aligned with PRD v0.3)
-- ============================================

-- 创建词汇表
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 词汇信息
  word TEXT NOT NULL,                              -- 原始词形，如 "coroutine"
  normalized TEXT NOT NULL,                        -- 标准化形式，用于搜索去重，小写无空格
  
  -- 发音信息（美式发音）
  ipa_us TEXT,                                      -- IPA 音标（美式）
  audio_url_us TEXT,                                -- 发音音频 URL (Cloudflare R2, 美式)
  
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

-- 3. 创建时间索引（用于排序）
CREATE INDEX idx_words_created_at ON words (created_at DESC);

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
COMMENT ON COLUMN words.ipa_us IS 'IPA 国际音标（美式发音）';
COMMENT ON COLUMN words.audio_url_us IS '发音音频URL（美式）';
COMMENT ON COLUMN words.created_at IS '创建时间';
COMMENT ON COLUMN words.updated_at IS '更新时间';
