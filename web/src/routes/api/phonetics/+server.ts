import { json } from '@sveltejs/kit';
import { getPhonetics as youdao } from '$lib/youdao/client';
import { getPhonetics as eudic } from '$lib/eudic/parser';
import { generateIPA } from '$lib/llm/client';
import type { RequestHandler } from './$types';
import type { IpaSource } from '$lib/types';

type Provider = 'youdao' | 'eudic' | 'auto';

// 速率限制：每分钟最多 5 个请求
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 1000; // 1分钟窗口

// 内存中的请求时间戳队列（仅用于服务端进程内限制）
let requestTimes: number[] = [];

// 服务端维护上次使用的 provider，用于轮询
let lastProvider: Provider = 'youdao';

function checkRateLimit(): { allowed: boolean; waitSeconds: number } {
  const now = Date.now();
  // 清理过期的请求记录
  requestTimes = requestTimes.filter(t => now - t < WINDOW_MS);

  if (requestTimes.length >= RATE_LIMIT) {
    const oldest = requestTimes[0];
    const waitSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  requestTimes.push(now);
  return { allowed: true, waitSeconds: 0 };
}

export const GET: RequestHandler = async ({ url }) => {
  const word = url.searchParams.get('word');
  let provider = (url.searchParams.get('provider') || 'auto') as Provider;
  const fallbackLLM = url.searchParams.get('fallback') !== 'false';

  if (!word) return json({ error: 'word required' }, { status: 400 });

  // 速率限制检查
  const { allowed, waitSeconds } = checkRateLimit();
  if (!allowed) {
    return json({ error: 'rate limited', retry_after: waitSeconds }, { status: 429 });
  }

  try {
    let result;
    let ipa_source: IpaSource = null;
    let usedProvider: Provider = provider;

    // auto 模式：轮询切换 provider
    if (provider === 'auto') {
      if (lastProvider === 'youdao') {
        lastProvider = 'eudic';
      } else {
        lastProvider = 'youdao';
      }
      usedProvider = lastProvider;
      console.log(`[Phonetics/auto] 使用 ${usedProvider} 查询 "${word}"`);
    }

    if (usedProvider === 'eudic') {
      result = await eudic(word);
    } else {
      result = await youdao(word);
    }

    if (result.ipa_us || result.ipa_uk) {
      ipa_source = 'dict';
    } else if (fallbackLLM) {
      console.log(`[Phonetics] 词典无音标，尝试 LLM 生成: "${word}"`);
      try {
        const llmIpa = await generateIPA(word);
        result.ipa_us = llmIpa;
        result.ipa_uk = llmIpa;
        ipa_source = 'llm';
        console.log('生成  llm  音标');
      } catch (llmErr) {
        console.warn(`[Phonetics] LLM 生成音标失败: ${llmErr}`);
      }
    }

    return json({ success: true, ...result, provider: usedProvider, ipa_source });
  } catch (e) {
    console.error(`[Phonetics/${provider}]`, e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};