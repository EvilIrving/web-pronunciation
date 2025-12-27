/**
 * 数据库类型定义
 * 对齐 PRD v0.3 数据模型
 */

// 词汇完整类型
export interface Word {
  id: string;
  word: string;
  normalized: string;
  // 美音字段
  ipa: string | null;
  audio_url: string | null;
  // 英音字段
  ipa_uk: string | null;
  audio_url_uk: string | null;
  created_at: string;
  updated_at: string;
}

// 创建词汇输入类型
export interface WordInsert {
  word: string;
  ipa?: string | null;
  audio_url?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
}

// 更新词汇输入类型
export interface WordUpdate {
  word?: string;
  ipa?: string | null;
  audio_url?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
}

// 批量更新任务类型
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

// Database 类型 (Supabase 客户端使用)
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
        Insert: { total_words: number };
        Update: Partial<BatchUpdateTask>;
      };
    };
  };
}
