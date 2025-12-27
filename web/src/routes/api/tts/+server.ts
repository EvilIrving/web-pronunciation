/**
 * TTS API 路由 - 支持多种发音源和口音
 * 优先使用 frdic.com 真人发音，备用 MiniMax AI 发音
 * 支持美音 (us) 和英音 (uk)
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

// frdic.com 真人发音 API
const FRDIC_TTS_URL = 'https://api.frdic.com/api/v2/speech/speakweb';

// voicename 映射：区分 us (美音) 和 uk (英音)
const FRDIC_VOICENAME: Record<string, string> = {
    us: 'en_us_female',
    uk: 'en_uk_male',
};

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
 * @param word - 单词
 * @param accent - 口音，'us' 为美音，'uk' 为英音
 * @param encodedTxt - 已编码的文本（从欧路词典提取），如果提供则直接使用
 */
async function fetchAudioFromFrdic(
    word: string,
    accent: string = 'us',
    encodedTxt?: string
): Promise<Uint8Array> {
    // 如果提供了已编码的 txt，直接使用；否则自行编码
    const txt = encodedTxt || encodeWordToFrdic(word);
    const voicename = FRDIC_VOICENAME[accent] || FRDIC_VOICENAME['us'];
    const url = `${FRDIC_TTS_URL}?langid=en&voicename=${voicename}&txt=${txt}`;

    console.log(`[TTS] Fetching audio from frdic: accent=${accent}, url=${url}`);

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
 * 生成音频（支持多种发音源和口音）
 * @param text - 要生成音频的文本
 * @param accent - 口音，'us' 为美音，'uk' 为英音
 * @param provider - 发音源，'frdic'（默认，真人）或 'minimax'（AI）
 * @param encodedTxt - 已编码的文本（从欧路词典提取）
 */
async function generateAudio(
    text: string,
    accent: string = 'us',
    provider: 'frdic' | 'minimax' = 'frdic',
    encodedTxt?: string
): Promise<{ audioUrl: string; audioSize: number }> {
    const audioData = provider === 'frdic'
        ? await fetchAudioFromFrdic(text, accent, encodedTxt)
        : await fetchAudioFromMiniMax(text);

    const filename = `${text.toLowerCase()}_${accent}_${Date.now()}.mp3`;

    const audioUrl = await uploadToR2(audioData, filename);

    return {
        audioUrl,
        audioSize: audioData.length,
    };
}

/**
 * 同时生成美音和英音音频
 * @param text - 要生成音频的文本
 * @param provider - 发音源，'frdic'（默认，真人）或 'minimax'（AI）
 * @param encodedTxt - 已编码的文本（从欧路词典提取）
 */
async function generateBothAudios(
    text: string,
    provider: 'frdic' | 'minimax' = 'frdic',
    encodedTxt?: string
): Promise<{ audioUrlUs: string; audioUrlUk: string; audioSizeUs: number; audioSizeUk: number }> {
    console.log(`[TTS] Generating both US and UK audio for word: ${text}, provider: ${provider}`);

    // 并行获取美音和英音（两者使用相同的 encodedTxt）
    const [resultUs, resultUk] = await Promise.all([
        generateAudio(text, 'us', provider, encodedTxt),
        generateAudio(text, 'uk', provider, encodedTxt),
    ]);

    console.log(`[TTS] Both audios generated: us=${resultUs.audioUrl}, uk=${resultUk.audioUrl}`);

    return {
        audioUrlUs: resultUs.audioUrl,
        audioUrlUk: resultUk.audioUrl,
        audioSizeUs: resultUs.audioSize,
        audioSizeUk: resultUk.audioSize,
    };
}

// POST - 生成音频
// 请求体: { word: string, mode?: 'single' | 'both', accent?: 'us' | 'uk', provider?: 'frdic' | 'minimax', txt?: string }
// txt: 从欧路词典提取的已编码文本，如果提供则直接使用，无需再次编码
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { word, mode, accent, provider, txt } = body;

        if (!word) {
            return json({ error: 'word is required' }, { status: 400 });
        }

        // 支持指定发音源：frdic（默认，真人）或 minimax（AI）
        const ttsProvider: 'frdic' | 'minimax' = provider === 'minimax' ? 'minimax' : 'frdic';

        // mode 为 'both' 时，同时生成美音和英音
        if (mode === 'both') {
            console.log(`[TTS] Generating both audios for word: ${word}, provider: ${ttsProvider}, txt: ${txt ? 'provided' : 'auto'}`);

            const result = await generateBothAudios(word, ttsProvider, txt);

            return json({
                success: true,
                audio_url: result.audioUrlUs,
                audio_url_uk: result.audioUrlUk,
                audio_size: result.audioSizeUs,
                audio_size_uk: result.audioSizeUk,
                mode: 'both',
                provider: ttsProvider,
            });
        }

        // 单一口音模式（默认美音）
        const audioAccent: string = accent === 'uk' ? 'uk' : 'us';

        console.log(`[TTS] Generating audio for word: ${word}, accent: ${audioAccent}, provider: ${ttsProvider}, txt: ${txt ? 'provided' : 'auto'}`);

        const result = await generateAudio(word, audioAccent, ttsProvider, txt);

        console.log(`[TTS] Audio generated successfully: ${result.audioUrl}`);

        return json({
            success: true,
            audio_url: result.audioUrl,
            audio_size: result.audioSize,
            accent: audioAccent,
            provider: ttsProvider,
            mode: 'single',
        });
    } catch (e) {
        console.error('[TTS] Error:', e);
        return json(
            { error: e instanceof Error ? e.message : 'Failed to generate audio' },
            { status: 500 }
        );
    }
};
