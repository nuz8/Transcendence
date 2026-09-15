import { open } from 'node:fs/promises';

/**
 * Function to check that 'error' is a type of NodeJS error
*/
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

/**
 * Function to read the first 12 bytes from the file to verify its true format via magic numbers.
*/
export async function isValidImageFile(filePath: string): Promise<boolean> {
let fileHandle;
try {
  fileHandle = await open(filePath, 'r');
  const buffer = Buffer.alloc(12);
  const { bytesRead } = await fileHandle.read(buffer, 0, 12, 0);

  if (bytesRead < 12) {
    return false;
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;

  // JPEG signature: FF D8 FF
  const isJpeg =
  buffer[0] === 0xff &&
  buffer[1] === 0xd8 &&
  buffer[2] === 0xff;

  // WebP signature: RIFF .... WEBP
  const isWebp =
  buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
  buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  return isPng || isJpeg || isWebp;

} catch {
  return false;
} finally {
  await fileHandle?.close();
}
}
