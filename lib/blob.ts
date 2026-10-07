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
// The allowed types, and the extension each is actually stored under — never
// the uploaded filename's own extension. The browser sets `file.type` from
// what the client declares, not real content sniffing; without this, a part
// declaring Content-Type: image/png but named x.html would pass validation
// and still get stored as "<uuid>.html", publicly, under access: "public".
const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
    const ext = EXT_FOR_TYPE[file.type];
    if (file.size === 0 || file.size > MAX_BYTES || !ext) {
      skipped++;
      continue;
    }
    try {
      const key = `${pathPrefix}/${crypto.randomUUID()}${ext}`;
      const blob = await put(key, file, { access: "public", addRandomSuffix: false });
      urls.push(blob.url);
    } catch (e) {
      console.error(`[blob] upload failed for ${file.name}: ${(e as Error).message}`);
      skipped++;
    }
  }
  return { urls, skipped };
}
