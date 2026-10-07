import { beforeEach, describe, expect, it, vi } from "vitest";

// uploadAttachments (lib/blob.ts) — the stored extension used to come from
// the uploaded filename, while the allow-list check used the client-declared
// Content-Type. A part declaring image/png but named x.html passed
// validation and was stored as "<uuid>.html", publicly. The extension must
// come from the validated type instead.

const puts: { key: string; type: string }[] = [];
vi.mock("@vercel/blob", () => ({
  put: async (key: string, file: File) => {
    puts.push({ key, type: file.type });
    return { url: `https://blob.test/${key}` };
  },
}));

function fakeFile(name: string, type: string, bytes = 100): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("uploadAttachments", () => {
  beforeEach(() => {
    puts.length = 0;
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  });

  it("stores the extension for the validated type, ignoring a mismatched filename extension", async () => {
    const { uploadAttachments } = await import("../lib/blob");
    const file = fakeFile("totally-safe.html", "image/png");
    const result = await uploadAttachments([file], "intake/test-firm");
    expect(result.skipped).toBe(0);
    expect(puts[0].key).toMatch(/\.png$/);
    expect(puts[0].key).not.toMatch(/\.html$/);
  });

  it("rejects a type outside the allow-list, regardless of filename", async () => {
    const { uploadAttachments } = await import("../lib/blob");
    const file = fakeFile("page.html", "text/html");
    const result = await uploadAttachments([file], "intake/test-firm");
    expect(result.skipped).toBe(1);
    expect(result.urls).toEqual([]);
    expect(puts).toHaveLength(0);
  });

  it("still maps every allowed type to its own stable extension", async () => {
    const { uploadAttachments } = await import("../lib/blob");
    const cases: [string, string][] = [
      ["a.jpg", "image/jpeg"],
      ["b.png", "image/png"],
      ["c.webp", "image/webp"],
      ["d.heic", "image/heic"],
      ["e.heif", "image/heif"],
      ["f.pdf", "application/pdf"],
    ];
    for (const [name, type] of cases) {
      puts.length = 0;
      await uploadAttachments([fakeFile(name, type)], "intake/test-firm");
      expect(puts[0].key).toMatch(new RegExp(`\\.${name.split(".").pop()}$`));
    }
  });
});
