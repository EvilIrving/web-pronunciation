/**
 * 数据库类型定义
 * 对齐 PRD v0.3 数据模型
 */

// 词汇完整类型
export interface Word {
  id: string;
  word: string;
  normalized: string;
  ipa: string | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

// 创建词汇输入类型
export interface WordInsert {
  word: string;
  ipa?: string | null;
  audio_url?: string | null;
}

// 更新词汇输入类型
export interface WordUpdate {
  word?: string;
  ipa?: string | null;
  audio_url?: string | null;
}

// Database 类型 (Supabase 客户端使用)
export interface Database {
  public: {
    Tables: {
      words: {
        Row: Word;
        Insert: WordInsert;
        Update: WordUpdate;
      };
    };
  };
}
