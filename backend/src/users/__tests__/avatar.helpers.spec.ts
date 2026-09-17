import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isValidImageFile, isNodeError } from '../avatar.helpers';

describe('avatar.helpers', () => {
  describe('isNodeError', () => {
    it('returns true for an Error object with a string code', () => {
      const err = Object.assign(new Error('File not found'), { code: 'ENOENT' });
      expect(isNodeError(err)).toBe(true);
    });

    it('returns false for a standard Error without a code property', () => {
      const err = new Error('Standard error');
      expect(isNodeError(err)).toBe(false);
    });

    it('returns false for an Error with non-string code', () => {
      const err = Object.assign(new Error('Custom error'), { code: 123 });
      expect(isNodeError(err)).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isNodeError(null)).toBe(false);
      expect(isNodeError(undefined)).toBe(false);
      expect(isNodeError('error string')).toBe(false);
      expect(isNodeError({ code: 'ENOENT' })).toBe(false);
    });
  });

  describe('isValidImageFile', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(join(tmpdir(), 'avatar-helpers-test-'));
    });

    afterAll(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    const createTempFile = async (filename: string, content: Buffer): Promise<string> => {
      const filePath = join(tempDir, filename);
      await fs.writeFile(filePath, content);
      return filePath;
    };

    it('returns true for a valid PNG file', async () => {
      // 89 50 4E 47 0D 0A 1A 0A + 4 extra bytes
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const filePath = await createTempFile('valid.png', pngHeader);

      await expect(isValidImageFile(filePath)).resolves.toBe(true);
    });

    it('returns true for a valid JPEG file', async () => {
      // FF D8 FF E0 ... 12 bytes
      const jpegHeader = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      const filePath = await createTempFile('valid.jpg', jpegHeader);

      await expect(isValidImageFile(filePath)).resolves.toBe(true);
    });

    it('returns true for a valid WebP file', async () => {
      // RIFF (4 bytes) + size (4 bytes) + WEBP (4 bytes)
      const webpHeader = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x24, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP'),
      ]);
      const filePath = await createTempFile('valid.webp', webpHeader);

      await expect(isValidImageFile(filePath)).resolves.toBe(true);
    });

    it('returns false for a fake image (disguised text/script file)', async () => {
      const fakeContent = Buffer.from('<?php echo "evil script"; ?>');
      const filePath = await createTempFile('fake.png', fakeContent);

      await expect(isValidImageFile(filePath)).resolves.toBe(false);
    });

    it('returns false for an empty or truncated file (< 12 bytes)', async () => {
      const shortContent = Buffer.from([0x89, 0x50, 0x4e]);
      const filePath = await createTempFile('short.png', shortContent);

      await expect(isValidImageFile(filePath)).resolves.toBe(false);
    });

    it('returns false for a non-existent file path', async () => {
      const nonExistentPath = join(tempDir, 'does-not-exist.png');

      await expect(isValidImageFile(nonExistentPath)).resolves.toBe(false);
    });
  });
});
