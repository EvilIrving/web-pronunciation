import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { getPhonetics } from '$lib/eudic/parser';
import { upload, genFilename } from '$lib/r2';
import { fetchFrdic } from '$lib/frdic';
import type { RequestHandler } from './$types';
import { randomUUID } from 'crypto';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const DELAY = 3000;

async function genAudio(word: string, accent: string): Promise<string> {
  const data = await fetchFrdic(word, accent);
  return upload(data, genFilename(word, accent));
}

async function getIPA(word: string) {
  const { data: existing } = await supabase.from('words').select('ipa_uk, ipa_us').eq('normalized', word.toLowerCase()).single();
  if (existing?.ipa_uk && existing?.ipa_us) return { ipa_uk: existing.ipa_uk, ipa_us: existing.ipa_us };
  const r = await getPhonetics(word);
  return { ipa_uk: r.ipa_uk, ipa_us: r.ipa_us };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { wordIds, updatePhonetics = true, updateAudio = false, audioMode = 'both' } = await request.json();
    if (!wordIds?.length) return json({ error: 'wordIds required' }, { status: 400 });

    const taskId = randomUUID();
    await supabase.from('batch_update_tasks').insert({ id: taskId, status: 'processing', total_words: wordIds.length, processed_words: 0, failed_words: 0, started_at: new Date().toISOString() });

    const { data: words } = await supabase.from('words').select('id, normalized, audio_url_us, audio_url_uk').in('id', wordIds);
    if (!words) return json({ error: 'fetch failed' }, { status: 500 });

    const accents = audioMode === 'both' ? ['us', 'uk'] : audioMode === 'uk' ? ['uk'] : ['us'];
    let processed = 0, failed = 0;

    for (const w of words) {
      try {
        const updates: Record<string, unknown> = {};
        if (updatePhonetics) {
          const ipa = await getIPA(w.normalized);
          if (ipa.ipa_uk) updates.ipa_uk = ipa.ipa_uk;
          if (ipa.ipa_us) updates.ipa_us = ipa.ipa_us;
        }
        if (updateAudio) {
          for (const acc of accents) {
            const key = acc === 'us' ? 'audio_url_us' : 'audio_url_uk';
            if (!w[key]) {
              try { updates[key] = await genAudio(w.normalized, acc); } catch {}
            }
          }
        }
        if (Object.keys(updates).length) {
          const { error } = await supabase.from('words').update(updates).eq('id', w.id);
          error ? failed++ : processed++;
        } else processed++;
        await supabase.from('batch_update_tasks').update({ processed_words: processed + failed, failed_words: failed }).eq('id', taskId);
        await new Promise(r => setTimeout(r, DELAY));
      } catch { failed++; }
    }

    await supabase.from('batch_update_tasks').update({ status: 'completed', processed_words: processed, failed_words: failed, completed_at: new Date().toISOString() }).eq('id', taskId);
    return json({ success: true, taskId, total: wordIds.length, processed, failed });
  } catch (e) {
    console.error('[Batch]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const taskId = url.searchParams.get('taskId');
    if (!taskId) {
      const { data, error } = await supabase.from('batch_update_tasks').select('*').order('created_at', { ascending: false }).limit(10);
      return error ? json({ error: error.message }, { status: 400 }) : json({ tasks: data });
    }
    const { data, error } = await supabase.from('batch_update_tasks').select('*').eq('id', taskId).single();
    return error ? json({ error: error.message }, { status: 400 }) : json({ task: data });
  } catch (e) {
    return json({ error: 'error' }, { status: 500 });
  }
};