import { json } from '@sveltejs/kit';
import { getPhonetics as youdao } from '$lib/youdao/client';
import { getPhonetics as eudic } from '$lib/eudic/parser';
import type { RequestHandler } from './$types';
import type { IpaSource } from '$lib/types';

type Provider = 'youdao' | 'eudic' | 'auto';

// 服务端维护上次使用的 provider，用于轮询
let lastProvider: Provider = 'youdao';

// 解析 provider 速率限制错误中的等待时间
function parseRetryAfter(errorMessage: string): number | null {
  const match = errorMessage.match(/retry after (\d+)s/);
  return match ? parseInt(match[1]) : null;
}

export const GET: RequestHandler = async ({ url }) => {
  const word = url.searchParams.get('word');
  let provider = (url.searchParams.get('provider') || 'auto') as Provider;

  if (!word) return json({ error: 'word required' }, { status: 400 });

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
    }

    return json({ success: true, ...result, provider: usedProvider, ipa_source });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Phonetics/${provider}]`, e);

    // 检查是否是速率限制错误
    if (msg.includes('rate limited')) {
      const waitSeconds = parseRetryAfter(msg) || 12;
      return json({ error: 'rate limited', retry_after: waitSeconds }, { status: 429 });
    }

    return json({ error: msg }, { status: 500 });
  }
};