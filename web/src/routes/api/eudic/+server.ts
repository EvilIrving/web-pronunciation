/**
 * Eudic API 路由 - 从欧路词典获取音标和音频
 */

import { json } from '@sveltejs/kit';
import { getPhonetics } from '$lib/eudic/parser';
import type { RequestHandler } from './$types';

// GET - 获取单词音标和音频
export const GET: RequestHandler = async ({ url }) => {
    try {
        const word = url.searchParams.get('word');

        if (!word) {
            return json({ error: 'word is required' }, { status: 400 });
        }

        console.log(`[Eudic] Getting phonetics for: ${word}`);

        const result = await getPhonetics(word);

        console.log(`[Eudic] Result: UK=${result.ipa_uk}, US=${result.ipa_us}`);
        console.log(`[Eudic] Voice params: UK=${result.voice_uk?.txt || 'none'}, US=${result.voice_us?.txt || 'none'}`);

        return json({
            success: true,
            word: result.word,
            ipa_uk: result.ipa_uk,
            ipa_us: result.ipa_us,
            // 发音参数，可直接用于 frdic TTS API
            voice_uk: result.voice_uk,
            voice_us: result.voice_us,
        });
    } catch (e) {
        console.error('[Eudic] Error:', e);
        return json(
            { error: e instanceof Error ? e.message : 'Failed to fetch from Eudic' },
            { status: 500 }
        );
    }
};
