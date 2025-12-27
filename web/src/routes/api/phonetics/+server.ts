import { json } from '@sveltejs/kit';
import { getPhonetics as youdao } from '$lib/youdao/client';
import { getPhonetics as eudic } from '$lib/eudic/parser';
import type { RequestHandler } from './$types';

type Provider = 'youdao' | 'eudic';

export const GET: RequestHandler = async ({ url }) => {
  const word = url.searchParams.get('word');
  const provider = (url.searchParams.get('provider') || 'youdao') as Provider;

  if (!word) return json({ error: 'word required' }, { status: 400 });

  try {
    if (provider === 'eudic') {
      const r = await eudic(word);
      return json({ success: true, ...r, provider });
    }

    const r = await youdao(word);
    return json({ success: true, ...r, provider });
  } catch (e) {
    console.error(`[Phonetics/${provider}]`, e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};
