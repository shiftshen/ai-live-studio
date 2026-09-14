import test from "node:test";
import assert from "node:assert/strict";
import {
  feieContent,
  sign,
  safeAvatarUrl,
  generateText,
  formatAvatar,
} from "../src/server/providers.ts";
import sharp from "sharp";
test("screen avatars retain color while thermal avatars use black and white", async () => {
  const source = await sharp({ create: { width: 24, height: 12, channels: 3, background: { r: 220, g: 30, b: 60 } } }).png().toBuffer();
  const screen = await formatAvatar(source);
  const {data, info} = await sharp(screen).raw().toBuffer({resolveWithObject: true});
  assert.equal(info.width, 224);
  assert.equal(info.height, 224);
  assert.ok(data[0] > data[1] + 100, "The screen must not show a thresholded silhouette");
  const paper = await formatAvatar(screen, true);
  const bw = await sharp(paper).removeAlpha().raw().toBuffer();
  assert.ok([...bw].every(value => value === 0 || value === 255));
  assert.ok(paper.length < 10000);
});
test("untrusted Feie tags cannot add copies or formatting", () => {
  const s = feieContent("<QR>bad</QR>\n你好");
  assert.ok(!s.includes("<QR>"));
  assert.ok(s.includes("<BR>"));
});
test("Feie signature matches SHA1 contract", () => {
  assert.equal(sign("a", "b", 1), "e175ea4ce0a553260a14bc5e922a935b40425c1e");
});
test("avatar URL rejects localhost, IPs and non-CDN", () => {
  for (const x of [
    "http://127.0.0.1/x",
    "https://localhost/x",
    "https://192.168.1.1/a",
    "https://example.com/a",
    "file:///etc/passwd",
  ])
    assert.throws(() => safeAvatarUrl(x));
  assert.equal(
    safeAvatarUrl("https://p16-sign.tiktokcdn.com/a").protocol,
    "https:",
  );
});

test("AI language mismatch cannot escape as a Thai response", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: { content: "你好欢迎光临" } }), {
        status: 200,
      });
    await assert.rejects(
      generateText(
        { language: "th", content: "hi" },
        { aiUrl: "http://127.0.0.1:11434", aiModel: "test" },
      ),
      /语言不符/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
