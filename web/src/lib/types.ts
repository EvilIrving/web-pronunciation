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

export interface Database {
  public: {
    Tables: {
      words: { Row: Word; Insert: WordInsert; Update: WordUpdate };
    };
  };
}
