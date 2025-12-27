const API = 'https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4';
const VOICE = 'https://dict.youdao.com/dictvoice';

export interface YoudaoResult {
  word: string;
  ipa_us: string | null;
  ipa_uk: string | null;
  audio_us: string;
  audio_uk: string;
}

function sign(word: string): string {
  return '0cebf013168af8e008aa3823d8ee36aa';
}

export async function getPhonetics(word: string): Promise<YoudaoResult> {
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

  console.log(data?.simple,'simple');
  
  const result = {
    word: word.toLowerCase(),
    ipa_us: w?.usphone || null,
    ipa_uk: w?.ukphone || null,
    audio_us: `${VOICE}?audio=${encodeURIComponent(word)}&type=2`,
    audio_uk: `${VOICE}?audio=${encodeURIComponent(word)}&type=1`
  };

//   console.log(`[Youdao] 查询成功: "${word}" -> US: ${result.ipa_us || '无'}, UK: ${result.ipa_uk || '无'}`);
  return result;
}

export async function fetchAudio(word: string, accent: 'us' | 'uk' = 'us'): Promise<Uint8Array> {
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
}
