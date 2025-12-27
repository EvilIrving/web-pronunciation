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
  // 美音字段
  ipa_us: string | null;
  audio_url_us: string | null;
  // 英音字段
  ipa_uk: string | null;
  audio_url_uk: string | null;
  created_at: string;
  updated_at: string;
}

// 创建词汇时的输入类型（省略自动生成的字段）
export interface WordInsert {
  word: string;
  ipa_us?: string | null;
  audio_url_us?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
}

// 更新词汇时的输入类型（所有字段可选）
export interface WordUpdate {
  word?: string;
  ipa_us?: string | null;
  audio_url_us?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
}

// 批量更新任务
export interface BatchUpdateTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_words: number;
  processed_words: number;
  failed_words: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BatchUpdateTaskInsert {
  total_words: number;
}

export interface BatchUpdateTaskUpdate {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  processed_words?: number;
  failed_words?: number;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
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
      batch_update_tasks: {
        Row: BatchUpdateTask;
        Insert: BatchUpdateTaskInsert;
        Update: BatchUpdateTaskUpdate;
      };
    };
  };
}
