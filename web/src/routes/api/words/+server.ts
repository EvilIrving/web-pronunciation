import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface WordInsert {
  word: string;
  ipa?: string | null;
  audio_url?: string | null;
  ipa_uk?: string | null;
  audio_url_uk?: string | null;
}

interface WordUpdate extends Partial<WordInsert> {}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let q = supabase.from('words').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (search) q = q.or(`word.ilike.%${search}%,normalized.ilike.%${search}%`);
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) return json({ error: error.message }, { status: 400 });
    return json({ data: data || [], total: count || 0, limit, offset, hasMore: (offset + limit) < (count || 0) });
  } catch (e) {
    console.error('[words GET]', e);
    return json({ error: 'error' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: WordInsert = await request.json();
    if (!body.word) return json({ error: 'word required' }, { status: 400 });
    const { data, error } = await supabase.from('words').insert(body).select().single();
    if (error) return json({ error: error.message }, { status: 400 });
    return json({ data });
  } catch (e) {
    console.error('[words POST]', e);
    return json({ error: 'error' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body: { id: string } & WordUpdate = await request.json();
    if (!body.id) return json({ error: 'id required' }, { status: 400 });
    const { id, ...update } = body;
    const { data, error } = await supabase.from('words').update(update).eq('id', id).select().single();
    if (error) return json({ error: error.message }, { status: 400 });
    return json({ data });
  } catch (e) {
    console.error('[words PUT]', e);
    return json({ error: 'error' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('words').delete().eq('id', id);
    if (error) return json({ error: error.message }, { status: 400 });
    return json({ success: true });
  } catch (e) {
    console.error('[words DELETE]', e);
    return json({ error: 'error' }, { status: 500 });
  }
};
