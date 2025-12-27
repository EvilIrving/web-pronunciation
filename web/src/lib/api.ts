import type { Word } from './types';

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
  ipa?: string;
  ipa_uk?: string;
  audio_url?: string;
  audio_url_uk?: string;
}) {
  const res = await fetch('/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ data?: Word; error?: string }>;
}

export async function updateWord(data: { id: string; [key: string]: string }) {
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
  return { ipa: json.ipa || '', ipa_uk: json.ipa_uk || '' };
}

export async function fetchEudic(word: string) {
  const res = await fetch(`/api/eudic?word=${encodeURIComponent(word)}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Eudic failed');
  return { ipa_us: json.ipa_us || '', ipa_uk: json.ipa_uk || '' };
}

export async function fetchTTS(word: string, mode: 'single' | 'both' = 'both', accent: Accent = 'us') {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, mode, accent }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('TTS failed');
  return { audio_url: json.audio_url || '', audio_url_uk: json.audio_url_uk || '' };
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
