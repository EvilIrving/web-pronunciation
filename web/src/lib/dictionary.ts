/**
 * Dictionary API 服务
 * 调用服务端 API 获取发音信息
 * - IPA 音标：Moonshot AI（KIMI）
 * - 音频：MiniMax T2A + R2 存储
 */

// 发音信息结果
export interface PronunciationInfo {
    ipa_us: string | null;
    audio_url_us: string | null;
}

/**
 * 获取 IPA 音标（通过 Moonshot AI）
 * @param word 要查询的单词
 * @returns IPA 音标
 */
export async function fetchIPA(word: string): Promise<string | null> {
    try {
        const response = await fetch('/api/ipa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word }),
        });

        if (!response.ok) {
            console.warn(`IPA API: 获取单词 "${word}" 音标失败`);
            return null;
        }

        const data = await response.json();
        return data.ipa_us || null;
    } catch (error) {
        console.error(`获取单词 "${word}" 音标时出错:`, error);
        return null;
    }
}

/**
 * 生成音频（通过 MiniMax T2A + R2）
 * @param word 要生成音频的单词
 * @returns 音频 URL
 */
export async function generateAudio(word: string): Promise<string | null> {
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word }),
        });

        if (!response.ok) {
            console.warn(`TTS API: 生成单词 "${word}" 音频失败`);
            return null;
        }

        const data = await response.json();
        return data.audio_url_us || null;
    } catch (error) {
        console.error(`生成单词 "${word}" 音频时出错:`, error);
        return null;
    }
}

/**
 * 获取单词的发音信息（IPA 音标 + 音频）
 * @param word 要查询的单词
 * @returns 发音信息，包含音标和音频 URL
 */
export async function fetchPronunciation(word: string): Promise<PronunciationInfo> {
    const result: PronunciationInfo = {
        ipa_us: null,
        audio_url_us: null,
    };

    // 并行获取 IPA 和音频
    const [ipa_us, audio_url_us] = await Promise.all([
        fetchIPA(word),
        generateAudio(word),
    ]);

    result.ipa_us = ipa_us;
    result.audio_url_us = audio_url_us;

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
