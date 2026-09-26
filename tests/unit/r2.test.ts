import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, presignUpload, UploadRequest, uploadKey } from "@/lib/media/r2";

const fakeR2 = new S3Client({
  region: "auto",
  endpoint: "https://account.r2.cloudflarestorage.com",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

describe("presigned uploads", () => {
  it("only accepts images up to 10 MB", () => {
    const base = { prefix: "uploads/u1", contentLength: 1000 };
    expect(UploadRequest.safeParse({ ...base, contentType: "image/webp" }).success).toBe(true);
    expect(UploadRequest.safeParse({ ...base, contentType: "application/pdf" }).success).toBe(false);
    expect(
      UploadRequest.safeParse({ ...base, contentType: "image/jpeg", contentLength: MAX_UPLOAD_BYTES + 1 }).success,
    ).toBe(false);
  });

  it("rejects path traversal in the prefix", () => {
    expect(UploadRequest.safeParse({ prefix: "../etc", contentType: "image/png", contentLength: 1 }).success).toBe(false);
  });

  it("builds keys under the prefix with the right extension", () => {
    expect(uploadKey({ prefix: "uploads/u1/", contentType: "image/jpeg", contentLength: 1 }, "abc")).toBe(
      "uploads/u1/abc.jpg",
    );
  });

  it("signs a PUT URL scoped to the key, type and length", async () => {
    const res = await presignUpload({ prefix: "uploads/u1", contentType: "image/png", contentLength: 2048 }, fakeR2);
    const url = new URL(res.url);
    expect(url.pathname).toContain(res.key);
    expect(res.key).toMatch(/^uploads\/u1\/[0-9a-f-]{36}\.png$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(res.publicUrl).toMatch(/^https:\/\/.+\/uploads\/u1\//);
  });
});
