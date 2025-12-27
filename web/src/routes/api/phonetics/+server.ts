import { json } from '@sveltejs/kit';
import { getPhonetics as youdao } from '$lib/youdao/client';
import { getPhonetics as eudic } from '$lib/eudic/parser';
import { generateIPA } from '$lib/llm/client';
import type { RequestHandler } from './$types';
import type { IpaSource } from '$lib/types';

type Provider = 'youdao' | 'eudic';

export const GET: RequestHandler = async ({ url }) => {
  const word = url.searchParams.get('word');
  const provider = (url.searchParams.get('provider') || 'youdao') as Provider;
  const fallbackLLM = url.searchParams.get('fallback') !== 'false';

  if (!word) return json({ error: 'word required' }, { status: 400 });

  try {
    let result;
    let ipa_source: IpaSource = null;

    if (provider === 'eudic') {
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

    return json({ success: true, ...result, provider, ipa_source });
  } catch (e) {
    console.error(`[Phonetics/${provider}]`, e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};