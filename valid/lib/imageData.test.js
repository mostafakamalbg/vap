import assert from 'node:assert/strict';
import test from 'node:test';
import { readImageDataUrl } from './imageData.js';

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('image uploads accept supported data URLs with matching image signatures', () => {
  const image = Buffer.concat([pngSignature, Buffer.from([0x00])]);
  const result = readImageDataUrl(`data:image/png;base64,${image.toString('base64')}`);

  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.size, image.length);
});

test('image uploads reject unsupported, mismatched, and oversized payloads', () => {
  assert.equal(readImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(readImageDataUrl('data:image/png;base64,SGVsbG8='), null);

  const oversized = Buffer.concat([pngSignature, Buffer.alloc(1_500_000)]);
  assert.equal(readImageDataUrl(`data:image/png;base64,${oversized.toString('base64')}`), null);
});
