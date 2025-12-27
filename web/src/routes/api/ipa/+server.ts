/**
 * IPA API 路由 - 使用统一 LLM 客户端生成 IPA 音标
 * 支持 Kimi (Moonshot) 和 MiniMax 模型切换
 */

import { json } from '@sveltejs/kit';
import { generateIPA, LLM_MODELS, type LLMProvider } from '$lib/llm/client';
import type { RequestHandler } from './$types';

// POST - 生成 IPA 音标
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { word, provider } = body;

        if (!word) {
            return json({ error: 'word is required' }, { status: 400 });
        }

        // 确定使用的模型
        const selectedProvider: LLMProvider = provider && provider in LLM_MODELS 
            ? provider as LLMProvider 
            : 'kimi';
        
        const modelConfig = LLM_MODELS[selectedProvider];
        console.log(`[IPA] Generating IPA with ${modelConfig.name} for word: ${word}`);

        const ipa = await generateIPA(word, selectedProvider);

        console.log(`[IPA] IPA generated successfully: ${ipa}`);

        return json({
            success: true,
            ipa,
            provider: selectedProvider,
            model: modelConfig.id,
        });
    } catch (e) {
        console.error('[IPA] Error:', e);
        return json(
            { error: e instanceof Error ? e.message : 'Failed to generate IPA' },
            { status: 500 }
        );
    }
};

// GET - 获取支持的模型列表
export const GET: RequestHandler = async () => {
    const models = Object.entries(LLM_MODELS).map(([key, config]) => ({
        id: key,
        name: config.name,
        modelId: config.id,
        provider: config.provider,
    }));

    return json({
        models,
        defaultModel: 'kimi',
    });
};
