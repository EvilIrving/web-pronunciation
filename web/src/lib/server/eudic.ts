import { MINIMAX_API_KEY } from '$env/static/private';
import { fetchAudio as fetchYoudao } from '$lib/server/youdao/client';
import { withRateLimit } from '$lib/rate-limit';

const FRDIC_URL = 'https://api.frdic.com/api/v2/speech/speakweb';  // 欧路词典 TTS 服务
const MINIMAX_URL = 'https://api.minimaxi.com/v1/t2a_v2';

const VOICES: Record<string, string> = { us: 'en_us_female', uk: 'en_uk_male' };

export function encode(text: string): string {
  return `QYN${Buffer.from(text).toString('base64')}`;
}

/**
 * 获取欧路词典（frdic）TTS 音频
 */
export async function fetchEudic(word: string, accent = 'us', encodedTxt?: string): Promise<Uint8Array> {
  return withRateLimit('eudic', async () => {
    const txt = encodedTxt || encode(word);
    const voice = VOICES[accent] || VOICES.us;
    const url = `${FRDIC_URL}?langid=en&voicename=${voice}&txt=${txt}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'audio/mpeg,audio/*,*/*',
        'Referer': 'https://www.frdic.com/',
      },
    });

    if (!res.ok) throw new Error(`eudic: ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) throw new Error('empty audio');
    return new Uint8Array(buf);
  });
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) bytes[i / 2] = parseInt(h.substring(i, i + 2), 16);
  return bytes;
}

export async function fetchMinimax(text: string): Promise<Uint8Array> {
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MINIMAX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'speech-2.6-hd', text, stream: false,
      voice_setting: { voice_id: 'male-qn-qingse', speed: 1, vol: 1, pitch: 0, emotion: 'neutral' },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      subtitle_enable: false,
    }),
  });

  if (!res.ok) throw new Error(`minimax: ${res.status}`);
  const data = await res.json();
  if (data.base_resp?.status_code !== 0) throw new Error(data.base_resp?.status_msg || 'minimax error');
  if (!data.data?.audio) throw new Error('no audio');
  return hexToBytes(data.data.audio);
}

export type TtsProvider = 'youdao' | 'eudic' | 'minimax';

/**
 * 统一音频获取接口
 * 按优先级尝试各 TTS 提供商
 */
export async function fetchAudio(word: string, accent = 'us', provider: TtsProvider = 'youdao', encodedTxt?: string): Promise<Uint8Array> {
  const providers: TtsProvider[] = provider === 'youdao'
    ? ['youdao', 'eudic', 'minimax']
    : provider === 'eudic'
      ? ['eudic', 'minimax']
      : ['minimax'];

  let lastError: Error | null = null;

  for (const p of providers) {
    try {
      if (p === 'youdao') return fetchYoudao(word, accent as 'us' | 'uk');
      if (p === 'minimax') return fetchMinimax(word);
      return fetchEudic(word, accent, encodedTxt);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[TTS] ${p} failed, trying next provider:`, lastError.message);
    }
  }

  throw lastError || new Error('all providers failed');
}
