/**
 * SSR API 路由 - 单词管理
 * 使用 Service Role Key 绕过 RLS 限制
 */

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

// 创建服务端 Supabase 客户端（使用 Service Role Key）
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 类型定义
interface WordInsert {
  word: string;
  ipa?: string | null;
  audio_url?: string | null;
}

interface WordUpdate extends Partial<WordInsert> {}

// GET - 获取单词列表（支持分页和搜索）
export const GET: RequestHandler = async ({ url }) => {
  try {
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 构建查询 - 使用 count: 'exact' 获取总数
    let query = supabase
      .from('words')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`word.ilike.%${search}%,normalized.ilike.%${search}%`);
    }

    // 应用分页
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0)
    });
  } catch (e) {
    console.error('GET /api/words error:', e);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// POST - 创建单词
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: WordInsert = await request.json();

    // 验证必填字段
    if (!body.word) {
      return json({ error: 'word is required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('words').insert(body).select().single();

    if (error) {
      console.error('POST /api/words error:', error);
      return json({ error: error.message }, { status: 400 });
    }

    return json({ data });
  } catch (e) {
    console.error('POST /api/words error:', e);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// PUT - 更新单词
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body: { id: string } & WordUpdate = await request.json();

    if (!body.id) {
      return json({ error: 'id is required' }, { status: 400 });
    }

    const { id, ...updateData } = body;

    const { data, error } = await supabase
      .from('words')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/words error:', error);
      return json({ error: error.message }, { status: 400 });
    }

    return json({ data });
  } catch (e) {
    console.error('PUT /api/words error:', e);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// DELETE - 删除单词
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase.from('words').delete().eq('id', id);

    if (error) {
      console.error('DELETE /api/words error:', error);
      return json({ error: error.message }, { status: 400 });
    }

    return json({ success: true });
  } catch (e) {
    console.error('DELETE /api/words error:', e);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
