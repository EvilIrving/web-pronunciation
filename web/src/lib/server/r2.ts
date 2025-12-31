import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} from '$env/static/private';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function upload(data: Uint8Array, filename: string, contentType = 'audio/mpeg'): Promise<string> {
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: filename,
    Body: data,
    ContentType: contentType,
  }));
  return `${R2_PUBLIC_URL}/${filename}`;
}

export function genFilename(word: string, accent: string, ext = 'mp3'): string {
  const name = word.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${name}_${accent}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];
export const MAX_SIZE = 10 * 1024 * 1024;

export function getExt(contentType: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/aac': 'aac',
  };
  return map[contentType] || 'mp3';
}
