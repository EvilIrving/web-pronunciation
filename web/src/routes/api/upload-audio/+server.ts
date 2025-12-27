import { json } from '@sveltejs/kit';
import { upload, genFilename, AUDIO_TYPES, MAX_SIZE, getExt } from '$lib/r2';
import type { RequestHandler } from './$types';

async function fetchUrl(url: string): Promise<{ data: Uint8Array; type: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const type = res.headers.get('content-type') || 'audio/mpeg';
  if (!type.includes('audio/')) throw new Error(`invalid type: ${type}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_SIZE) throw new Error('file too large');
  return { data: new Uint8Array(buf), type };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const ct = request.headers.get('content-type') || '';

    if (ct.includes('application/json')) {
      const { url, word } = await request.json();
      if (!url) return json({ error: 'url required' }, { status: 400 });
      try { new URL(url); } catch { return json({ error: 'invalid url' }, { status: 400 }); }

      const { data, type } = await fetchUrl(url);
      const audioUrl = await upload(data, genFilename(word || 'audio', 'custom', getExt(type)), type);
      return json({ success: true, audio_url_us: audioUrl, size: data.length, source: 'url' });
    }

    const form = await request.formData();
    const file = form.get('audio') as File | null;
    const word = form.get('word') as string | null;

    if (!file || file.size === 0) return json({ error: 'no file' }, { status: 400 });
    if (!AUDIO_TYPES.includes(file.type)) return json({ error: 'invalid format' }, { status: 400 });
    if (file.size > MAX_SIZE) return json({ error: 'file too large' }, { status: 400 });

    const data = new Uint8Array(await file.arrayBuffer());
    const audioUrl = await upload(data, genFilename(word || 'audio', 'custom', getExt(file.type)), file.type);
    return json({ success: true, audio_url_us: audioUrl, original_name: file.name, size: file.size, source: 'file' });
  } catch (e) {
    console.error('[Upload]', e);
    return json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
};
