/**
 * Dictionary API 服务
 * 使用 Free Dictionary API 获取单词音标和发音
 * https://dictionaryapi.dev/
 */

// API 返回类型
interface DictionaryPhonetic {
  text?: string;
  audio?: string;
}

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: DictionaryPhonetic[];
}

// 发音信息结果
export interface PronunciationInfo {
  ipa_uk: string | null;
  audio_uk_url: string | null;
  ipa_us: string | null;
  audio_us_url: string | null;
}

/**
 * 从 Free Dictionary API 获取单词的发音信息
 * @param word 要查询的单词
 * @returns 发音信息，包含音标和音频 URL
 */
export async function fetchPronunciation(word: string): Promise<PronunciationInfo> {
  const result: PronunciationInfo = {
    ipa_uk: null,
    audio_uk_url: null,
    ipa_us: null,
    audio_us_url: null,
  };

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );

    if (!response.ok) {
      console.warn(`Dictionary API: 未找到单词 "${word}" 的发音信息`);
      return result;
    }

    const data: DictionaryEntry[] = await response.json();

    if (!data || data.length === 0) {
      return result;
    }

    const entry = data[0];

    // 获取音标和音频
    // API 返回的 phonetics 数组中可能包含多个发音
    // 我们优先选择有音频的发音
    if (entry.phonetics && entry.phonetics.length > 0) {
      // 查找带有音频的发音条目
      const phoneticWithAudio = entry.phonetics.find((p) => p.audio && p.audio.trim() !== '');

      if (phoneticWithAudio) {
        result.ipa_uk = phoneticWithAudio.text || null;
        // 处理音频 URL，确保是完整的 https URL
        let audioUrl = phoneticWithAudio.audio || '';
        if (audioUrl.startsWith('//')) {
          audioUrl = 'https:' + audioUrl;
        }
        result.audio_uk_url = audioUrl || null;
      } else {
        // 如果没有带音频的，使用第一个有音标的
        const phoneticWithText = entry.phonetics.find((p) => p.text && p.text.trim() !== '');
        if (phoneticWithText) {
          result.ipa_uk = phoneticWithText.text || null;
        }
      }
    }

    // 如果 phonetics 数组没有结果，使用顶层的 phonetic
    if (!result.ipa_uk && entry.phonetic) {
      result.ipa_uk = entry.phonetic;
    }

    return result;
  } catch (error) {
    console.error(`获取单词 "${word}" 发音时出错:`, error);
    return result;
  }
}

/**
 * 批量获取单词发音信息
 * @param words 单词列表
 * @param onProgress 进度回调
 * @returns 单词到发音信息的映射
 */
export async function fetchPronunciationBatch(
  words: string[],
  onProgress?: (current: number, total: number, word: string) => void
): Promise<Map<string, PronunciationInfo>> {
  const results = new Map<string, PronunciationInfo>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (onProgress) {
      onProgress(i + 1, words.length, word);
    }

    const pronunciation = await fetchPronunciation(word);
    results.set(word, pronunciation);

    // 添加小延迟避免请求过快
    if (i < words.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
