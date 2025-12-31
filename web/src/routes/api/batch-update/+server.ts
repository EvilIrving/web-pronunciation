import { json } from '@sveltejs/kit';
import { lookup, generateAudio } from '$lib/server/dictionary';
import { upload, genFilename } from '$lib/server/r2';
import { requireAdmin } from '$lib/server/auth';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;

  try {
    const { words } = await request.json();
    if (!Array.isArray(words) || words.length === 0) {
      return json({ error: 'words array required' }, { status: 400 });
    }

    const results: Array<{ word: string; success: boolean; error?: string }> = [];
    let ok = 0;
    let failed = 0;

    for (const word of words) {
      const w = word.trim();
      if (!w) continue;

      try {
        // 1. 查询音标
        const phonetics = await lookup(w, 'auto');

        // 2. 生成音频
        const audio = await generateAudio(w, ['us', 'uk'], phonetics);

        // 3. 保存到数据库
        const { data, error } = await supabase.from('words').insert({
          word: w.toLowerCase(),
          normalized: w.toLowerCase(),
          ipa_us: phonetics.ipa_us,
          ipa_uk: phonetics.ipa_uk,
          ipa: phonetics.ipa,
          audio_url_us: audio.audio_url_us,
          audio_url_uk: audio.audio_url_uk,
          audio_url: audio.audio_url,
          audio_size_us: audio.audio_size_us,
          audio_size_uk: audio.audio_size_uk,
          audio_size: audio.audio_size,
          ipa_source: phonetics.ipa_source,
        }).select().single();

        if (error) throw error;

        results.push({ word: w, success: true });
        ok++;
      } catch (e) {
        results.push({ word: w, success: false, error: e instanceof Error ? e.message : 'failed' });
        failed++;
      }
    }

    return json({ ok, failed, results });
  } catch (e) {
    console.error('[batch-update]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};
