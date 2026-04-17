import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET = process.env.S3_BUCKET_NAME!;

// ─────────────────────────────────────────────────────────────────────────────
// Signed upload URL — client uploads directly to S3
// ─────────────────────────────────────────────────────────────────────────────
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 600, // 10 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// ─────────────────────────────────────────────────────────────────────────────
// Signed download URL
// ─────────────────────────────────────────────────────────────────────────────
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn = 3600, // 1 hour
  filename?: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: filename
      ? `attachment; filename="${filename}"`
      : undefined,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete object
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate S3 keys
// ─────────────────────────────────────────────────────────────────────────────
export function uploadKey(userId: string, uploadId: string, filename: string): string {
  return `uploads/${userId}/${uploadId}/${filename}`;
}

export function outputKey(userId: string, jobId: string, filename: string): string {
  return `outputs/${userId}/${jobId}/${filename}`;
}

export { s3 };
