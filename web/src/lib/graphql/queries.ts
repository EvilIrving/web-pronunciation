import { supabase } from '$lib/supabase'
import type { Word } from '$lib/types'

export type WordFilter = {
  search?: string
  category?: string
  orderBy?: 'created_at' | 'word' | 'frequency'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export type WordResponse = {
  data: Word[] | null
  error: Error | null
  count: number | null
}

export async function getWords(filter: WordFilter = {}): Promise<WordResponse> {
  const {
    search,
    orderBy = 'created_at',
    order = 'desc',
    limit = 50,
    offset = 0,
  } = filter

  let query = supabase
    .from('words')
    .select('*', { count: 'exact' })
    .order(orderBy, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.ilike('word', `%${search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('getWords error:', error)
    return { data: null, error: new Error(error.message), count: null }
  }

  return { data, error: null, count }
}

export async function getWord(id: string) {
  const { data, error } = await supabase.from('words').select('*').eq('id', id).single()

  if (error) {
    console.error('getWord error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data, error: null }
}

export async function createWord(wordData: Partial<Word>) {
  const { data, error } = await supabase.from('words').insert(wordData).select().single()

  if (error) {
    console.error('createWord error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data, error: null }
}

export async function updateWord(id: string, wordData: Partial<Word>) {
  const { data, error } = await supabase
    .from('words')
    .update(wordData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateWord error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data, error: null }
}

export async function deleteWord(id: string) {
  const { error } = await supabase.from('words').delete().eq('id', id)

  if (error) {
    console.error('deleteWord error:', error)
    return { error: new Error(error.message) }
  }

  return { error: null }
}

export async function searchWords(query: string, limit = 10) {
  const { data, error } = await supabase
    .from('words')
    .select('id, word, ipa, audio_url')
    .ilike('word', `%${query}%`)
    .limit(limit)

  if (error) {
    console.error('searchWords error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data, error: null }
}
