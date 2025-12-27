import { json } from '@sveltejs/kit';
import { upload, genFilename } from '$lib/r2';
import { fetchAudio, type Provider } from '$lib/frdic';
import { getPhonetics } from '$lib/youdao/client';
import type { RequestHandler } from './$types';

async function uploadAudio(data: Uint8Array, word: string, accent: string) {
  const url = await upload(data, genFilename(word, accent));
  return { url, size: data.length, accent };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { word, provider, txt, existingPhonetics } = await request.json();
    if (!word) return json({ error: 'word required' }, { status: 400 });

    const p: Provider = ['youdao', 'frdic', 'minimax'].includes(provider) ? provider as Provider : 'youdao';

    // 1. 如果已有 phonetics 信息则复用，否则查询
    const hasExisting = existingPhonetics && Object.values(existingPhonetics).some(v => !!v);
    const phonetics = hasExisting ? existingPhonetics : await getPhonetics(word);

    // 2. 根据返回值决定获取哪些音频
    const result: Record<string, unknown> = {
      success: true,
      provider: p,
      word: word.toLowerCase()
    };

    // 收集需要获取的音频任务
    const tasks: Array<() => Promise<{ url: string; size: number; accent: string }>> = [];

    if (phonetics.audio_url_us) {
      tasks.push(async () => {
        const data = await fetchAudio(word, 'us', p, txt);
        return uploadAudio(data, word, 'us');
      });
    }

    if (phonetics.audio_url_uk) {
      tasks.push(async () => {
        const data = await fetchAudio(word, 'uk', p, txt);
        return uploadAudio(data, word, 'uk');
      });
    }

    if (phonetics.audio_url) {
      tasks.push(async () => {
        const data = await fetchAudio(word, 'us', p, txt);
        return uploadAudio(data, word, 'common');
      });
    }

    // 3. 并行获取所有需要的音频
    const results = await Promise.allSettled(tasks.map(t => t()));
    const successResults = results.filter((r): r is PromiseFulfilledResult<{ url: string; size: number; accent: string }> =>
      r.status === 'fulfilled'
    );

    if (successResults.length === 0) {
      throw new Error('no audio available');
    }

    // 4. 根据获取结果组织返回数据
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

    // 5. 添加音标信息
    if (phonetics.ipa_us) result.ipa_us = phonetics.ipa_us;
    if (phonetics.ipa_uk) result.ipa_uk = phonetics.ipa_uk;
    if (phonetics.ipa) result.ipa = phonetics.ipa;

    // 6. 确定返回模式
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
