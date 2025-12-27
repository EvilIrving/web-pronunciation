import { json } from '@sveltejs/kit';
import { generateIPA, LLM_MODELS, type LLMProvider } from '$lib/llm/client';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { word, provider } = await request.json();
        if (!word) return json({ error: 'word required' }, { status: 400 });

        const p: LLMProvider = provider && provider in LLM_MODELS ? provider as LLMProvider : 'kimi';
        const ipa = await generateIPA(word, p);
        return json({ success: true, ipa, provider: p, model: LLM_MODELS[p].id });
    } catch (e) {
        console.error('[IPA]', e);
        return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
    }
};

export const GET: RequestHandler = async () => {
    const models = Object.entries(LLM_MODELS).map(([id, c]) => ({ id, name: c.name, modelId: c.id, provider: c.provider }));
    return json({ models, defaultModel: 'kimi' });
};
