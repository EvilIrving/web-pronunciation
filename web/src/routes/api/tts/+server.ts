import { json } from '@sveltejs/kit';
import { lookup, generateAudio } from '$lib/server/dictionary';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth';

type DictProvider = 'youdao' | 'eudic';

export const POST: RequestHandler = async ({ request, locals }) => {
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;

  try {
    const { word, provider, existingPhonetics } = await request.json();
    if (!word) return json({ error: 'word required' }, { status: 400 });

    const dictProvider: DictProvider = provider === 'eudic' ? 'eudic' : 'youdao';

    // 1. 获取音标信息
    let phonetics;
    if (existingPhonetics && hasValidPhonetics(existingPhonetics)) {
      // 复用已有的音标信息
      phonetics = {
        word: word.toLowerCase(),
        ...existingPhonetics,
        provider: dictProvider,
        ipa_source: null,
      };
    } else {
      phonetics = await lookup(word, dictProvider);
    }

    // 2. 生成音频
    const audio = await generateAudio(word, ['us', 'uk'], phonetics);

    // 3. 构建返回结果
    const result: Record<string, unknown> = {
      success: true,
      word: word.toLowerCase(),
      provider: dictProvider,
      mode: audio.mode,
    };

    if (audio.audio_url_us) {
      result.audio_url_us = audio.audio_url_us;
      result.audio_size_us = audio.audio_size_us;
    }
    if (audio.audio_url_uk) {
      result.audio_url_uk = audio.audio_url_uk;
      result.audio_size_uk = audio.audio_size_uk;
    }
    if (audio.audio_url) {
      result.audio_url = audio.audio_url;
      result.audio_size = audio.audio_size;
    }

    // 添加音标信息
    if (phonetics.ipa_us) result.ipa_us = phonetics.ipa_us;
    if (phonetics.ipa_uk) result.ipa_uk = phonetics.ipa_uk;
    if (phonetics.ipa) result.ipa = phonetics.ipa;

    return json(result);
  } catch (e) {
    console.error('[TTS]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};

function hasValidPhonetics(p: Record<string, unknown>): boolean {
  return !!(
    (p.ipa_us || p.ipa_uk || p.ipa) ||
    (p.audio_url_us || p.audio_url_uk || p.audio_url)
  );
}
