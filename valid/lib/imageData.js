const MAX_IMAGE_BYTES = 1_500_000;

const imageSignatures = {
  'image/jpeg': (buffer) => buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.length > 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buffer) => buffer.length > 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
};

export function readImageDataUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_BYTES * 1.4) return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const [, mimeType, encoded] = match;
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES || !imageSignatures[mimeType](buffer)) return null;
  return { dataUrl: value, mimeType, size: buffer.length };
}
