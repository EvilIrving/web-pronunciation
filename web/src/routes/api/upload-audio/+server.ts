/**
 * Upload Audio API 路由 - 处理自定义音频上传
 * 支持文件上传和 URL 音频上传，解析后上传到 R2
 */

import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL
} from '$env/static/private';
import type { RequestHandler } from './$types';

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

// 支持的音频 MIME 类型
const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];

// 最大文件大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 从 Content-Type 获取文件扩展名
function getExtensionFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/aac': 'aac',
  };
  return typeMap[contentType] || 'mp3';
}

/**
 * 上传音频到 R2
 */
async function uploadToR2(
  audioData: Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: audioData,
      ContentType: contentType,
    })
  );

  // 返回公开访问 URL
  return `${R2_PUBLIC_URL}/${filename}`;
}

/**
 * 从 URL 获取音频数据
 */
async function fetchAudioFromUrl(url: string): Promise<{ data: Uint8Array; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      // 模拟常见浏览器的 User-Agent
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`获取音频失败: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  
  if (!SUPPORTED_AUDIO_TYPES.some(type => contentType.includes(type.replace('audio/', ''))) && 
      !contentType.includes('audio/')) {
    throw new Error(`不支持的音频格式: ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  if (data.length > MAX_FILE_SIZE) {
    throw new Error('音频文件超过限制（最大 10MB）');
  }

  return { data, contentType };
}

// POST - 上传音频（支持文件或 URL）
export const POST: RequestHandler = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // 判断是 JSON（URL）还是 multipart（文件）
    if (contentType.includes('application/json')) {
      // URL 上传模式
      const body = await request.json();
      const { url, word } = body;

      if (!url) {
        return json({ error: '请提供音频 URL' }, { status: 400 });
      }

      // 验证 URL 格式
      try {
        new URL(url);
      } catch {
        return json({ error: '无效的 URL 格式' }, { status: 400 });
      }

      console.log(`[Upload] Fetching audio from URL: ${url}`);

      // 从 URL 获取音频
      const { data: audioData, contentType: audioContentType } = await fetchAudioFromUrl(url);

      // 生成文件名
      const wordName = word ? word.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'audio';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const extension = getExtensionFromContentType(audioContentType);
      const filename = `${wordName}_${timestamp}_${randomSuffix}.${extension}`;

      // 上传到 R2
      const audioUrl = await uploadToR2(audioData, filename, audioContentType);

      console.log(`[Upload] Audio uploaded successfully: ${audioUrl}`);

      return json({
        success: true,
        audio_url: audioUrl,
        size: audioData.length,
        source: 'url',
      });
    } else {
      // 文件上传模式
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File | null;
      const word = formData.get('word') as string | null;

      // 验证文件
      if (!audioFile || audioFile.size === 0) {
        return json({ error: '请选择音频文件' }, { status: 400 });
      }

      if (!SUPPORTED_AUDIO_TYPES.includes(audioFile.type)) {
        return json(
          { error: '不支持的音频格式，请上传 MP3、WAV、WebM 或 OGG 格式' },
          { status: 400 }
        );
      }

      if (audioFile.size > MAX_FILE_SIZE) {
        return json({ error: '文件大小超过限制（最大 10MB）' }, { status: 400 });
      }

      // 生成文件名（使用单词 + 时间戳 + 随机后缀）
      const wordName = word ? word.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'audio';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const extension = audioFile.type === 'audio/mpeg' || audioFile.type === 'audio/mp3' ? 'mp3' : 'webm';
      const filename = `${wordName}_${timestamp}_${randomSuffix}.${extension}`;

      // 读取文件数据
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioData = new Uint8Array(arrayBuffer);

      // 上传到 R2
      const audioUrl = await uploadToR2(audioData, filename, audioFile.type);

      console.log(`[Upload] Audio uploaded successfully: ${audioUrl}`);

      return json({
        success: true,
        audio_url: audioUrl,
        original_name: audioFile.name,
        size: audioFile.size,
        source: 'file',
      });
    }
  } catch (e) {
    console.error('[Upload] Error:', e);
    return json(
      { error: e instanceof Error ? e.message : '上传失败' },
      { status: 500 }
    );
  }
};
