import { withRateLimit } from '$lib/rate-limit';

const API = 'https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4';
const VOICE = 'https://dict.youdao.com/dictvoice';

export interface YoudaoResult {
  word: string;
  ipa_us: string | null;
  ipa_uk: string | null;
  ipa: string | null;
  audio_url_us: string | null;
  audio_url_uk: string | null;
  audio_url: string | null;
}

function sign(word: string): string {
  return '6b7cc97822fa580d061129c050f49de8';
}

export async function getPhonetics(word: string): Promise<YoudaoResult> {
  return withRateLimit('youdao', async () => {
    console.log(`[Youdao] 查询音标: "${word}"`);

    const form = new URLSearchParams({
      q: word, le: 'en', t: '3', client: 'web',
      sign: sign(word), keyfrom: 'webdict'
    });

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });

    if (!res.ok) {
      console.error(`[Youdao] 请求失败: ${res.status} ${res.statusText}`);
      throw new Error(`youdao: ${res.status}`);
    }

    const data = await res.json();
    const w = data?.simple?.word?.[0];

    console.log('[Youdao] 返回数据:', JSON.stringify(w, null, 2));

    // 判断返回类型
    const hasUsIpa = !!w?.usphone;
    const hasUkIpa = !!w?.ukphone;
    const hasCommonIpa = !!w?.phone;
    const hasCommonSpeech = !!w?.speech;
    const hasUsSpeech = !!w?.usspeech;
    const hasUkSpeech = !!w?.ukspeech;

    const result: YoudaoResult = {
      word: word.toLowerCase(),
      ipa_us: hasUsIpa ? w.usphone : null,
      ipa_uk: hasUkIpa ? w.ukphone : null,
      ipa: hasCommonIpa ? w.phone : null,
      audio_url_us: hasUsSpeech ? `${VOICE}?${w.usspeech}&type=2` : null,
      audio_url_uk: hasUkSpeech ? `${VOICE}?${w.ukspeech}&type=1` : null,
      audio_url: hasCommonSpeech ? `${VOICE}?${w.speech}&type=2` : null
    };

    console.log(`[Youdao] 解析结果:`, {
      ipa_us: result.ipa_us,
      ipa_uk: result.ipa_uk,
      ipa: result.ipa,
      audio_url_us: result.audio_url_us ? '有' : '无',
      audio_url_uk: result.audio_url_uk ? '有' : '无',
      audio_url: result.audio_url ? '有' : '无'
    });

    return result;
  });
}

export async function fetchAudio(word: string, accent: 'us' | 'uk' = 'us'): Promise<Uint8Array> {
  return withRateLimit('youdao', async () => {
    console.log(`[Youdao] 获取音频: "${word}" (${accent.toUpperCase()})`);

    const type = accent === 'uk' ? 1 : 2;
    const url = `${VOICE}?audio=${encodeURIComponent(word)}&type=${type}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });

    if (!res.ok) {
      console.error(`[Youdao] 音频请求失败: ${res.status} ${res.statusText}`);
      throw new Error(`youdao audio: ${res.status}`);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      console.error(`[Youdao] 音频为空: "${word}"`);
      throw new Error('empty audio');
    }

    console.log(`[Youdao] 音频获取成功: "${word}" (${accent.toUpperCase()}), 大小: ${buf.byteLength} bytes`);
    return new Uint8Array(buf);
  });
}
