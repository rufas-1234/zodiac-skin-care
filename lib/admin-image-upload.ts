"use client";

import { uploadPresigned } from '@vercel/blob/client';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MULTIPART_THRESHOLD = 4.5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function validateImage(file: File) {
  if (file.size === 0) {
    throw new Error('Choose an image to upload.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Image must be 10 MB or smaller.');
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    throw new Error('Upload a valid JPEG, PNG, WebP, or GIF image.');
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = file.type === 'image/jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === 'image/png'
      ? bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10'
      : file.type === 'image/webp'
        ? String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
          && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
        : ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.subarray(0, 6)));

  if (!valid) {
    throw new Error('Upload a valid JPEG, PNG, WebP, or GIF image.');
  }

  return extension;
}

export async function uploadAdminImage(file: File) {
  const extension = await validateImage(file);

  if (process.env.NODE_ENV === 'production') {
    const blob = await uploadPresigned(
      `uploads/${crypto.randomUUID()}.${extension}`,
      file,
      {
        access: 'public',
        handleUploadUrl: '/api/admin/uploads',
        multipart: file.size > MULTIPART_THRESHOLD,
      },
    );
    return blob.url;
  }

  const formData = new FormData();
  formData.set('file', file);
  const response = await fetch('/api/admin/uploads', { method: 'POST', body: formData });
  let result: { url?: unknown; error?: unknown };
  try {
    result = await response.json() as { url?: unknown; error?: unknown };
  } catch {
    throw new Error('The image upload server returned an invalid response.');
  }

  if (!response.ok || typeof result.url !== 'string') {
    throw new Error(
      typeof result.error === 'string' ? result.error : 'Unable to upload image. Please try again.',
    );
  }

  return result.url;
}
