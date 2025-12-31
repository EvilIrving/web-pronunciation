/**
 * 统一字典服务层
 *
 * 整合有道、欧路词典的音标查询和 TTS 音频生成逻辑，
 * 为 API 端点提供统一的业务抽象。
 */

import type { IpaSource } from '$lib/types';
import { upload, genFilename } from './r2';
import { getPhonetics as getYoudao, fetchAudio as fetchYoudaoAudio } from './youdao/client';
import { getPhonetics as getEudic } from './eudic/parser';
import { fetchAudio as fetchEudicTTS, fetchMinimax, type TtsProvider } from './eudic';

// 类型定义

export interface PhoneticsResult {
  word: string;
  ipa_us: string | null;
  ipa_uk: string | null;
  ipa: string | null;
  audio_url_us: string | null;
  audio_url_uk: string | null;
  audio_url: string | null;
  provider: 'youdao' | 'eudic';
  ipa_source: IpaSource;
}

export type DictProvider = 'youdao' | 'eudic' | 'auto';

export interface AudioResult {
  audio_url_us?: string;
  audio_url_uk?: string;
  audio_url?: string;
  audio_size_us?: number;
  audio_size_uk?: number;
  audio_size?: number;
  mode: 'both' | 'single' | 'none';
}

// 内部辅助函数

/**
 * 上传音频到 R2
 */
async function uploadAudioData(data: Uint8Array, word: string, accent: string) {
  const url = await upload(data, genFilename(word, accent));
  return { url, size: data.length, accent };
}

/**
 * 下载第三方音频并上传到 R2
 */
