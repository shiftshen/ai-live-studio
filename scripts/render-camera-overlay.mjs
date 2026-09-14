import sharp from "sharp";
import { resolve } from "node:path";
const out=resolve("public/live-assets/camera-rewards-zh.png");
const svg=`<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
<style>.h{font:700 58px 'PingFang SC',sans-serif}.b{font:700 38px 'PingFang SC',sans-serif}.s{font:400 27px 'PingFang SC',sans-serif}.u{font:700 24px monospace;letter-spacing:3px}</style>
<rect x="38" y="42" width="440" height="840" rx="18" fill="#070b0dd9" stroke="#ffffff55"/><rect x="38" y="42" width="10" height="840" fill="#ff315f"/>
<text x="78" y="112" class="u" fill="#ff7896">AI LIVE PRINTER</text><text x="78" y="185" class="h" fill="white">关注就打印</text>
<g fill="white"><text x="78" y="285" class="b">＋ 关注</text><text x="78" y="330" class="s">打印头像 · 中文语音感谢</text>
<path d="M72 365h360" stroke="#ffffff55"/><text x="78" y="430" class="b">♡ 点赞 10 / 50 / 100</text><text x="78" y="475" class="s">实时累计 · 达标自动播报</text>
<path d="M72 510h360" stroke="#ffffff55"/><text x="78" y="575" class="b">🎁 小心心 / 任意礼物</text><text x="78" y="620" class="s">打印头像 · 礼物语音感谢</text>
<path d="M72 655h360" stroke="#ffffff55"/><text x="78" y="720" class="b">🎁 礼物 × 10</text><text x="78" y="765" class="s">头像小票 · 专属祝福</text>
<path d="M72 800h360" stroke="#ffffff55"/><text x="78" y="855" class="b">🎁 礼物 × 66</text></g>
<rect x="650" y="50" width="380" height="84" rx="42" fill="#070b0dcc"/><circle cx="700" cy="92" r="12" fill="#60e9a2"/><text x="730" y="104" class="b" fill="white">真实打印中</text>
<rect x="180" y="1760" width="720" height="104" rx="18" fill="#070b0ddd"/><text x="540" y="1827" text-anchor="middle" class="b" fill="white">把镜头对准打印机 · 看见真实出纸</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(out);
