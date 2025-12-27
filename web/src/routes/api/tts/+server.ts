/**
 * TTS API 路由 - 支持多种发音源
 * 优先使用 frdic.com 真人发音，备用 MiniMax AI 发音
 */

import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
    MINIMAX_API_KEY,
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL
} from '$env/static/private';
import type { RequestHandler } from './$types';

// frdic.com 真人发音 API（美音）
const FRDIC_TTS_URL = 'https://api.frdic.com/api/v2/speech/speakweb';

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
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
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

    return `${R2_PUBLIC_URL}/${filename}`;
}

/**
 * 从 frdic.com 获取真人发音音频
 */
async function fetchAudioFromFrdic(word: string): Promise<Uint8Array> {
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

    console.log(`[TTS] frdic audio data size: ${audioData.length} bytes`);
    return audioData;
}

/**
 * 从 MiniMax T2A 获取 AI 生成音频
 */
async function fetchAudioFromMiniMax(text: string): Promise<Uint8Array> {
    console.log(`[TTS] Fetching audio from MiniMax for: ${text}`);

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

    if (data.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax API error: ${data.base_resp?.status_msg || 'unknown error'}`);
    }

    const audioHex = data.data?.audio;
    if (!audioHex) {
        throw new Error('No audio data in response');
    }

    const audioData = hexToUint8Array(audioHex);
    console.log(`[TTS] MiniMax audio data size: ${audioData.length} bytes`);
    return audioData;
}

/**
 * 生成音频（支持多种发音源）
 */
async function generateAudio(text: string, provider: 'frdic' | 'minimax' = 'frdic'): Promise<{ audioUrl: string; audioSize: number }> {
    // 根据 provider 获取音频
    const audioData = provider === 'frdic'
        ? await fetchAudioFromFrdic(text)
        : await fetchAudioFromMiniMax(text);

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
        const { word, provider } = body;

        if (!word) {
            return json({ error: 'word is required' }, { status: 400 });
        }

        // 支持指定发音源：frdic（默认，真人）或 minimax（AI）
        const ttsProvider: 'frdic' | 'minimax' = provider === 'minimax' ? 'minimax' : 'frdic';

        console.log(`[TTS] Generating audio for word: ${word}, provider: ${ttsProvider}`);

        const result = await generateAudio(word, ttsProvider);

        console.log(`[TTS] Audio generated successfully: ${result.audioUrl}`);

        return json({
            success: true,
            audio_url: result.audioUrl,
            audio_size: result.audioSize,
            provider: ttsProvider,
        });
    } catch (e) {
        console.error('[TTS] Error:', e);
        return json(
            { error: e instanceof Error ? e.message : 'Failed to generate audio' },
            { status: 500 }
        );
    }
};
