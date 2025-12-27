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
  const form = new URLSearchParams({
    q: word, le: 'en', t: '3', client: 'web',
    sign: sign(word), keyfrom: 'webdict'
  });

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });

  if (!res.ok) throw new Error(`youdao: ${res.status}`);

  const data = await res.json();
  const w = data?.simple?.word?.[0];

  return {
    word: word.toLowerCase(),
    ipa_us: w?.usphone || null,
    ipa_uk: w?.ukphone || null,
    audio_us: `${VOICE}?audio=${encodeURIComponent(word)}&type=2`,
    audio_uk: `${VOICE}?audio=${encodeURIComponent(word)}&type=1`
  };
}

export async function fetchAudio(word: string, accent: 'us' | 'uk' = 'us'): Promise<Uint8Array> {
  const type = accent === 'uk' ? 1 : 2;
  const url = `${VOICE}?audio=${encodeURIComponent(word)}&type=${type}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });

  if (!res.ok) throw new Error(`youdao audio: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) throw new Error('empty audio');
  return new Uint8Array(buf);
}
