import { json } from '@sveltejs/kit';
import { upload, genFilename } from '$lib/r2';
import { getPhonetics as getPhoneticsFromEudic } from '$lib/eudic/parser';
import { getPhonetics as getPhoneticsFromYoudao } from '$lib/youdao/client';
import type { RequestHandler } from './$types';

type DictProvider = 'youdao' | 'eudic';

async function uploadAudio(data: Uint8Array, word: string, accent: string) {
  const url = await upload(data, genFilename(word, accent));
  return { url, size: data.length, accent };
}

async function downloadAudio(audioUrl: string, word: string, accent: string) {
  const res = await fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`fetch audio: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) throw new Error('empty audio');
  const data = new Uint8Array(buf);
  return uploadAudio(data, word, accent);
}

async function getPhonetics(word: string, provider: DictProvider) {
  return provider === 'eudic' ? getPhoneticsFromEudic(word) : getPhoneticsFromYoudao(word);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { word, provider, existingPhonetics } = await request.json();
    if (!word) return json({ error: 'word required' }, { status: 400 });

    const dictProvider: DictProvider = provider === 'eudic' ? 'eudic' : 'youdao';

    // 如果已有 phonetics 信息且包含有效字段（IPA 或 audio_url），则复用，否则查询 API
    const hasExisting = existingPhonetics && (
      !!(existingPhonetics.ipa_us || existingPhonetics.ipa_uk || existingPhonetics.ipa) ||
      !!(existingPhonetics.audio_url_us || existingPhonetics.audio_url_uk || existingPhonetics.audio_url)
    );
    const phonetics = hasExisting ? existingPhonetics : await getPhonetics(word, dictProvider);

    const result: Record<string, unknown> = {
      success: true,
      provider: dictProvider,
      word: word.toLowerCase()
    };

    const tasks: Array<() => Promise<{ url: string; size: number; accent: string }>> = [];

    const hasIpa = !!(existingPhonetics?.ipa_us || existingPhonetics?.ipa_uk || existingPhonetics?.ipa);
    const hasValidPhonetics = hasIpa ? (
      !!phonetics.audio_url_us ||
      !!phonetics.audio_url_uk ||
      !!phonetics.audio_url
    ) : (
      !!phonetics.audio_url_us ||
      !!phonetics.audio_url_uk ||
      !!phonetics.audio_url
    );

    if (!hasValidPhonetics) {
      return json({
        success: true,
        word: word.toLowerCase(),
        provider: dictProvider,
        mode: 'none'
      });
    }

    // US 音频
    if (phonetics.audio_url_us) {
      tasks.push(() => downloadAudio(phonetics.audio_url_us!, word, 'us'));
    }

    // UK 音频
    if (phonetics.audio_url_uk) {
      tasks.push(() => downloadAudio(phonetics.audio_url_uk!, word, 'uk'));
    }

    // 通用音频
    if (phonetics.audio_url) {
      tasks.push(() => downloadAudio(phonetics.audio_url!, word, 'common'));
    }

    // 并行获取所有需要的音频
    const results = await Promise.allSettled(tasks.map(t => t()));
    const successResults = results.filter((r): r is PromiseFulfilledResult<{ url: string; size: number; accent: string }> =>
      r.status === 'fulfilled'
    );

    if (successResults.length === 0) {
      throw new Error('no audio available');
    }

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

    // 添加音标信息
    if (phonetics.ipa_us) result.ipa_us = phonetics.ipa_us;
    if (phonetics.ipa_uk) result.ipa_uk = phonetics.ipa_uk;
    if (phonetics.ipa) result.ipa = phonetics.ipa;

    // 确定返回模式
    if (result.audio_url_us && result.audio_url_uk) {
      result.mode = 'both';
    } else {
      result.mode = 'single';
    }

    return json(result);
  } catch (e) {
    console.error('[TTS]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};