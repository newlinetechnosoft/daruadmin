import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const endpoint =
  process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT
const region =
  process.env.AWS_REGION || process.env.S3_REGION || 'ap-southeast-1'
const accessKeyId =
  process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID
const secretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY
const defaultBucket =
  process.env.STORAGE_BUCKET || process.env.S3_BUCKET || 'assets'

export const s3 = new S3Client({
  endpoint,
  region,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
  forcePathStyle: true, // Neon Object Storage requires path-style addressing
})

export interface PutObjectOptions {
  contentType?: string
  bucket?: string
  metadata?: Record<string, string>
}

/**
 * Upload an object to Neon Object Storage.
 */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string | ReadableStream,
  options?: PutObjectOptions,
) {
  const bucket = options?.bucket || defaultBucket
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body as any,
    ContentType: options?.contentType,
    Metadata: options?.metadata,
  })
  return s3.send(command)
}

/**
 * Download an object from Neon Object Storage.
 */
export async function getObject(key: string, bucket = defaultBucket) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })
  return s3.send(command)
}

/**
 * Generate a presigned PUT URL for client-side direct uploads.
 */
export async function presignPut(
  key: string,
  contentType?: string,
  expiresIn = 900,
  bucket = defaultBucket,
) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

/**
 * Generate a presigned GET URL for secure downloading/viewing private objects.
 */
export async function getPresignedUrl(
  key: string,
  expiresIn = 3600,
  bucket = defaultBucket,
) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

/**
 * Get direct URL for objects in public_read buckets.
 */
export function getPublicUrl(key: string, bucket = defaultBucket): string {
  const base = endpoint?.replace(/\/$/, '') || ''
  return `${base}/${bucket}/${key.replace(/^\//, '')}`
}

/**
 * Delete an object from Neon Object Storage.
 */
export async function deleteObject(key: string, bucket = defaultBucket) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })
  return s3.send(command)
}

/**
 * List objects under a prefix.
 */
export async function listObjects(prefix = '', bucket = defaultBucket) {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  })
  const res = await s3.send(command)
  return res.Contents ?? []
}
