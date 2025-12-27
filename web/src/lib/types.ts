export type IpaSource = 'dict' | 'llm' | null;

export interface Word {
  id: string;
  word: string;
  normalized: string;
  // 美音
  ipa_us: string | null;
  audio_url_us: string | null;
  // 英音
  ipa_uk: string | null;
  audio_url_uk: string | null;
  // 通用
  ipa: string | null;
  audio_url: string | null;
  // 音标来源
  ipa_source: IpaSource;
  created_at: string;
  updated_at: string;
}

export interface WordInsert {
  word: string;
  // 美音
  ipa_us?: string | null;
  audio_url_us?: string | null;
  // 英音
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
  // 通用
  ipa?: string | null;
  audio_url?: string | null;
  // 音标来源
  ipa_source?: IpaSource;
}

export interface WordUpdate {
  word?: string;
  // 美音
  ipa_us?: string | null;
  audio_url_us?: string | null;
  // 英音
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
  // 通用
  ipa?: string | null;
  audio_url?: string | null;
  // 音标来源
  ipa_source?: IpaSource;
}

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

export interface Database {
  public: {
    Tables: {
      words: { Row: Word; Insert: WordInsert; Update: WordUpdate };
      batch_update_tasks: { Row: BatchUpdateTask; Insert: { total_words: number }; Update: Partial<BatchUpdateTask> };
    };
  };
}
