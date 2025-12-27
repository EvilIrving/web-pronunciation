-- ============================================
-- Migration: Rename ipa/audio_url to ipa_us/audio_url_us
-- Date: 2025-12-27
-- ============================================

-- 1. 重命名字段
ALTER TABLE words RENAME COLUMN ipa TO ipa_us;
ALTER TABLE words RENAME COLUMN audio_url TO audio_url_us;

-- 2. 更新注释
COMMENT ON COLUMN words.ipa_us IS 'IPA 国际音标（美式发音）';
COMMENT ON COLUMN words.audio_url_us IS '美式发音音频URL';

-- 3. 更新 SQL schema 源文件
-- 注意：需要同步更新 create_words_table.sql
