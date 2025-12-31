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

export type IpaSource = 'youdao' | 'llm' | null;

export interface Word {
  id: string;
  word: string;
  normalized: string;
  // 美音字段
  ipa_us: string | null;
  audio_url_us: string | null;
  // 英音字段
  ipa_uk: string | null;
  audio_url_uk: string | null;
  // 通用音标字段（用于只有一种发音的词）
  ipa: string | null;
  audio_url: string | null;
  // 音标来源
  ipa_source: IpaSource;
  created_at: string;
  updated_at: string;
}

// 创建词汇时的输入类型（省略自动生成的字段）
export interface WordInsert {
  word: string;
  // 美音字段
  ipa_us?: string | null;
  audio_url_us?: string | null;
  // 英音字段
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
  // 通用音标字段
  ipa?: string | null;
  audio_url?: string | null;
  // 音标来源
  ipa_source?: IpaSource;
}

// 更新词汇时的输入类型（所有字段可选）
export interface WordUpdate {
  word?: string;
  // 美音字段
  ipa_us?: string | null;
  audio_url_us?: string | null;
  // 英音字段
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
  // 通用音标字段
  ipa?: string | null;
  audio_url?: string | null;
  // 音标来源
  ipa_source?: IpaSource;
}

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
