/**
 * Batch Update API 路由 - 批量更新单词音标和音频
 * 支持速率限制（20 单词/分钟）和进度追踪
 */

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { getPhonetics } from '$lib/eudic/parser';
import type { RequestHandler } from './$types';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL
} from '$env/static/private';

// 创建服务端 Supabase 客户端（使用 Service Role Key）
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// frdic.com 真人发音 API
const FRDIC_TTS_URL = 'https://api.frdic.com/api/v2/speech/speakweb';
const FRDIC_VOICENAME: Record<string, string> = {
    us: 'en_us_female',
    uk: 'en_uk_male',
};

// 速率限制：每分钟处理单词数
const RATE_LIMIT_PER_MINUTE = 20;
const DELAY_BETWEEN_REQUESTS = 60_000 / RATE_LIMIT_PER_MINUTE; // 3000ms

// R2 S3 客户端配置
function getR2Client(): S3Client {
    return new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });
}

/**
 * 将文本编码为 frdic 格式的 Base64
 */
function encodeWordToFrdic(text: string): string {
    const base64 = Buffer.from(text).toString('base64');
    return `QYN${base64}`;
}

/**
 * 从 frdic.com 获取真人发音音频
 */
async function fetchAudioFromFrdic(word: string, accent: string): Promise<Uint8Array> {
    const encodedWord = encodeWordToFrdic(word);
    const voicename = FRDIC_VOICENAME[accent] || FRDIC_VOICENAME['us'];
    const url = `${FRDIC_TTS_URL}?langid=en&voicename=${voicename}&txt=${encodedWord}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'audio/mpeg,audio/*,*/*',
            'Referer': 'https://www.frdic.com/',
        },
    });

    if (!response.ok) {
        throw new Error(`frdic API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

/**
 * 上传音频到 R2
 */
async function uploadToR2(audioData: Uint8Array, filename: string): Promise<string> {
    const client = getR2Client();
    await client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filename,
        Body: audioData,
        ContentType: 'audio/mpeg',
    }));
    return `${R2_PUBLIC_URL}/${filename}`;
}

/**
 * 为单词生成音频（支持美音和英音）
 */
async function generateAudioForWord(word: string, accent: string): Promise<string> {
    const audioData = await fetchAudioFromFrdic(word, accent);
    const filename = `${word.toLowerCase()}_${accent}_${Date.now()}.mp3`;
    return uploadToR2(audioData, filename);
}

/**
 * 从欧路词典获取音标（带缓存检查）
 */
async function fetchPhoneticsWithCache(word: string): Promise<{
  ipa_uk: string | null;
  ipa_us: string | null;
}> {
  // 先检查数据库中是否已有数据
  const { data: existing } = await supabase
    .from('words')
    .select('ipa_uk, ipa_us')
    .eq('normalized', word.toLowerCase())
    .single();

  if (existing?.ipa_uk && existing?.ipa_us) {
    console.log(`[Batch] Cache hit for: ${word}`);
    return {
      ipa_uk: existing.ipa_uk,
      ipa_us: existing.ipa_us,
    };
  }

  // 从欧路词典获取
  const result = await getPhonetics(word);
  console.log(`[Batch] Fetched from Eudic: ${word} -> UK=${result.ipa_uk}, US=${result.ipa_us}`);

  return {
    ipa_uk: result.ipa_uk,
    ipa_us: result.ipa_us,
  };
}

