/**
 * TTS API 路由 - 使用 MiniMax T2A 生成音频
 * PRD 12.1 参考: https://api.minimaxi.com/v1/t2a_v2
 */

import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MINIMAX_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } from '$env/static/private';
import type { RequestHandler } from './$types';

// MiniMax T2A API 端点
const MINIMAX_T2A_URL = 'https://api.minimaxi.com/v1/t2a_v2';

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
 * 将 hex 字符串转换为 Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
    // 移除可能的 "0x" 前缀
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
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

    // 返回公开访问 URL
    return `${R2_PUBLIC_URL}/${filename}`;
}

/**
 * 调用 MiniMax T2A API 生成音频
 */
async function generateAudioWithMiniMax(text: string): Promise<{ audioUrl: string; audioSize: number }> {
    const response = await fetch(MINIMAX_T2A_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'speech-2.6-hd',
            text: text,
            stream: false,
            voice_setting: {
                voice_id: 'male-qn-qingse',
                speed: 1,
                vol: 1,
                pitch: 0,
                emotion: 'neutral',
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: 'mp3',
                channel: 1,
            },
            subtitle_enable: false,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`MiniMax API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    console.log('[TTS] MiniMax response status:', data.base_resp?.status_code);
    console.log('[TTS] Audio hex length:', data.data?.audio?.length);

    if (data.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax API error: ${data.base_resp?.status_msg || 'unknown error'}`);
    }

    // 解码 hex 音频数据
    const audioHex = data.data?.audio;
    if (!audioHex) {
        throw new Error('No audio data in response');
    }

    console.log('[TTS] Converting hex to audio data...');
    const audioData = hexToUint8Array(audioHex);
    console.log('[TTS] Audio data size:', audioData.length, 'bytes');

    // 生成文件名（使用单词 + 时间戳）
    const filename = `${text.toLowerCase()}_${Date.now()}.mp3`;

    // 上传到 R2
    const audioUrl = await uploadToR2(audioData, filename);

    return {
        audioUrl,
        audioSize: data.extra_info?.audio_size || audioData.length,
    };
}

// POST - 生成音频
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { word } = body;

        if (!word) {
            return json({ error: 'word is required' }, { status: 400 });
        }

        console.log(`[TTS] Generating audio for word: ${word}`);

        const result = await generateAudioWithMiniMax(word);

        console.log(`[TTS] Audio generated successfully: ${result.audioUrl}`);

        return json({
            success: true,
            audio_url: result.audioUrl,
            audio_size: result.audioSize,
        });
    } catch (e) {
        console.error('[TTS] Error:', e);
        return json(
            { error: e instanceof Error ? e.message : 'Failed to generate audio' },
            { status: 500 }
        );
    }
};
