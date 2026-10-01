import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function s3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

function getS3Client(): S3Client | null {
  if (!s3Configured()) return null;
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export function getStorageMode(): 's3' | 'disk' {
  return s3Configured() ? 's3' : 'disk';
}

export async function checkStorageHealth(): Promise<{ ok: boolean; mode: 's3' | 'disk'; detail?: string }> {
  const mode = getStorageMode();
  if (mode === 'disk') {
    try {
      ensureUploadDir();
      fs.accessSync(UPLOAD_DIR, fs.constants.W_OK);
      return { ok: true, mode };
    } catch (e) {
      return { ok: false, mode, detail: e instanceof Error ? e.message : String(e) };
    }
  }
  try {
    const client = getS3Client()!;
    await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET! }));
    return { ok: true, mode };
  } catch (e) {
    return { ok: false, mode, detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Persist a data-URL or raw base64 image to Object Storage (S3/R2/MinIO) when configured,
 * otherwise to local disk. Returns a public URL (absolute for S3, path for disk).
 */
export async function saveProofImage(dataUrlOrBase64: string, prefix = 'proof'): Promise<string> {
  const raw = String(dataUrlOrBase64 || '');
  if (raw.length < 20) throw new Error('صورة غير صالحة');
  if (raw.length > 2_000_000) {
    throw new Error('حجم الصورة كبير جداً (الحد أقصى تقريباً 1.5 ميجابايت)');
  }

  let mime = 'image/jpeg';
  let b64 = raw;
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (m) {
    mime = m[1];
    b64 = m[2];
  }
  if (!mime.startsWith('image/')) {
    throw new Error('يُسمح بصور فقط');
  }

  const ext =
    mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  const name = `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const buffer = Buffer.from(b64, 'base64');

  const client = getS3Client();
  if (client) {
    const key = `${process.env.S3_PREFIX || 'proofs'}/${name}`;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: mime,
        ACL: process.env.S3_PUBLIC_ACL === 'true' ? 'public-read' : undefined,
      })
    );
    if (process.env.S3_PUBLIC_BASE_URL) {
      return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
    }
    if (process.env.S3_ENDPOINT) {
      return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${process.env.S3_BUCKET}/${key}`;
    }
    return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  ensureUploadDir();
  const full = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(full, buffer);
  return `/uploads/${name}`;
}

export function getUploadRoot(): string {
  ensureUploadDir();
  return UPLOAD_DIR;
}
