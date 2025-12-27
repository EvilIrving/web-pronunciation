/**
 * TTS API 路由 - 使用真人发音（frdic.com）
 * 替换 MiniMax T2A，使用有道词典真人发音接口
 */

import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } from '$env/static/private';
import type { RequestHandler } from './$types';

// frdic.com 真人发音 API（美音）
const FRDIC_TTS_URL = 'https://api.frdic.com/api/v2/speech/speakweb';

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
 * 格式：QYN + Base64(text)
 */
function encodeWordToFrdic(text: string): string {
    const base64 = Buffer.from(text).toString('base64');
    return `QYN${base64}`;
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
 * 从 frdic.com 获取真人发音音频
 */
async function fetchAudioFromFrdic(word: string): Promise<Uint8Array> {
    // 编码单词
    const encodedWord = encodeWordToFrdic(word);
    const url = `${FRDIC_TTS_URL}?langid=en&voicename=en_us_female&txt=${encodedWord}`;

    console.log(`[TTS] Fetching audio from frdic: ${url}`);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'audio/mpeg,audio/*,*/*',
            'Referer': 'https://www.frdic.com/',
        },
    });

    if (!response.ok) {
        throw new Error(`frdic API error: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioData = new Uint8Array(arrayBuffer);

    if (audioData.length === 0) {
        throw new Error('Empty audio data received');
    }

    console.log(`[TTS] Audio data size: ${audioData.length} bytes`);
    return audioData;
}

/**
 * 调用 frdic 真人发音 API
 */
async function generateAudioWithFrdic(text: string): Promise<{ audioUrl: string; audioSize: number }> {
    // 从 frdic 获取音频
    const audioData = await fetchAudioFromFrdic(text);

    // 生成文件名
    const filename = `${text.toLowerCase()}_${Date.now()}.mp3`;

    // 上传到 R2
    const audioUrl = await uploadToR2(audioData, filename);

    return {
        audioUrl,
        audioSize: audioData.length,
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

        const result = await generateAudioWithFrdic(word);

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
