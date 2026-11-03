import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const IMAGE_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const UUID_IMAGE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!UUID_IMAGE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }

  const imagePaths = [
    path.join(process.cwd(), 'data', 'uploads', filename),
    path.join(process.cwd(), 'public', 'uploads', filename),
  ];
  let image: Buffer | undefined;
  for (const imagePath of imagePaths) {
    try {
      image = await readFile(/* turbopackIgnore: true */ imagePath);
      break;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  if (!image) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }

  const extension = path.extname(filename).slice(1).toLowerCase();
  return new Response(new Uint8Array(image), {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(image.byteLength),
      'Content-Type': IMAGE_TYPES[extension]!,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
