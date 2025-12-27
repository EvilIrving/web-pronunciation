/**
 * Supabase 数据库类型定义
 * 用于 TypeScript 类型安全
 *
 * 使用方式:
 * import type { Database, Word } from '@/types/database';
 */

// ============================================
// 表类型
// ============================================

export interface Word {
  id: string;
  word: string;
  normalized: string;
  ipa: string | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

// 创建词汇时的输入类型（省略自动生成的字段）
export interface WordInsert {
  word: string;
  ipa?: string | null;
  audio_url?: string | null;
}

// 更新词汇时的输入类型（所有字段可选）
export interface WordUpdate {
  word?: string;
  ipa?: string | null;
  audio_url?: string | null;
}

// ============================================
// Supabase Database 类型（用于客户端初始化）
// ============================================

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
