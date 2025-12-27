export interface Word {
  id: string;
  word: string;
  normalized: string;
  ipa: string | null;
  audio_url: string | null;
  ipa_uk: string | null;
  audio_url_uk: string | null;
  created_at: string;
  updated_at: string;
}

export interface WordInsert {
  word: string;
  ipa?: string | null;
  audio_url?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
}

export interface WordUpdate {
  word?: string;
  ipa?: string | null;
  audio_url?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
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
