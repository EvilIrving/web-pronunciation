/**
 * Unified LLM Client - 支持 MiniMax 和 Kimi (Moonshot) 模型
 * 使用 OpenAI SDK 统一调用接口
 */

import OpenAI from 'openai';
import {
    MOONSHOT_API_KEY,
    MOONSHOT_BASE_URL,
    MINIMAX_API_KEY,
    MINIMAX_BASE_URL,
    LLM_MODEL,
} from '$env/static/private';

// 模型配置
export const LLM_MODELS = {
    /** Kimi (Moonshot) - kimi-k2-turbo-preview */
    kimi: {
        id: 'kimi-k2-turbo-preview',
        provider: 'moonshot',
        name: 'Kimi (Moonshot)',
        systemPrompt: '你是 Kimi，由 Moonshot AI 提供的人工智能助手。你擅长提供技术词汇的 IPA 国际音标。对于给定的技术词汇，只返回 IPA 音标，不要有其他解释。',
    },
    /** MiniMax - MiniMax-M2.1 */
    minimax: {
        id: 'MiniMax-M2.1',
        provider: 'minimax',
        name: 'MiniMax',
        systemPrompt: 'You are a helpful assistant that provides IPA (International Phonetic Alphabet) transcriptions for technical terms. For the given technical word, return only the IPA transcription, no other explanations.',
    },
} as const;

export type LLMProvider = keyof typeof LLM_MODELS;

// 获取当前配置的模型
export function getCurrentModel(): { id: string; provider: LLMProvider; systemPrompt: string } {
    const modelId = LLM_MODEL || 'kimi';
    const provider = (modelId as LLMProvider) || 'kimi';
    const config = LLM_MODELS[provider];

    return {
        id: config.id,
        provider,
        systemPrompt: config.systemPrompt,
    };
}

// 创建 OpenAI 客户端
function createClient(provider: LLMProvider): OpenAI {
    const baseURL = provider === 'kimi' ? MOONSHOT_BASE_URL : MINIMAX_BASE_URL;
    const apiKey = provider === 'kimi' ? MOONSHOT_API_KEY : MINIMAX_API_KEY;

    return new OpenAI({
        apiKey,
        baseURL,
        dangerouslyAllowBrowser: false, // 仅服务端使用
    });
}

/**
 * 生成 IPA 音标
 * @param word 要生成音标的单词
 * @param provider 模型提供商 (默认使用环境变量配置)
 * @returns IPA 音标字符串
 */
export async function generateIPA(
    word: string,
    provider: LLMProvider = getCurrentModel().provider
): Promise<string> {
    const config = LLM_MODELS[provider];
    const client = createClient(provider);

    console.log(`[LLM] Generating IPA with ${config.name} for word: ${word}`);

    const response = await client.chat.completions.create({
        model: config.id,
        messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: word },
        ],
        temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
        throw new Error(`No IPA content in response from ${config.name}`);
    }

    console.log(`[LLM] IPA generated successfully: ${content}`);

    return content;
}

/**
 * 通用文本生成
 * @param messages 消息列表
 * @param provider 模型提供商
 * @returns 生成的内容
 */
export async function generateText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    provider: LLMProvider = getCurrentModel().provider
): Promise<string> {
    const config = LLM_MODELS[provider];
    const client = createClient(provider);

    const response = await client.chat.completions.create({
        model: config.id,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || '';
}
