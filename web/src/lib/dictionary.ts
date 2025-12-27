/**
 * Dictionary API 服务
 * 调用服务端 API 获取发音信息
 */

// 发音信息结果
export interface PronunciationInfo {
    ipa_us: string | null;
    audio_url_us: string | null;
}

/**
 * 获取单词的发音信息（IPA 音标 + 音频）
 * @param word 要查询的单词
 * @returns 发音信息，包含音标和音频 URL
 */
export async function fetchPronunciation(_word: string): Promise<PronunciationInfo> {
    const result: PronunciationInfo = {
        ipa_us: null,
        audio_url_us: null,
    };

    // TODO: 从词典 API 获取
    return result;
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
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    return results;
}
