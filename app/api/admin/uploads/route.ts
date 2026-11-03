import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILE_SIGNATURES = [
  { mimeType: 'image/jpeg', extension: 'jpg', matches: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mimeType: 'image/png', extension: 'png', matches: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: 'image/webp', extension: 'webp', matches: (bytes: Buffer) => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
  { mimeType: 'image/gif', extension: 'gif', matches: (bytes: Buffer) => ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) },
];

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const signature = FILE_SIGNATURES.find(
      (candidate) => candidate.mimeType === file.type && candidate.matches(buffer),
    );
    if (!signature) {
      return NextResponse.json(
        { error: 'Upload a valid JPEG, PNG, WebP, or GIF image.' },
        { status: 415 },
      );
    }

    const directory = path.join(process.cwd(), 'data', 'uploads');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${signature.extension}`;
    await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });

    return NextResponse.json(
      { url: `/api/uploads/${filename}`, filename, size: file.size },
      { status: 201 },
    );
  } catch (error) {
    console.error('Unable to upload product image:', error);
    return NextResponse.json({ error: 'Unable to upload image. Please try again.' }, { status: 500 });
  }
}
