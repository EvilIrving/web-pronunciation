/**
 * 数据库类型定义
 */

// 编程语言枚举
export type ProgrammingLanguage =
  | 'kotlin'
  | 'javascript'
  | 'typescript'
  | 'swift'
  | 'java'
  | 'python'
  | 'go'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'scala'
  | 'dart'
  | 'r'
  | 'shell'
  | 'sql'
  | 'html'
  | 'css'
  | 'common';

// 词汇分类枚举
export type WordCategory =
  | 'keyword'
  | 'api'
  | 'library'
  | 'framework'
  | 'concept'
  | 'tool'
  | 'common';

// 词汇完整类型
export interface Word {
  id: string;
  word: string;
  normalized: string;
  language: ProgrammingLanguage;
  category: WordCategory;
  tags: string[];
  ipa_uk: string | null;
  ipa_us: string | null;
  audio_uk_url: string | null;
  audio_us_url: string | null;
  created_at: string;
  updated_at: string;
}

// 创建词汇输入类型
export interface WordInsert {
  word: string;
  language?: ProgrammingLanguage;
  category?: WordCategory;
  tags?: string[];
  ipa_uk?: string | null;
  ipa_us?: string | null;
  audio_uk_url?: string | null;
  audio_us_url?: string | null;
}

// 更新词汇输入类型
export interface WordUpdate {
  word?: string;
  language?: ProgrammingLanguage;
  category?: WordCategory;
  tags?: string[];
  ipa_uk?: string | null;
  ipa_us?: string | null;
  audio_uk_url?: string | null;
  audio_us_url?: string | null;
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
    Enums: {
      programming_language: ProgrammingLanguage;
      word_category: WordCategory;
    };
  };
}

// UI 辅助常量
export const PROGRAMMING_LANGUAGES: { value: ProgrammingLanguage; label: string }[] = [
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'swift', label: 'Swift' },
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'scala', label: 'Scala' },
  { value: 'dart', label: 'Dart' },
  { value: 'r', label: 'R' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'common', label: 'Common' },
];

export const WORD_CATEGORIES: { value: WordCategory; label: string }[] = [
  { value: 'keyword', label: '关键字' },
  { value: 'api', label: 'API' },
  { value: 'library', label: '库' },
  { value: 'framework', label: '框架' },
  { value: 'concept', label: '概念' },
  { value: 'tool', label: '工具' },
  { value: 'common', label: '通用' },
];
