import type { Word, IpaSource } from './types';

type Accent = 'us' | 'uk';

export async function getWords(opts: { search?: string; limit?: number; offset?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.search) p.set('search', opts.search);
  if (opts.limit) p.set('limit', String(opts.limit));
  if (opts.offset) p.set('offset', String(opts.offset));

  const res = await fetch(`/api/words?${p}`);
  return res.json() as Promise<{ data: Word[]; total: number; hasMore: boolean; error?: string }>;
}

export async function addWord(data: {
  word: string;
  ipa_us?: string;
  ipa_uk?: string;
  ipa?: string;
  audio_url_us?: string;
  audio_url_uk?: string;
  audio_url?: string;
  ipa_source?: IpaSource;
}) {
  const res = await fetch('/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ data?: Word; error?: string }>;
}

export async function updateWord(data: { id: string; ipa_source?: IpaSource; [key: string]: string | IpaSource | undefined }) {
  const res = await fetch('/api/words', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ data?: Word; error?: string }>;
}

export async function deleteWord(id: string) {
  return fetch(`/api/words?id=${id}`, { method: 'DELETE' });
}

export async function fetchIPA(word: string, provider: string) {
  const res = await fetch('/api/ipa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, provider }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'IPA failed');
  return { ipa_us: json.ipa_us || '', ipa_uk: json.ipa_uk || '' };
}

export async function fetchPhonetics(word: string, provider: 'auto' | 'youdao' | 'eudic' = 'auto', fallback: boolean = true, retries: number = 3): Promise<{
  ipa_us: string;
  ipa_uk: string;
  ipa: string;
  ipa_source: IpaSource;
  audio_url_us: string;
  audio_url_uk: string;
  audio_url: string;
}> {
  const res = await fetch(`/api/phonetics?word=${encodeURIComponent(word)}&provider=${provider}&fallback=${fallback}`);

  // 处理限流：等待后自动重试
  if (res.status === 429) {
    const json = await res.json();
    const waitSeconds = json.retry_after || 12;
    console.log(`[api] 速率限制，等待 ${waitSeconds} 秒后重试`);
    await new Promise(r => setTimeout(r, waitSeconds * 1000));
    if (retries > 0) return fetchPhonetics(word, provider, fallback, retries - 1);
    throw new Error('rate limited');
  }

  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Phonetics failed');
  return {
    ipa_us: json.ipa_us || '',
    ipa_uk: json.ipa_uk || '',
    ipa: json.ipa || '',
    ipa_source: json.ipa_source as IpaSource,
    audio_url_us: json.audio_url_us || '',
    audio_url_uk: json.audio_url_uk || '',
    audio_url: json.audio_url || ''
  };
}

export async function fetchEudic(word: string) {
  return fetchPhonetics(word, 'eudic');
}

export async function fetchTTS(word: string, mode: 'single' | 'both' = 'both', accent: Accent = 'us', existingPhonetics?: { audio_url_us: string; audio_url_uk: string; audio_url: string }) {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, mode, accent, existingPhonetics }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('TTS failed');
  return {
    audio_url_us: json.audio_url_us || '',
    audio_url_uk: json.audio_url_uk || '',
    audio_url: json.audio_url || ''
  };
}

export async function uploadAudio(opts: { url?: string; file?: File; word: string }) {
  let res: Response;
  if (opts.url) {
    res = await fetch('/api/upload-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: opts.url, word: opts.word }),
    });
  } else if (opts.file) {
    const form = new FormData();
    form.append('audio', opts.file);
    form.append('word', opts.word);
    res = await fetch('/api/upload-audio', { method: 'POST', body: form });
  } else {
    throw new Error('url or file required');
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'upload failed');
  return { audio_url: json.audio_url };
}

export async function getModels() {
  const res = await fetch('/api/ipa');
  const json = await res.json();
  return {
    models: json.models || [] as Array<{ id: string; name: string }>,
    defaultModel: json.defaultModel || 'kimi',
  };
}
