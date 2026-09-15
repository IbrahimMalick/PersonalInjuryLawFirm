import crypto from "crypto";
import { put } from "@vercel/blob";

// File uploads for the public intake form (accident photos, injury photos, a
// police report). Vercel Blob: enable it in the project's Storage tab and it
// auto-injects BLOB_READ_WRITE_TOKEN — same pattern as the Neon integration
// auto-injecting DATABASE_URL. Until then, blobConfigured() is false and the
// intake page hides the upload field entirely rather than silently dropping
// whatever a claimant attached.

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function safeExt(name: string): string {
  const m = /\.[a-zA-Z0-9]{1,5}$/.exec(name);
  return m ? m[0].toLowerCase() : "";
}

export interface UploadResult {
  urls: string[];
  skipped: number; // rejected by type/size/count, or a failed upload
}

/** Uploads whatever passes validation; never throws — a bad attachment must
 * never block the inquiry itself from going through. */
export async function uploadAttachments(files: File[], pathPrefix: string): Promise<UploadResult> {
  if (!blobConfigured() || files.length === 0) {
    return { urls: [], skipped: files.length };
  }
  const urls: string[] = [];
  let skipped = Math.max(0, files.length - MAX_FILES);

  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size === 0 || file.size > MAX_BYTES || !ALLOWED_TYPES.has(file.type)) {
      skipped++;
      continue;
    }
    try {
      const key = `${pathPrefix}/${crypto.randomUUID()}${safeExt(file.name)}`;
      const blob = await put(key, file, { access: "public", addRandomSuffix: false });
      urls.push(blob.url);
    } catch (e) {
      console.error(`[blob] upload failed for ${file.name}: ${(e as Error).message}`);
      skipped++;
    }
  }
  return { urls, skipped };
}
