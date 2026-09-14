import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2]);
const require = createRequire(pathToFileURL(`${root}/package.json`));
const ts = require('typescript');
const source = readFileSync(`${root}/src/core/publicFields.ts`, 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { publicUserId, socialAction } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const cases = [
  [{ secUid: 'MS4-real', id: '123' }, 'MS4-real'],
  [{ secUid: '', id: '9876543210987654321' }, '9876543210987654321'],
  [{ secUid: '0', id: '123' }, '123'],
  [{ secUid: '  ', id: '0' }, undefined],
  [{ id: '000' }, undefined], [{}, undefined],
  [{ id: '-1' }, undefined], [{ id: 'anonymous' }, undefined],
  [{ idStr: '1234567890123456789', id: '0' }, '1234567890123456789'],
  [{ idStr: '0', id: '123' }, '123'],
];
for (const [input, expected] of cases) assert.equal(publicUserId(input), expected);
for (const [input, expected] of [['1', 'follow'], ['2', 'share'], ['3', 'unknown'], [undefined, 'unknown'], ['0', 'unknown']]) assert.equal(socialAction(input), expected);
const adapter = readFileSync(`${root}/src/core/dycast.ts`, 'utf8');
assert.match(adapter, /message\.repeatEnd, message\.groupId\)/);
assert.match(adapter, /type: data\.type/);
assert.match(adapter, /id: publicUserId\(data\)/);
console.log('PASS 15 behavior cases + 3 adapter wiring assertions');

// 使用真实 protobuf 编解码器验证字段和 int64 精度，不接触任何直播间。
const esbuild = require('esbuild');
const bundled = await esbuild.build({
  stdin: { contents: `
    export { encodeUser, decodeUser } from './src/core/model/base';
    export { encodeGiftMessage, decodeGiftMessage } from './src/core/model/messages/gift';
    export { encodeSocialMessage, decodeSocialMessage } from './src/core/model/messages/social';
  `, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const codec = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const decodedUser = codec.decodeUser(codec.encodeUser({ id: '987654321012345678', secUid: '' }));
assert.equal(decodedUser.id, '987654321012345678');
assert.equal(publicUserId(decodedUser), '987654321012345678');
const decodedGift = codec.decodeGiftMessage(codec.encodeGiftMessage({ groupId: '987654321012345679', gift: { id: '42', type: 1 }, repeatCount: '3', repeatEnd: 0 }));
assert.equal(decodedGift.groupId, '987654321012345679');
assert.equal(decodedGift.gift.type, 1);
const decodedSocial = codec.decodeSocialMessage(codec.encodeSocialMessage({ action: '2' }));
assert.equal(decodedSocial.action, '2');
assert.equal(socialAction(decodedSocial.action), 'share');
console.log('PASS 6 real protobuf round-trip assertions');