async function downloadAndUpload(audioUrl: string, word: string, accent: string) {
  const res = await fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`fetch audio: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) throw new Error('empty audio');
  const data = new Uint8Array(buf);
  return uploadAudioData(data, word, accent);
}

// 服务函数

/**
 * 查询单词音标（统一接口）
 * @param word 单词
 * @param provider 词典提供商，'auto' 表示轮询
 */
export async function lookup(word: string, provider: DictProvider = 'auto'): Promise<PhoneticsResult> {
  // 内部变量用于轮询
  const lastProvider: { current: DictProvider } = { current: 'youdao' };

  function getNextProvider(): DictProvider {
    if (lastProvider.current === 'youdao') {
      lastProvider.current = 'eudic';
    } else {
      lastProvider.current = 'youdao';
    }
    return lastProvider.current;
  }

  const actualProvider = provider === 'auto' ? getNextProvider() : provider;
  console.log(`[Dictionary/lookup] 使用 ${actualProvider} 查询 "${word}"`);

  let result: PhoneticsResult;

  if (actualProvider === 'eudic') {
    const eudicResult = await getEudic(word);
    result = {
      word: word.toLowerCase(),
      ipa_us: eudicResult.ipa_us,
      ipa_uk: eudicResult.ipa_uk,
      ipa: eudicResult.ipa,
      audio_url_us: eudicResult.audio_url_us,
      audio_url_uk: eudicResult.audio_url_uk,
      audio_url: eudicResult.audio_url,
      provider: 'eudic',
      ipa_source: (eudicResult.ipa_us || eudicResult.ipa_uk) ? 'dict' : null,
    };
  } else {
    const youdaoResult = await getYoudao(word);
    result = {
      word: word.toLowerCase(),
      ipa_us: youdaoResult.ipa_us,
      ipa_uk: youdaoResult.ipa_uk,
      ipa: youdaoResult.ipa,
      audio_url_us: youdaoResult.audio_url_us,
      audio_url_uk: youdaoResult.audio_url_uk,
      audio_url: youdaoResult.audio_url,
      provider: 'youdao',
      ipa_source: (youdaoResult.ipa_us || youdaoResult.ipa_uk) ? 'dict' : null,
    };
  }

  return result;
}

/**
 * 生成音频（下载第三方音频并上传到 R2）
 * @param word 单词
 * @param accents 需要生成的音频口音
 * @param existingPhonetics 已有的音标信息（可复用音频 URL）
 */
export async function generateAudio(
  word: string,
  accents: ('us' | 'uk' | 'common')[],
  existingPhonetics?: Partial<PhoneticsResult>
): Promise<AudioResult> {
  const result: AudioResult = { mode: 'none' };
  const tasks: Array<() => Promise<{ url: string; size: number; accent: string }>> = [];

  // 复用已有的音频 URL
  const hasUsAudio = existingPhonetics?.audio_url_us || existingPhonetics?.audio_url;
  const hasUkAudio = existingPhonetics?.audio_url_uk || existingPhonetics?.audio_url;

  // 优先使用已有的音标信息来获取音频
  let phonetics = existingPhonetics;

  // 如果没有可复用的音频 URL，需要先查询音标
  if (!hasUsAudio && !hasUkAudio) {
    try {
      phonetics = await lookup(word, 'youdao');
    } catch (e) {
      console.warn(`[Dictionary/generateAudio] 查询音标失败: ${e}`);
    }
  }

  const p = phonetics || {};

  // US 音频
  if (accents.includes('us') && (p.audio_url_us || p.audio_url)) {
    const url = p.audio_url_us || p.audio_url!;
    tasks.push(() => downloadAndUpload(url, word, 'us'));
  }

  // UK 音频
  if (accents.includes('uk') && (p.audio_url_uk || p.audio_url)) {
    const url = p.audio_url_uk || p.audio_url!;
    tasks.push(() => downloadAndUpload(url, word, 'uk'));
  }

  // 通用音频
  if (accents.includes('common') && p.audio_url) {
    tasks.push(() => downloadAndUpload(p.audio_url!, word, 'common'));
  }

  // 如果没有可用的音频 URL，尝试使用 TTS 服务生成
  if (tasks.length === 0) {
    // 尝试使用降级 TTS 服务
    for (const accent of accents) {
      try {
        const audioData = await fetchTTSWithFallback(word, accent as 'us' | 'uk');
        tasks.push(() => Promise.resolve(uploadAudioData(audioData, word, accent)));
        break; // 找到一个可用的就使用
      } catch (e) {
        console.warn(`[Dictionary/generateAudio] TTS 生成失败 (${accent}): ${e}`);
      }
    }
  }

  if (tasks.length === 0) {
    return result;
  }

  // 并行获取所有音频
  const results = await Promise.allSettled(tasks.map(t => t()));
  const successResults = results.filter((r): r is PromiseFulfilledResult<{ url: string; size: number; accent: string }> =>
    r.status === 'fulfilled'
  );

  if (successResults.length === 0) {
    throw new Error('no audio available');
  }

  // 填充结果
  for (const r of successResults) {
    switch (r.value.accent) {
      case 'us':
        result.audio_url_us = r.value.url;
        result.audio_size_us = r.value.size;
        break;
      case 'uk':
        result.audio_url_uk = r.value.url;
        result.audio_size_uk = r.value.size;
        break;
      case 'common':
        result.audio_url = r.value.url;
        result.audio_size = r.value.size;
        break;
    }
  }

  // 确定模式
  if (result.audio_url_us && result.audio_url_uk) {
    result.mode = 'both';
  } else if (result.audio_url_us || result.audio_url_uk || result.audio_url) {
    result.mode = 'single';
  }

  return result;
}

/**
 * 使用降级策略获取 TTS 音频数据
 */
async function fetchTTSWithFallback(word: string, accent: 'us' | 'uk'): Promise<Uint8Array> {
  const providers: TtsProvider[] = ['youdao', 'eudic', 'minimax'];
  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      if (provider === 'youdao') {
        return await fetchYoudaoAudio(word, accent);
      } else if (provider === 'minimax') {
        return await fetchMinimax(word);
      } else {
        // eudic 需要 encoded txt，使用默认编码
        const encoded = Buffer.from(word).toString('base64');
        const { fetchEudic } = await import('./eudic');
        return await fetchEudic(word, accent, encoded);
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[Dictionary] TTS provider ${provider} failed, trying next: ${lastError.message}`);
    }
  }

  throw lastError || new Error('all TTS providers failed');
}

/**
 * 完整的单词导入流程（音标 + 音频）
 * @param word 单词
 * @param provider 词典提供商
 */
export async function importWord(
  word: string,
  provider: DictProvider = 'auto'
): Promise<PhoneticsResult & Partial<AudioResult>> {
  // 1. 查询音标
  const phonetics = await lookup(word, provider);

  // 2. 生成音频
  const audio = await generateAudio(word, ['us', 'uk'], phonetics);

  return {
    ...phonetics,
    audio_url_us: audio.audio_url_us,
    audio_url_uk: audio.audio_url_uk,
    audio_url: audio.audio_url,
    audio_size_us: audio.audio_size_us,
    audio_size_uk: audio.audio_size_uk,
    audio_size: audio.audio_size,
  };
}
