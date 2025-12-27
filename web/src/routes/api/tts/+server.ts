import { json } from '@sveltejs/kit';
import { upload, genFilename } from '$lib/r2';
import { fetchAudio, type Provider } from '$lib/frdic';
import type { RequestHandler } from './$types';

async function gen(word: string, accent: string, provider: Provider, txt?: string) {
  const data = await fetchAudio(word, accent, provider, txt);
  const url = await upload(data, genFilename(word, accent));
  return { url, size: data.length };
}

async function genBoth(word: string, provider: Provider, txt?: string) {
  const [us, uk] = await Promise.all([gen(word, 'us', provider, txt), gen(word, 'uk', provider, txt)]);
  return { us, uk };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { word, mode, accent, provider, txt } = await request.json();
    if (!word) return json({ error: 'word required' }, { status: 400 });

    const p: Provider = ['youdao', 'frdic', 'minimax'].includes(provider) ? provider as Provider : 'youdao';

    if (mode === 'both') {
      const r = await genBoth(word, p, txt);
      return json({ success: true, audio_url_us: r.us.url, audio_url_uk: r.uk.url, audio_size_us: r.us.size, audio_size_uk: r.uk.size, mode: 'both', provider: p });
    }

    const acc = accent === 'uk' ? 'uk' : 'us';
    const r = await gen(word, acc, p, txt);
    return json({ success: true, audio_url_us: r.url, audio_size_us: r.size, accent: acc, provider: p, mode: 'single' });
  } catch (e) {
    console.error('[TTS]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};