// POST - 创建批量更新任务
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { wordIds, updatePhonetics = true, updateAudio = false, audioMode = 'both' } = body;

        if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
            return json({ error: 'wordIds array is required' }, { status: 400 });
        }

        console.log(`[Batch] Starting batch update for ${wordIds.length} words, audioMode: ${audioMode}`);

        // 创建任务记录
        const taskId = randomUUID();
        const { error: taskError } = await supabase
            .from('batch_update_tasks')
            .insert({
                id: taskId,
                status: 'processing',
                total_words: wordIds.length,
                processed_words: 0,
                failed_words: 0,
                started_at: new Date().toISOString(),
            });

        if (taskError) {
            console.error('[Batch] Failed to create task:', taskError);
            return json({ error: 'Failed to create task' }, { status: 500 });
        }

        let processed = 0;
        let failed = 0;

        // 获取所有单词（包含现有音频信息）
        const { data: words, error: fetchError } = await supabase
            .from('words')
            .select('id, normalized, audio_url, audio_url_uk')
            .in('id', wordIds);

        if (fetchError) {
            console.error('[Batch] Failed to fetch words:', fetchError);
            await supabase
                .from('batch_update_tasks')
                .update({
                    status: 'failed',
                    error_message: fetchError.message,
                })
                .eq('id', taskId);

            return json({ error: 'Failed to fetch words' }, { status: 500 });
        }

        // 确定需要生成哪些音频
        const accents: string[] = [];
        if (audioMode === 'both' || audioMode === 'us') {
            accents.push('us');
        }
        if (audioMode === 'both' || audioMode === 'uk') {
            accents.push('uk');
        }

        // 逐个处理（带速率限制）
        for (const word of words) {
            try {
                const updates: Record<string, unknown> = {};

                // 更新音标
                if (updatePhonetics) {
                    const phonetics = await fetchPhoneticsWithCache(word.normalized);
                    if (phonetics.ipa_uk) updates.ipa_uk = phonetics.ipa_uk;
                    if (phonetics.ipa_us) updates.ipa_us = phonetics.ipa_us;
                }

                // 更新音频
                if (updateAudio && accents.length > 0) {
                    for (const accent of accents) {
                        const audioKey = accent === 'us' ? 'audio_url' : 'audio_url_uk';
                        // 如果该口音的音频不存在，则生成
                        if (!word[audioKey]) {
                            try {
                                const audioUrl = await generateAudioForWord(word.normalized, accent);
                                updates[audioKey] = audioUrl;
                                console.log(`[Batch] Generated ${accent} audio for: ${word.normalized}`);
                            } catch (audioErr) {
                                console.error(`[Batch] Failed to generate ${accent} audio for ${word.normalized}:`, audioErr);
                            }
                        }
                    }
                }

                // 执行更新
                if (Object.keys(updates).length > 0) {
                    const { error: updateError } = await supabase
                        .from('words')
                        .update(updates)
                        .eq('id', word.id);

                    if (updateError) {
                        console.error(`[Batch] Failed to update word ${word.normalized}:`, updateError);
                        failed++;
                    } else {
                        processed++;
                        console.log(`[Batch] Updated: ${word.normalized}`);
                    }
                } else {
                    processed++; // 没有需要更新的内容也算处理完成
                }

                // 更新任务进度
                await supabase
                    .from('batch_update_tasks')
                    .update({
                        processed_words: processed + failed,
                        failed_words: failed,
                    })
                    .eq('id', taskId);

                // 速率限制
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

            } catch (err) {
                console.error(`[Batch] Error processing ${word.normalized}:`, err);
                failed++;
            }
        }

        // 完成任务
        await supabase
            .from('batch_update_tasks')
            .update({
                status: failed > 0 ? 'completed' : 'completed',
                processed_words: processed,
                failed_words: failed,
                completed_at: new Date().toISOString(),
            })
            .eq('id', taskId);

        return json({
            success: true,
            taskId,
            total: wordIds.length,
            processed,
            failed,
        });

    } catch (e) {
        console.error('[Batch] Error:', e);
        return json(
            { error: e instanceof Error ? e.message : 'Batch update failed' },
            { status: 500 }
        );
    }
};

// GET - 获取任务状态
export const GET: RequestHandler = async ({ url }) => {
    try {
        const taskId = url.searchParams.get('taskId');

        if (!taskId) {
            // 返回最近的任务列表
            const { data, error } = await supabase
                .from('batch_update_tasks')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                return json({ error: error.message }, { status: 400 });
            }

            return json({ tasks: data });
        }

        // 返回特定任务状态
        const { data, error } = await supabase
            .from('batch_update_tasks')
            .select('*')
            .eq('id', taskId)
            .single();

        if (error) {
            return json({ error: error.message }, { status: 400 });
        }

        return json({ task: data });

    } catch (e) {
        console.error('[Batch] GET error:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};



               