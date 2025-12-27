import { json } from '@sveltejs/kit';
import { getPhonetics } from '$lib/eudic/parser';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    try {
        const word = url.searchParams.get('word');
        if (!word) return json({ error: 'word required' }, { status: 400 });

        const r = await getPhonetics(word);
        return json({ success: true, word: r.word, ipa_uk: r.ipa_uk, ipa_us: r.ipa_us, voice_uk: r.voice_uk, voice_us: r.voice_us });
    } catch (e) {
        console.error('[Eudic]', e);
        return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
    }
};
